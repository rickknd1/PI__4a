import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ConversationDTO } from "../../models/conversation.model";
import { ConversationService } from "../../services/Messaging/conversation.service";
import { ChatWindowComponent } from "../chat-window/chat-window.component";
import { NewPrivateChatModalComponent } from "../NewPrivateChatModalComponent/new-private-chat-modal.component";
import { NewGroupChatModalComponent } from "../new-group-chat-modal/new-group-chat-modal.component";
import { AuthService } from "../../shared/services/auth.service";
import { WebSocketService } from "../../services/Messaging/websocket.service";
import { Subscription } from 'rxjs';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-conversation-list',
  standalone: true,
  imports: [
    CommonModule,
    ChatWindowComponent,
    NewPrivateChatModalComponent,
    NewGroupChatModalComponent,
    FormsModule
  ],
  templateUrl: './conversation-list.component.html',
  styleUrls: ['./conversation-list.component.css'],
  host: { class: 'flex flex-col flex-1 min-h-0 overflow-hidden' }
})
export class ConversationListComponent implements OnInit, OnDestroy {

  conversations: ConversationDTO[] = [];
  selectedConversation: ConversationDTO | null = null;
  currentUserId: string = '';

  showNewGroupModal = false;
  showNewChatModal = false;
  sidebarOpen = true;

  activeFilter: 'ALL' | 'PRIVATE' | 'GROUP' = 'ALL';
  searchQuery = '';

  filterTabs = [
    { label: 'All', value: 'ALL' as const },
    { label: 'Private', value: 'PRIVATE' as const },
    { label: 'Groups', value: 'GROUP' as const },
  ];

  private wsSub?: Subscription;
  private conversationSubscriptions: Set<string> = new Set();

  constructor(
      private conversationService: ConversationService,
      private authService: AuthService,
      private webSocketService: WebSocketService
  ) {}

  ngOnInit(): void {
    const user = this.authService.getCurrentUser();
    this.currentUserId = user?.userId ?? '';

    if (this.currentUserId) {
      this.loadConversations();

      setTimeout(() => {
        this.webSocketService.connect?.();
        this.listenForNewMessages();
      }, 600);
    }
  }

  ngOnDestroy(): void {
    this.wsSub?.unsubscribe();
    // Cleanup subscriptions
    this.conversationSubscriptions.forEach(id => {
      this.webSocketService.unsubscribeFromConversation(id);
    });
  }

  private listenForNewMessages(): void {
    this.wsSub?.unsubscribe();

    this.wsSub = this.webSocketService.message$.subscribe((msg: any) => {
      if (!msg?.conversationId) return;

      console.log('🟢 [LIST] WebSocket message received for conv:', msg.conversationId, msg);

      const index = this.conversations.findIndex(c => c.id === msg.conversationId);
      if (index === -1) return;

      const conv = { ...this.conversations[index] };

      // Update last message
      if (msg.type === 'IMAGE') conv.lastMessageContent = 'someone sent a photo';
      else if (msg.type === 'FILE') conv.lastMessageContent = 'someone sent a file';
      else conv.lastMessageContent = msg.content || '';

      conv.lastMessageAt = msg.createdAt || new Date().toISOString();
      if (msg.senderId) conv.lastMessageSender = msg.senderId;

      const isCurrentlySelected = this.selectedConversation?.id === msg.conversationId;

      if (msg.senderId !== this.currentUserId && !isCurrentlySelected) {
        conv.unreadCount = (conv.unreadCount || 0) + 1;
        console.log(`Unread count increased → ${conv.unreadCount} for ${msg.conversationId}`);
      }

      this.conversations = [
        conv,
        ...this.conversations.filter(c => c.id !== msg.conversationId)
      ];
    });
  }

  // Load conversations and subscribe to ALL of them for real-time updates
  loadConversations() {
    // 1. Charger tous les users d'abord pour pouvoir resolver les noms PRIVATE
    this.conversationService.loadAllUsers().subscribe({
      next: (allUsers: any[]) => {
        const usersById = new Map<string, string>();
        (allUsers || []).forEach((u: any) => {
          if (u.userId) usersById.set(u.userId, u.fullName || u.userId);
        });

        // 2. Charger les conversations et resolver les noms PRIVATE
        this.conversationService.getAll(this.currentUserId).subscribe({
          next: (data: any[]) => {
            this.conversations = data.map(item => {
              const convData = item.conversation || item;
              let displayName = (convData.nom && convData.nom.trim() !== '') ? convData.nom.trim() : 'Unnamed';

              // Pour les conversations PRIVATE, le backend stocke `nom` = userId du
              // destinataire (et `createdByUserId` = userId du createur). L'autre party
              // pour le user courant est donc :
              //   - Si nom === moi → autre = createdByUserId
              //   - Sinon          → autre = nom
              if (convData.type === 'PRIVATE') {
                const otherUserId = (convData.nom === this.currentUserId)
                  ? convData.createdByUserId
                  : convData.nom;
                if (otherUserId && usersById.has(otherUserId)) {
                  displayName = usersById.get(otherUserId)!;
                } else if (otherUserId) {
                  displayName = 'Membre inconnu';
                }
              }

              return {
                ...convData,
                nom: displayName,
                lastMessageContent: item.lastMessageContent || convData.lastMessageContent || null,
                lastMessageAt: item.lastMessageAt || convData.lastMessageAt || null,
                unreadCount: Number(item.unreadCount || 0)
              } as ConversationDTO;
            }).sort((a, b) => {
              const dateA = new Date(a.lastMessageAt || 0).getTime();
              const dateB = new Date(b.lastMessageAt || 0).getTime();
              return dateB - dateA;
            });

            this.conversations = [...this.conversations];
            this.subscribeToAllConversations();
          },
          error: (err) => console.error('Error loading conversations:', err)
        });
      },
      error: () => {
        // Fallback si users API down : charger conversations sans resolver noms
        this.conversationService.getAll(this.currentUserId).subscribe({
          next: (data: any[]) => {
            this.conversations = data.map(item => {
              const convData = item.conversation || item;
              return {
                ...convData,
                nom: (convData.nom && convData.nom.trim() !== '') ? convData.nom.trim() : 'Unnamed',
                lastMessageContent: item.lastMessageContent || convData.lastMessageContent || null,
                lastMessageAt: item.lastMessageAt || convData.lastMessageAt || null,
                unreadCount: Number(item.unreadCount || 0)
              } as ConversationDTO;
            });
            this.subscribeToAllConversations();
          },
          error: (err) => console.error('Error loading conversations:', err)
        });
      }
    });
  }

  private subscribeToAllConversations() {
    this.conversations.forEach(conv => {
      if (!this.conversationSubscriptions.has(conv.id)) {
        this.webSocketService.subscribeToConversation(conv.id);
        this.conversationSubscriptions.add(conv.id);
        console.log(`📡 Subscribed to conversation: ${conv.id}`);
      }
    });
  }

  selectConversation(conv: ConversationDTO) {
    this.selectedConversation = { ...conv };

    if (conv.unreadCount && conv.unreadCount > 0) {
      this.markAsRead(conv);
    }
  }

  private markAsRead(conv: ConversationDTO) {
    if (!conv) return;

    this.conversationService.markAsRead(conv.id, this.currentUserId).subscribe({
      next: () => {
        const listConv = this.conversations.find(c => c.id === conv.id);
        if (listConv) listConv.unreadCount = 0;
        this.conversations = [...this.conversations];
        console.log(`Marked as read for ${conv.id}`);
      },
      error: (err) => console.error('Failed to mark as read', err)
    });
  }

  // ==================== Rest of methods ====================

  openNewChatModal() { this.showNewChatModal = true; }
  closeNewChatModal() { this.showNewChatModal = false; }

  onConversationCreated(newConv: any) {
    this.loadConversations();
    this.closeNewChatModal();
    if (newConv?.id) this.selectConversation(newConv);
  }

  onConversationLeft(): void {
    this.selectedConversation = null;
    this.loadConversations();
  }

  getAvatarInitial(nom: string): string {
    if (!nom || nom === 'Unnamed') return '?';
    return nom.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  }

  get filteredConversations(): ConversationDTO[] {
    return this.conversations.filter(conv => {
      const matchesFilter = this.activeFilter === 'ALL' || conv.type === this.activeFilter;
      const matchesSearch = !this.searchQuery ||
          conv.nom?.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
          conv.lastMessageContent?.toLowerCase().includes(this.searchQuery.toLowerCase());
      return matchesFilter && matchesSearch;
    });
  }

  toggleSidebar() {
    this.sidebarOpen = !this.sidebarOpen;
  }

  onConvImageError(event: any): void {
    console.warn('Failed to load conversation image:', event.target.src);
    if (event.target) event.target.style.display = 'none';
  }
}