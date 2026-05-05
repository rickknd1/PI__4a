import { Component, ElementRef, OnDestroy, OnInit, ViewChild, computed, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Subscription } from 'rxjs';

import { AuthService } from '../shared/services/auth.service';
import { apiUrl } from '../../environments/environment';
import {
  MessagingService,
  Conversation,
  ConversationDTO,
  ChatMessage,
  Reaction,
  EmojiType,
  GameSession,
  Difficulty,
} from './messaging.service';

interface DirectoryUser {
  id?: string;
  userId?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  role?: string;
  profilePhoto?: string;
}

const EMOJI_LABELS: Record<EmojiType, string> = {
  LIKE: '👍', LOVE: '❤️', HAHA: '😂', NOTBAD: '👌', GREATJOB: '🎉',
};

@Component({
  selector: 'app-messaging-page',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe],
  templateUrl: './messaging-page.component.html',
  styles: [`
    :host { display:block; height: calc(100vh - 7rem); }
    .scrollbar-thin::-webkit-scrollbar { width: 6px; height: 6px; }
    .scrollbar-thin::-webkit-scrollbar-thumb { background: rgba(100,116,139,.4); border-radius: 3px; }
    .bubble-mine { background: linear-gradient(135deg,#3b82f6,#2563eb); color:white; }
    .bubble-other { background: rgb(241 245 249); color: rgb(15 23 42); }
    :host-context(.dark) .bubble-other { background: rgb(30 41 59); color: rgb(241 245 249); }
    .reaction-pill { font-size: .75rem; line-height: 1; }
  `],
})
export class MessagingPageComponent implements OnInit, OnDestroy {
  @ViewChild('threadEnd') threadEnd?: ElementRef<HTMLDivElement>;

  // ----- state -----
  meId = signal('');
  meName = signal('');
  conversations = signal<ConversationDTO[]>([]);
  selectedId = signal<string | null>(null);
  selected = computed<ConversationDTO | null>(() => {
    const id = this.selectedId();
    return id ? this.conversations().find(c => c.conversation.id === id) ?? null : null;
  });
  messages = signal<ChatMessage[]>([]);
  reactionsByMsg = signal<Record<string, Reaction[]>>({});
  composerText = '';
  loading = signal(false);
  errorMsg = signal('');
  searchTerm = '';

  // user directory (for new conversation modal + resolving IDs to names)
  directory = signal<DirectoryUser[]>([]);
  directoryLoaded = false;
  /** Lookup map userId -> DirectoryUser (built from directory()). */
  private userMap = new Map<string, DirectoryUser>();
  /** Cache of resolved private-conv "other party" userIds, keyed by conversationId. */
  private otherPartyCache = new Map<string, string>();
  /** Conversations whose participants we already fetched (or are fetching).
   *  Prevents an infinite HTTP loop when the template re-renders and calls
   *  conversationLabel() repeatedly. */
  private otherPartyFetched = new Set<string>();

  // modals
  showNewConv = signal(false);
  newConvType: 'PRIVATE' | 'GROUP' = 'PRIVATE';
  newGroupName = '';
  newGroupDescription = '';
  newConvSelectedUsers = signal<string[]>([]);
  directorySearch = '';

  showGameModal = signal(false);
  gameCategory = 'Culture générale';
  gameDifficulty: Difficulty = 'EASY';
  gameQuestions = 5;
  gameTimeLimit = 30;

  // active game state in current conv
  activeGame = signal<GameSession | null>(null);
  gameAnswered = signal(false);
  gameQuestionStart = 0;

  // hover reaction picker
  reactionPickerFor = signal<string | null>(null);

  // ----- subs -----
  private subs: Subscription[] = [];

  constructor(
    public msg: MessagingService,
    private auth: AuthService,
    private http: HttpClient,
  ) {}

  // ==========================================================================
  ngOnInit(): void {
    const u = this.auth.getCurrentUser();
    if (!u) { this.errorMsg.set('Non connecté'); return; }
    this.meId.set(u.id || u.userId || '');
    this.meName.set(`${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email || 'Moi');

    this.msg.connect();
    // Load user directory eagerly so we can resolve IDs -> names everywhere
    // (conversation labels, avatars, headers, sender names in thread).
    this.loadDirectory(() => this.loadConversations());

    this.subs.push(this.msg.incomingMessage$.subscribe(m => this.onIncomingMessage(m)));
    this.subs.push(this.msg.incomingReactions$.subscribe(({ messageId, reactions }) => {
      this.reactionsByMsg.update(r => ({ ...r, [messageId]: reactions }));
    }));
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
    const id = this.selectedId();
    if (id) this.msg.unsubscribeConversation(id);
  }

  // ----- conversations ------------------------------------------------------
  loadConversations(): void {
    if (!this.meId()) return;
    this.loading.set(true);
    this.msg.listConversations(this.meId()).subscribe({
      next: list => {
        this.conversations.set(list || []);
        this.loading.set(false);
        if (!this.selectedId() && list?.length) {
          this.selectConversation(list[0].conversation.id!);
        }
      },
      error: e => {
        this.loading.set(false);
        this.errorMsg.set('Erreur chargement conversations: ' + (e.error?.message || e.message || ''));
      }
    });
  }

  selectConversation(id: string): void {
    if (this.selectedId() === id) return;
    const prev = this.selectedId();
    if (prev) this.msg.unsubscribeConversation(prev);
    this.selectedId.set(id);
    this.messages.set([]);
    this.reactionsByMsg.set({});
    this.activeGame.set(null);

    this.msg.subscribeConversation(id);

    this.msg.listMessages(id, this.meId()).subscribe({
      next: msgs => {
        this.messages.set(msgs || []);
        this.loadAllReactions(id, msgs || []);
        this.scrollToBottom();
      },
      error: e => this.errorMsg.set('Erreur chargement messages: ' + (e.error?.message || e.message || '')),
    });

    // Active game?
    this.msg.getActiveGame(id).subscribe({
      next: g => this.activeGame.set(g || null),
      error: () => this.activeGame.set(null),
    });

    // Mark as read
    this.msg.markConversationRead(id, this.meId()).subscribe({ next: () => {}, error: () => {} });
  }

  conversationLabel(c: ConversationDTO): string {
    const conv = c.conversation;
    // GROUP : the stored name is the actual group name.
    if (conv.type === 'GROUP') return conv.nom || 'Groupe sans nom';
    // PRIVATE : the stored `nom` is the other participant's userId.
    // Resolve to real name via directory; fall back to participant fetch.
    const otherId = (conv.nom && conv.nom !== this.meId() && this.userMap.has(conv.nom))
      ? conv.nom
      : this.resolveOtherParty(conv);
    const u = this.userById(otherId);
    if (u) return this.fullName(u);
    // Last resort: short ID label so the user sees *something* readable.
    return otherId ? `Membre ${otherId.substring(0, 6)}…` : 'Conversation privée';
  }

  conversationInitials(c: ConversationDTO): string {
    const conv = c.conversation;
    if (conv.type === 'GROUP') {
      const n = conv.nom || 'GR';
      return n.split(/\s+/).slice(0, 2).map(s => s[0]).join('').toUpperCase() || 'GR';
    }
    const otherId = (conv.nom && conv.nom !== this.meId() && this.userMap.has(conv.nom))
      ? conv.nom
      : (this.otherPartyCache.get(conv.id || '') || '');
    const u = this.userById(otherId);
    if (u) {
      const f = (u.firstName || '?').charAt(0);
      const l = (u.lastName || '').charAt(0);
      return (f + l).toUpperCase() || '?';
    }
    return '?';
  }

  filteredConversations = computed(() => {
    const t = this.searchTerm.trim().toLowerCase();
    const list = this.conversations();
    if (!t) return list;
    return list.filter(c =>
      this.conversationLabel(c).toLowerCase().includes(t)
      || (c.lastMessageContent || '').toLowerCase().includes(t)
    );
  });

  // ----- messages -----------------------------------------------------------
  onIncomingMessage(m: ChatMessage): void {
    if (m.conversationId !== this.selectedId()) {
      // refresh sidebar last-message preview
      this.loadConversations();
      return;
    }
    this.messages.update(msgs => {
      // If message is an update (edit/delete) of existing one, replace.
      const idx = msgs.findIndex(x => x.id === m.id);
      if (idx >= 0) { const copy = msgs.slice(); copy[idx] = m; return copy; }
      return [...msgs, m];
    });
    if (m.id) this.loadReactions(this.selectedId()!, m.id);
    this.scrollToBottom();
  }

  send(): void {
    const text = this.composerText.trim();
    const cid = this.selectedId();
    if (!text || !cid || !this.meId()) return;
    const payload: ChatMessage = {
      conversationId: cid,
      senderId: this.meId(),
      content: text,
      type: 'TEXT',
    };
    this.msg.sendMessage(cid, payload).subscribe({
      next: () => { this.composerText = ''; },
      error: e => this.errorMsg.set('Envoi échoué: ' + (e.error?.message || e.message || '')),
    });
  }

  onComposerKey(ev: KeyboardEvent): void {
    if (ev.key === 'Enter' && !ev.shiftKey) {
      ev.preventDefault();
      this.send();
    }
  }

  deleteMessage(m: ChatMessage): void {
    const cid = this.selectedId();
    if (!cid || !m.id) return;
    if (m.senderId !== this.meId()) return;
    this.msg.deleteMessage(cid, m.id).subscribe({ error: e => this.errorMsg.set('Suppression échouée') });
  }

  // ----- reactions ----------------------------------------------------------
  loadAllReactions(cid: string, msgs: ChatMessage[]): void {
    const next: Record<string, Reaction[]> = {};
    let pending = msgs.length;
    if (!pending) { this.reactionsByMsg.set({}); return; }
    msgs.forEach(m => {
      if (!m.id) { pending--; return; }
      this.msg.subscribeReactions(m.id);
      this.msg.listReactions(cid, m.id).subscribe({
        next: rs => { next[m.id!] = rs || []; if (--pending <= 0) this.reactionsByMsg.set(next); },
        error: () => { if (--pending <= 0) this.reactionsByMsg.set(next); },
      });
    });
  }

  loadReactions(cid: string, mid: string): void {
    this.msg.subscribeReactions(mid);
    this.msg.listReactions(cid, mid).subscribe({
      next: rs => this.reactionsByMsg.update(r => ({ ...r, [mid]: rs })),
    });
  }

  toggleReaction(m: ChatMessage, emoji: EmojiType): void {
    const cid = this.selectedId();
    if (!cid || !m.id || !this.meId()) return;
    this.msg.toggleReaction(cid, m.id, this.meId(), emoji).subscribe({
      next: rs => this.reactionsByMsg.update(r => ({ ...r, [m.id!]: rs })),
    });
    this.reactionPickerFor.set(null);
  }

  emojiKeys(): EmojiType[] { return ['LIKE', 'LOVE', 'HAHA', 'NOTBAD', 'GREATJOB']; }
  emojiOf(e: EmojiType): string { return EMOJI_LABELS[e]; }

  groupedReactions(mid: string | undefined): { emoji: EmojiType; count: number; mine: boolean }[] {
    if (!mid) return [];
    const list = this.reactionsByMsg()[mid] || [];
    const map = new Map<EmojiType, { count: number; mine: boolean }>();
    list.forEach(r => {
      const e = r.emoji;
      const cur = map.get(e) || { count: 0, mine: false };
      cur.count++;
      if (r.userId === this.meId()) cur.mine = true;
      map.set(e, cur);
    });
    return Array.from(map.entries()).map(([emoji, v]) => ({ emoji, count: v.count, mine: v.mine }));
  }

  // ----- image upload -------------------------------------------------------
  onPickFile(ev: Event): void {
    const file = (ev.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const cid = this.selectedId();
    if (!cid) return;
    this.msg.uploadImage(file).subscribe({
      next: ({ url }) => {
        this.msg.sendMessage(cid, {
          conversationId: cid, senderId: this.meId(),
          content: url, type: 'IMAGE',
        }).subscribe();
      },
      error: e => this.errorMsg.set('Upload échoué: ' + (e.error?.message || e.message || '')),
    });
    (ev.target as HTMLInputElement).value = '';
  }

  isImageContent(m: ChatMessage): boolean {
    return m.type === 'IMAGE' || /^(\/api\/images\/|https?:\/\/.*\.(png|jpe?g|gif|webp))/.test(m.content || '');
  }

  imageSrc(m: ChatMessage): string {
    const c = m.content || '';
    if (c.startsWith('http')) return c;
    if (c.startsWith('/api/images/')) return apiUrl(c);
    return c;
  }

  // ----- scroll -------------------------------------------------------------
  scrollToBottom(): void {
    queueMicrotask(() => {
      this.threadEnd?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'end' });
    });
  }

  // ==========================================================================
  // NEW CONVERSATION MODAL
  // ==========================================================================
  openNewConv(): void {
    this.showNewConv.set(true);
    this.newConvType = 'PRIVATE';
    this.newGroupName = '';
    this.newGroupDescription = '';
    this.newConvSelectedUsers.set([]);
    this.directorySearch = '';
    if (!this.directoryLoaded) this.loadDirectory();
  }

  /** When the user clicks the avatar/header in the active conv, hint the name. */
  selectedLabel(): string {
    const s = this.selected();
    return s ? this.conversationLabel(s) : '';
  }
  selectedInitials(): string {
    const s = this.selected();
    return s ? this.conversationInitials(s) : '?';
  }

  loadDirectory(then?: () => void): void {
    this.http.get<DirectoryUser[]>(apiUrl('/api/users')).subscribe({
      next: list => {
        const all = list || [];
        // Keep ALL users in userMap (including me) so sender labels resolve correctly.
        this.userMap = new Map(all.map(u => [(u.id || u.userId || ''), u]));
        // Directory shown in "new conversation" modal excludes me.
        this.directory.set(all.filter(u => (u.id || u.userId) !== this.meId()));
        this.directoryLoaded = true;
        if (then) then();
      },
      error: () => {
        this.errorMsg.set('Impossible de charger la liste des membres');
        if (then) then();
      },
    });
  }

  /** Find a user by id in the directory map. Returns undefined if not found. */
  private userById(id: string | undefined): DirectoryUser | undefined {
    return id ? this.userMap.get(id) : undefined;
  }

  private fullName(u: DirectoryUser | undefined): string {
    if (!u) return '';
    const n = `${u.firstName || ''} ${u.lastName || ''}`.trim();
    return n || u.email || '';
  }

  /**
   * For private conversations, the backend stores `nom = otherUserId`.
   * If we are the "other side" (nom == meId), we resolve via cached
   * participants. This lazy-fetches participants once per conversation.
   */
  private resolveOtherParty(c: Conversation): string {
    if (!c.id) return '';
    const cached = this.otherPartyCache.get(c.id);
    if (cached) return cached;
    // First guess : the stored nom (if it's an ID and not me)
    if (c.nom && c.nom !== this.meId() && this.userMap.has(c.nom)) {
      this.otherPartyCache.set(c.id, c.nom);
      return c.nom;
    }
    // Fallback : ask participants list ONCE per conversation. Without this
    // guard, the template's call to conversationLabel() during each re-render
    // would re-fire the HTTP request, mutate the conversations signal in the
    // subscribe callback, retrigger CD, and loop until the tab freezes.
    if (this.otherPartyFetched.has(c.id)) return '';
    this.otherPartyFetched.add(c.id);
    const cid = c.id;
    this.msg.listParticipants(cid).subscribe({
      next: parts => {
        const other = (parts || []).map(p => p.userId).find(uid => uid && uid !== this.meId());
        if (other) {
          this.otherPartyCache.set(cid, other);
          // Reassign once to push the new label through CD. Safe because
          // the fetched-set above guarantees we won't refetch on the next
          // render cycle.
          this.conversations.update(arr => arr.slice());
        }
      },
      error: () => {
        // Allow one retry on error: drop from the fetched-set so the next
        // genuine reload (e.g. user clicks refresh) tries again.
        this.otherPartyFetched.delete(cid);
      },
    });
    return '';
  }

  filteredDirectory = computed<DirectoryUser[]>(() => {
    const t = (this.directorySearch || '').trim().toLowerCase();
    const list = this.directory();
    if (!t) return list;
    return list.filter(u =>
      (`${u.firstName} ${u.lastName} ${u.email}`).toLowerCase().includes(t)
    );
  });

  toggleSelectUser(uid: string): void {
    this.newConvSelectedUsers.update(arr => arr.includes(uid) ? arr.filter(x => x !== uid) : [...arr, uid]);
  }

  isUserSelected(uid: string): boolean { return this.newConvSelectedUsers().includes(uid); }

  createConv(): void {
    const sel = this.newConvSelectedUsers();
    if (this.newConvType === 'PRIVATE') {
      if (sel.length !== 1) { this.errorMsg.set('Sélectionne un utilisateur'); return; }
      this.msg.createPrivate(this.meId(), sel[0]).subscribe({
        next: c => {
          this.showNewConv.set(false);
          this.loadConversations();
          if (c.id) setTimeout(() => this.selectConversation(c.id!), 300);
        },
        error: e => this.errorMsg.set('Échec création: ' + (e.error?.message || e.message || '')),
      });
    } else {
      if (!this.newGroupName.trim()) { this.errorMsg.set('Donne un nom au groupe'); return; }
      if (sel.length < 1) { this.errorMsg.set('Ajoute au moins 1 membre au groupe'); return; }
      const conv: Conversation = {
        nom: this.newGroupName.trim(),
        description: this.newGroupDescription.trim(),
        type: 'GROUP',
        createdByUserId: this.meId(),
      };
      this.msg.createGroup(conv).subscribe({
        next: c => {
          if (!c.id) return;
          // Add creator as SUPERADMIN
          this.msg.addParticipant(c.id, this.meId(), 'SUPERADMIN').subscribe();
          // Add selected users
          let pending = sel.length;
          sel.forEach(uid => this.msg.addParticipant(c.id!, uid, 'MEMBRE').subscribe({
            next: () => { if (--pending <= 0) { this.showNewConv.set(false); this.loadConversations(); setTimeout(() => this.selectConversation(c.id!), 300); } },
            error: () => { if (--pending <= 0) { this.showNewConv.set(false); this.loadConversations(); } },
          }));
        },
        error: e => this.errorMsg.set('Échec création groupe: ' + (e.error?.message || e.message || '')),
      });
    }
  }

  // ==========================================================================
  // GAME (TRIVIA) MODAL
  // ==========================================================================
  openGame(): void {
    if (!this.selectedId()) return;
    this.showGameModal.set(true);
    this.gameCategory = 'Culture générale';
    this.gameDifficulty = 'EASY';
    this.gameQuestions = 5;
    this.gameTimeLimit = 30;
  }

  startGameFlow(): void {
    const cid = this.selectedId();
    if (!cid) return;
    this.msg.createGame({
      conversationId: cid,
      createdBy: this.meId(),
      category: this.gameCategory,
      difficulty: this.gameDifficulty,
      totalQuestions: this.gameQuestions,
      timeLimitPerQuestion: this.gameTimeLimit,
    }).subscribe({
      next: g => {
        this.showGameModal.set(false);
        // Auto-join + start
        this.msg.joinGame(g.id!, this.meId()).subscribe({
          next: () => this.msg.startGame(g.id!, this.meId()).subscribe({
            next: started => { this.activeGame.set(started); this.gameAnswered.set(false); this.gameQuestionStart = Date.now(); },
            error: e => this.errorMsg.set('Démarrage jeu échoué: ' + (e.error?.message || e.message || '')),
          }),
          error: () => {},
        });
      },
      error: e => this.errorMsg.set('Création jeu échouée: ' + (e.error?.message || e.message || 'Vérifie GROQ_API_KEY')),
    });
  }

  joinExistingGame(): void {
    const g = this.activeGame();
    if (!g?.id) return;
    this.msg.joinGame(g.id, this.meId()).subscribe({
      next: gs => this.activeGame.set(gs),
      error: e => this.errorMsg.set('Join échoué: ' + (e.error?.message || e.message || '')),
    });
  }

  currentQuestion() {
    const g = this.activeGame();
    if (!g) return null;
    return g.questions?.[g.currentQuestionIndex] ?? null;
  }

  answer(opt: string): void {
    const g = this.activeGame();
    if (!g?.id || this.gameAnswered()) return;
    this.gameAnswered.set(true);
    const responseTimeMs = Date.now() - this.gameQuestionStart;
    this.msg.submitAnswer(g.id, {
      questionIndex: g.currentQuestionIndex,
      userId: this.meId(),
      selectedAnswer: opt,
      responseTimeMs,
    }).subscribe({
      next: () => {
        // refresh game state to show next question
        setTimeout(() => this.refreshGame(), 1500);
      },
      error: e => { this.gameAnswered.set(false); this.errorMsg.set('Réponse rejetée: ' + (e.error?.message || e.message || '')); },
    });
  }

  refreshGame(): void {
    const cid = this.selectedId();
    if (!cid) return;
    this.msg.getActiveGame(cid).subscribe({
      next: g => {
        this.activeGame.set(g);
        this.gameAnswered.set(false);
        this.gameQuestionStart = Date.now();
      },
      error: () => this.activeGame.set(null),
    });
  }

  closeGame(): void { this.activeGame.set(null); }

  // ----- helpers ------------------------------------------------------------
  isMine(m: ChatMessage): boolean { return m.senderId === this.meId(); }

  senderLabel(m: ChatMessage): string {
    if (this.isMine(m)) return 'Moi';
    const u = this.userById(m.senderId);
    if (u) return this.fullName(u) || m.senderId.substring(0, 6) + '…';
    return m.senderId.substring(0, 6) + '…';
  }

  dismissError(): void { this.errorMsg.set(''); }
}
