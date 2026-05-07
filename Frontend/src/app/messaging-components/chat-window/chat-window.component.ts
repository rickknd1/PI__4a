import {
    ChangeDetectorRef,
    Component,
    ElementRef,
    EventEmitter,
    Input,
    OnChanges,
    OnDestroy, OnInit,
    Output,
    SimpleChanges,
    ViewChild
} from '@angular/core';
import {CommonModule} from '@angular/common';
import {ConversationDTO} from "../../models/conversation.model";
import {MessageDTO} from "../../models/message.model";
import {MessagePayload} from "../message-input/message-input.component";
import {MessageService} from "../../services/Messaging/message.service";
import {MessageInputComponent} from "../message-input/message-input.component";
import {ParticipantsPanelComponent} from "../ participants-panel/participants-panel.component";
import {ConversationService} from "../../services/Messaging/conversation.service";
import {WebSocketService} from "../../services/Messaging/websocket.service";
import {forkJoin, of, Subscription} from 'rxjs';
import {FormsModule} from '@angular/forms';
import {ReactionService} from "../../services/Messaging/ReactionService";
import {StompSubscription} from "@stomp/stompjs";
import {catchError} from 'rxjs/operators';
import {GameWebSocketService} from "../../services/Messaging/game-websocket.service";
import {GameContainerComponent} from "../game-container/game-container.component";
import {GameLaunchModalComponent} from "../game-launch-component/game-launch-modal.component";
import {GameBannerComponent} from "../Game Banner Component/game-banner.component";
import {Theme} from "../../models/theme.model";
import {ThemeService} from "../../services/Messaging/theme.service";
import {ThemePickerComponent} from "../theme-picker/theme-picker.component";
import {GameService} from '../../services/Messaging/game.service';
import {GameSession, GameStatus} from '../../models/game.model';

@Component({
    selector: 'app-chat-window',
    standalone: true,
    imports: [CommonModule, MessageInputComponent, ParticipantsPanelComponent, FormsModule, GameContainerComponent, GameLaunchModalComponent, GameBannerComponent, ThemePickerComponent],
    templateUrl: './chat-window.component.html',
    styleUrls: ['./chat-window.component.css'],
    host: { class: 'flex flex-col flex-1 min-h-0 overflow-hidden' }
})
export class ChatWindowComponent implements OnInit ,OnChanges, OnDestroy {
    private gameEventSub?: Subscription
    showThemePicker = false;
    showGameLaunchModal = false;
    gamePhase: 'BANNER' | 'PLAYING' | 'LEADERBOARD'| null = null;

    showReactionsModal = false;
    modalMessage: MessageDTO | null = null;
    activeReactionFilter: string | null = null;

    fullscreenImageUrl: string | null = null;

    private reactionSubs: StompSubscription[] = [];
    showEmojiPickerForId: string | null = null;
    replyingTo: MessageDTO | null = null;
    openMenuId: string | null = null;
    editingMessageId: string | null = null;
    editContent = '';

    private userIsScrolling = false;
    @Input() conversation: ConversationDTO | null = null;
    @Input() currentUserId: string = '';
    @Output() conversationLeft = new EventEmitter<void>();

    messages: MessageDTO[] = [];
    loading = false;
    showParticipants = false;

    private wsSub?: Subscription;
    gameModalConversationId: string = '';
    gameModalUserId: string = '';

    localGameData: { gameId: string; category: string; totalQuestions: number; timeLimitPerQuestion: number; createdBy: string } | null = null;
    private themeSubscription?: Subscription;

    @ViewChild('messagesContainer') private messagesContainer!: ElementRef;
    @ViewChild(GameLaunchModalComponent) gameLaunchModal?: GameLaunchModalComponent;

    constructor(
        private messageService: MessageService,
        private conversationService: ConversationService,
        private webSocketService: WebSocketService,
        private reactionService: ReactionService,
        private cdr: ChangeDetectorRef,
        private themeService: ThemeService,
        private gameWsService: GameWebSocketService,
        private gameService: GameService
    ) {
        this.webSocketService.connect();
    }

    ngOnInit(): void {
        if (this.conversation && this.conversation.theme) {
            this.themeService.applyTheme(this.conversation.theme);
        }
    }

    readonly emojiMap: Record<string, string> = {
        LIKE: '👍',
        LOVE: '❤️',
        HAHA: '😂',
        NOTBAD: '😮',
        GREATJOB: '🎉'
    };


    ngOnChanges(changes: SimpleChanges) {
        if (changes['conversation'] && this.conversation) {
            if (this.conversation.theme) {
                this.themeService.applyTheme(this.conversation.theme);
            }
            if (this.wsSub) this.wsSub.unsubscribe();

            // FIX: unsubscribe old game event subscription before creating new one
            if (this.gameEventSub) this.gameEventSub.unsubscribe();

            this.loadMessages();
            this.subscribeToWebSocket(this.conversation.id);

            this.gamePhase = null;
            this.localGameData = null;

            this.gameWsService.subscribeToGameEvents(this.conversation.id);

            // FIX: store the subscription so it can be unsubscribed on next change
            this.gameEventSub = this.gameWsService.gameEvent$.subscribe((event: any) => {
                if (!event) return;
                switch (event.type) {
                    case 'GAME_CREATED':
                        if (this.gamePhase === null) this.gamePhase = 'BANNER';
                        break;
                    case 'GAME_STARTED':
                        this.gamePhase = 'PLAYING';
                        this.localGameData = null;
                        break;
                    case 'GAME_OVER':
                        console.log('🎮 GAME_OVER received in ChatWindow - keeping PLAYING so leaderboard can show');
                        break;
                }
            });

            // FIX: restore game state on reload by fetching active game from backend
            this.restoreGameState(this.conversation.id);

            if (this.themeSubscription) this.themeSubscription.unsubscribe();
            this.themeSubscription = this.webSocketService.themeUpdated$.subscribe((newTheme: Theme | null) => {
                if (newTheme) this.themeService.applyTheme(newTheme);
            });

            if (this.conversation.theme) {
                this.themeService.setInitialTheme(this.conversation.theme);
            }
        }
    }

    ngOnDestroy() {
        this.wsSub?.unsubscribe();
        this.gameEventSub?.unsubscribe(); // ADD this
        this.themeSubscription?.unsubscribe();
        this.reactionSubs.forEach(s => s.unsubscribe());
        this.gameWsService.unsubscribeFromGameEvents();
    }

    private subscribeToWebSocket(conversationId: string): void {
        this.webSocketService.subscribeToConversation(conversationId);

        this.wsSub = this.webSocketService.message$.subscribe((msg: any) => {
            if (msg.conversationId !== conversationId) return;

            const existingIndex = this.messages.findIndex(m => m.id === msg.id);
            if (existingIndex !== -1) {
                this.messages[existingIndex] = msg;
            } else {
                const isOwnMessage = msg.senderId === this.currentUserId;
                if (!isOwnMessage) {
                    this.messages.push(msg);
                    setTimeout(() => this.scrollToBottom(), 50);
                    this.loadReactionsForMessage(msg.id);
                    this.subscribeToSingleReaction(msg.id);
                    // Auto-mark as read since the window is open
                    this.messageService.markAsRead(conversationId, msg.id, this.currentUserId)
                        .subscribe({
                            next: (updated) => {
                                const idx = this.messages.findIndex(m => m.id === updated.id);
                                if (idx !== -1) this.messages[idx] = { ...this.messages[idx], receipts: updated.receipts };
                            },
                            error: () => {}
                        });
                }
            }
        });
    }

    private loadMessages() {
        if (!this.conversation?.id || !this.currentUserId) return;
        this.loading = true;

        this.messageService.getMessagesByConversation(this.conversation.id, this.currentUserId)
            .subscribe({
                next: (msgs) => {
                    this.messages = msgs || [];
                    this.loading = false;
                    setTimeout(() => {
                        this.loadAllReactions();
                        this.subscribeToReactions();
                        this.forceScrollToBottom();
                        this.markVisibleMessagesAsRead();
                    }, 0);
                },
                error: (err) => {
                    console.error('Failed to load messages:', err);
                    this.loading = false;
                }
            });
    }

    /**
     * Mark all messages in this conversation as read by the current user.
     * We only call this for messages we did NOT send ourselves.
     */
    private markVisibleMessagesAsRead(): void {
        if (!this.conversation?.id || !this.currentUserId) return;
        const toMark = this.messages.filter(
            m => m.senderId !== this.currentUserId && !m.deleted && !m.id.startsWith('temp-')
        );
        toMark.forEach(msg => {
            this.messageService.markAsRead(this.conversation!.id, msg.id, this.currentUserId)
                .subscribe({
                    next: (updated) => {
                        const idx = this.messages.findIndex(m => m.id === updated.id);
                        if (idx !== -1) this.messages[idx] = { ...this.messages[idx], receipts: updated.receipts };
                    },
                    error: () => {} // non-critical, silent fail
                });
        });
    }

    /**
     * Returns how many OTHER participants have read a given message.
     * Used to show ✓ / ✓✓ on the sender's own messages.
     */
    getReadCount(msg: MessageDTO): number {
        if (!msg.receipts) return 0;
        return msg.receipts.filter(r => r.userId !== this.currentUserId).length;
    }

    onSendMessage(payload: MessagePayload) {
        if (!this.conversation) return;
        const { text, file, fileType } = payload;
        if (!text && !file) return;

        const parentId = this.replyingTo?.id ?? null;

        // ── Text-only fast path ────────────────────────────────────────────
        if (!file) {
            this.sendTextMessage(text, parentId);
            return;
        }

        // ── File / Image path — optimistic placeholder then upload ─────────
        const tempId = 'temp-' + Date.now();
        const optimisticMsg: MessageDTO = {
            id: tempId,
            content: text || (fileType === 'IMAGE' ? '📷 Image' : '📎 ' + file.name),
            senderId: this.currentUserId,
            senderName: 'You',
            createdAt: new Date().toISOString(),
            conversationId: this.conversation.id,
            type: fileType,
            parentMessageId: parentId ?? undefined,
            parentMessageContent: this.replyingTo?.content,
            // local preview fields — only used before upload completes
            _localPreviewUrl: fileType === 'IMAGE' ? URL.createObjectURL(file) : undefined,
            _localFileName: file.name
        };

        this.messages.push(optimisticMsg);
        this.forceScrollToBottom();
        this.replyingTo = null;

        this.messageService.uploadMedia(file).subscribe({
            next: (mediaUrl: string) => {
                // mediaUrl is the full URL returned by the backend
                const fullUrl = mediaUrl.startsWith('http')
                    ? mediaUrl
                    : `http://localhost:8089${mediaUrl}`;

                this.messageService.sendMessage(
                    this.conversation!.id,
                    this.currentUserId,
                    fullUrl,
                    parentId,
                    fileType ?? 'FILE'
                ).subscribe({
                    next: (realMsg) => {
                        const idx = this.messages.findIndex(m => m.id === tempId);
                        if (idx !== -1) this.messages[idx] = realMsg;
                        this.loadReactionsForMessage(realMsg.id);
                        this.subscribeToSingleReaction(realMsg.id);
                        // Release the blob URL we created for the preview
                        if (optimisticMsg._localPreviewUrl) {
                            URL.revokeObjectURL(optimisticMsg._localPreviewUrl);
                        }
                    },
                    error: (err) => {
                        console.error('Failed to send media message', err);
                        this.messages = this.messages.filter(m => m.id !== tempId);
                    }
                });
            },
            error: (err) => {
                console.error('Failed to upload media', err);
                this.messages = this.messages.filter(m => m.id !== tempId);
            }
        });

        // Also send caption as a separate text message if there is one
        if (text.trim()) {
            setTimeout(() => this.sendTextMessage(text, parentId), 200);
        }
    }

    private sendTextMessage(content: string, parentId: string | null) {
        if (!this.conversation || !content.trim()) return;

        const optimisticMsg: MessageDTO = {
            id: 'temp-' + Date.now(),
            content,
            senderId: this.currentUserId,
            senderName: 'You',
            createdAt: new Date().toISOString(),
            conversationId: this.conversation.id,
            type: 'TEXT',
            parentMessageId: parentId ?? undefined,
            parentMessageContent: this.replyingTo?.content
        };

        this.messages.push(optimisticMsg);
        this.forceScrollToBottom();

        this.messageService.sendMessage(
            this.conversation.id,
            this.currentUserId,
            content,
            parentId,
            'TEXT'
        ).subscribe({
            next: (realMsg) => {
                const index = this.messages.findIndex(m => m.id === optimisticMsg.id);
                if (index !== -1) this.messages[index] = realMsg;
                this.loadReactionsForMessage(realMsg.id);
                this.subscribeToSingleReaction(realMsg.id);
            },
            error: (err) => {
                console.error('Failed to send message', err);
                this.messages = this.messages.filter(m => m.id !== optimisticMsg.id);
            }
        });
    }

    private scrollToBottom(): void {
        if (!this.messagesContainer) return;
        const container = this.messagesContainer.nativeElement;
        if (!this.userIsScrolling) {
            setTimeout(() => {
                container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
            }, 10);
        }
    }



    isMine(msg: MessageDTO): boolean {
        return msg.senderId === this.currentUserId;
    }

    deleteConversationForMe() {
        if (!this.conversation?.id || !this.currentUserId) return;

        const isGroup = this.conversation.type === 'GROUP';
        const confirmMsg = isGroup
            ? 'Leave this group? All current messages will disappear for you only.'
            : 'Archive this conversation? All current messages will disappear for you only.';

        if (!confirm(confirmMsg)) return;

        this.conversationService.hideMessagesForUser(this.conversation.id, this.currentUserId)
            .subscribe({
                next: () => {
                    this.messages = [];
                    this.loadMessages();
                },
                error: (err) => {
                    console.error(err);
                    alert('Action failed. Please try again.');
                }
            });
    }



    private forceScrollToBottom() {
        this.userIsScrolling = false;
        this.scrollToBottom();
    }

    startEditing(msg: MessageDTO) {
        if (msg.senderId !== this.currentUserId) return;
        this.editingMessageId = msg.id;
        this.editContent = msg.content;
    }

    saveEdit() {
        if (!this.editingMessageId || !this.editContent.trim() || !this.conversation) return;

        const messageId = this.editingMessageId;
        const newContent = this.editContent.trim();

        this.messageService.updateMessage(this.conversation.id, messageId, newContent)
            .subscribe({
                next: (updatedMsg) => {
                    const index = this.messages.findIndex(m => m.id === messageId);
                    if (index !== -1) this.messages[index] = updatedMsg;
                    this.cancelEdit();
                },
                error: (err) => {
                    console.error('Failed to update message', err);
                    alert('Failed to edit message. Please try again.');
                    this.cancelEdit();
                }
            });
    }

    cancelEdit() {
        this.editingMessageId = null;
        this.editContent = '';
    }

    toggleMenu(messageId: string) {
        this.openMenuId = this.openMenuId === messageId ? null : messageId;
    }

    deleteMessage(messageId: string) {
        if (!this.conversation) return;
        if (!confirm('Delete this message?')) return;

        this.messageService.deleteMessage(this.conversation.id, messageId)
            .subscribe({
                next: (deletedMsg) => {
                    const index = this.messages.findIndex(m => m.id === messageId);
                    if (index !== -1) this.messages[index] = deletedMsg;
                    this.openMenuId = null;
                    this.webSocketService.sendMessage(
                        this.conversation!.id,
                        this.currentUserId,
                        deletedMsg.content
                    );
                },
                error: (err) => {
                    console.error('Failed to delete message', err);
                    alert('Failed to delete message.');
                }
            });
    }

    replyTo(msg: MessageDTO) {
        this.replyingTo = msg;
        this.openMenuId = null;
    }

    cancelReply() {
        this.replyingTo = null;
    }

    scrollToMessage(messageId: string) {
        const element = document.getElementById('msg-' + messageId);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            element.classList.add('bg-blue-50/50');
            setTimeout(() => element.classList.remove('bg-blue-50/50'), 1500);
        }
    }

    toggleEmojiPicker(messageId: string, event: Event) {
        event.stopPropagation();
        this.showEmojiPickerForId = this.showEmojiPickerForId === messageId ? null : messageId;
    }

    react(msg: MessageDTO, emoji: string) {
        if (!this.conversation) return;

        this.reactionService.toggleReaction(
            this.conversation.id, msg.id, this.currentUserId, emoji
        ).subscribe({
            next: (reactions) => {
                msg.reactions = reactions;
                this.showEmojiPickerForId = null;
                this.messages = [...this.messages];
            },
            error: (err) => console.error('❌ Failed to toggle reaction', err)
        });
    }

    getGroupedReactions(msg: MessageDTO): { emoji: string, count: number, hasMe: boolean }[] {
        if (!msg.reactions || msg.reactions.length === 0) return [];

        const groups: Record<string, { count: number, hasMe: boolean }> = {};
        for (const r of msg.reactions) {
            const key = r.emoji;
            if (!groups[key]) groups[key] = { count: 0, hasMe: false };
            groups[key].count++;
            if (r.userId === this.currentUserId) groups[key].hasMe = true;
        }

        return Object.entries(groups).map(([emoji, data]) => ({
            emoji: this.emojiMap[emoji] || emoji,
            count: data.count,
            hasMe: data.hasMe
        }));
    }

    getEmojiKey(emojiChar: string): string {
        return Object.entries(this.emojiMap).find(([, v]) => v === emojiChar)?.[0] ?? emojiChar;
    }

    private subscribeToReactions(): void {
        this.reactionSubs.forEach(s => s.unsubscribe());
        this.reactionSubs = [];

        this.messages.forEach(msg => {
            if (!msg.id) return;
            const topic = `/topic/reactions/${msg.id}`;
            const sub = this.webSocketService.subscribeToTopic(topic, (data: any) => {
                const target = this.messages.find(m => m.id === data.messageId);
                if (target) target.reactions = data.reactions || [];
            });
            if (sub) this.reactionSubs.push(sub);
        });
    }

    getMessageBubbleClass(msg: MessageDTO): string {
        const isMine = msg.senderId === this.currentUserId;
        if (msg.deleted) return 'msg-bubble-deleted rounded-2xl px-4 py-2';
        return isMine
            ? 'msg-bubble-mine rounded-2xl rounded-tr-sm px-4 py-2.5'
            : 'msg-bubble-other rounded-2xl rounded-tl-sm px-4 py-2.5';
    }

    private subscribeToSingleReaction(messageId: string): void {
        const topic = `/topic/reactions/${messageId}`;
        const sub = this.webSocketService.subscribeToTopic(topic, (data: any) => {
            if (!data || !data.messageId) return;
            const target = this.messages.find(m => m.id === data.messageId);
            if (target) target.reactions = data.reactions || [];
        });
        if (sub) this.reactionSubs.push(sub);
    }

    private loadAllReactions() {
        const validMessages = this.messages.filter(m => m.id && !m.id.startsWith('temp-'));
        if (!validMessages.length || !this.conversation?.id) return;

        const requests = validMessages.map(msg =>
            this.reactionService.getReactions(this.conversation!.id, msg.id).pipe(catchError(() => of([])))
        );

        forkJoin(requests).subscribe(allReactions => {
            allReactions.forEach((reactions, i) => {
                validMessages[i].reactions = reactions || [];
            });
            this.messages = [...this.messages];
            this.cdr.detectChanges();
        });
    }

    private loadReactionsForMessage(messageId: string): void {
        if (!this.conversation?.id) return;

        this.reactionService.getReactions(this.conversation.id, messageId).subscribe({
            next: (reactions) => {
                const targetMsg = this.messages.find(m => m.id === messageId);
                if (targetMsg) {
                    targetMsg.reactions = reactions || [];
                    this.messages = [...this.messages];
                }
            },
            error: (err) => console.error(`Failed to load reactions for message ${messageId}`, err)
        });
    }

    trackByMessageId(_index: number, msg: MessageDTO) {
        return msg.id;
    }

    openReactionsModal(msg: MessageDTO, event: Event) {
        event.stopPropagation();
        this.modalMessage = msg;
        this.activeReactionFilter = null;
        this.showReactionsModal = true;
    }

    closeReactionsModal() {
        this.showReactionsModal = false;
        this.modalMessage = null;
        this.activeReactionFilter = null;
    }

    getFilteredReactions() {
        if (!this.modalMessage?.reactions) return [];
        if (!this.activeReactionFilter) return this.modalMessage.reactions;
        return this.modalMessage.reactions.filter(r => r.emoji === this.activeReactionFilter);
    }

    getModalTabs() {
        if (!this.modalMessage?.reactions) return [];
        const groups: Record<string, number> = {};
        for (const r of this.modalMessage.reactions) {
            groups[r.emoji] = (groups[r.emoji] || 0) + 1;
        }
        return Object.entries(groups).map(([emoji, count]) => ({
            emoji,
            display: this.emojiMap[emoji] || emoji,
            count
        }));
    }

    closeGameLaunchModal(): void {
        this.showGameLaunchModal = false;
    }

    onGameStarted(): void {
        this.gamePhase = 'PLAYING';
        this.localGameData = null;
    }

    onBannerDismissed(): void {
        this.gamePhase = null;
        this.localGameData = null;
        this.cdr.detectChanges();
    }

    openGameLaunchModal(): void {
        this.gameModalConversationId = this.conversation?.id || '';
        this.gameModalUserId = this.currentUserId;
        if (!this.gameModalConversationId || !this.gameModalUserId) return;
        document.body.classList.add('game-modal-open');
        this.showGameLaunchModal = true;
    }

    onGameCreated(game: GameSession): void {
        this.localGameData = {
            gameId: game.id,
            category: game.category,
            totalQuestions: game.totalQuestions,
            timeLimitPerQuestion: game.timeLimitPerQuestion,
            createdBy: game.createdBy
        };
        this.gamePhase = 'BANNER';
        this.showGameLaunchModal = false;
    }

    onGroupPhotoChanged(photoUrl: string): void {
        if (this.conversation) {
            this.conversation.photoUrl = photoUrl;
        }
    }

    openImageFullscreen(url: string) {
        this.fullscreenImageUrl = url;
    }

    closeImageFullscreen() {
        this.fullscreenImageUrl = null;
    }
    onImageError(event: any) {
        console.warn('Image failed to load:', event.target.src);
        event.target.src = 'https://via.placeholder.com/150?text=Group'; // fallback
    }
    // Fix restoreGameState — use enum values that match backend
    private restoreGameState(conversationId: string): void {
        this.gameService.getActiveGame(conversationId).subscribe({
            next: (game) => {
                if (!game) return;
                if (game.status === GameStatus.WAITING) {
                    this.localGameData = {
                        gameId: game.id,
                        category: game.category,
                        totalQuestions: game.totalQuestions,
                        timeLimitPerQuestion: game.timeLimitPerQuestion,
                        createdBy: game.createdBy
                    };
                    this.gamePhase = 'BANNER';
                } else if (game.status === GameStatus.IN_PROGRESS) {
                    this.gamePhase = 'PLAYING';
                    this.localGameData = null;
                }
            },
            error: () => {} // no active game, do nothing
        });
    }

}