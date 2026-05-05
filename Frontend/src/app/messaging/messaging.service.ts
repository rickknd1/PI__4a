import { Injectable, signal, OnDestroy } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, Subject, BehaviorSubject } from 'rxjs';
import { Client, IMessage, StompSubscription } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { apiUrl } from '../../environments/environment';

// ============================================================================
//  Types
// ============================================================================
export type ConversationType = 'PRIVATE' | 'GROUP';
export type MessageType = 'TEXT' | 'IMAGE' | 'FILE';
export type EmojiType = 'LIKE' | 'LOVE' | 'HAHA' | 'NOTBAD' | 'GREATJOB';
export type Difficulty = 'EASY' | 'MEDIUM' | 'HARD';
export type GameStatus = 'WAITING' | 'IN_PROGRESS' | 'FINISHED';

export interface Theme {
  name?: string;
  primaryColor?: string;
  accentColor?: string;
  bubbleColor?: string;
  backgroundColor?: string;
  isGradient?: boolean;
  gradientEndColor?: string;
  backgroundImageUrl?: string;
}

export interface Conversation {
  id?: string;
  nom: string;
  description?: string;
  type: ConversationType;
  createdByUserId?: string;
  createdAt?: string;
  lastMessageId?: string;
  photoUrl?: string;
  theme?: Theme;
}

export interface ConversationDTO {
  conversation: Conversation;
  lastMessageContent?: string;
  lastMessageSenderId?: string;
  lastMessageAt?: string;
  unreadCount?: number;
}

export interface MessageReceipt {
  userId: string;
  readAt?: string;
}

export interface ChatMessage {
  id?: string;
  conversationId: string;
  senderId: string;
  content: string;
  type: MessageType;
  parentMessageId?: string;
  createdAt?: string;
  edited?: boolean;
  deleted?: boolean;
  parentMessageContent?: string;
  receipts?: MessageReceipt[];
}

export interface Reaction {
  id?: string;
  messageId: string;
  userId: string;
  emoji: EmojiType;
  createdAt?: string;
}

export interface GameQuestion {
  index: number;
  questionText: string;
  options: string[];
  correctAnswer: string;
  aiFunFact?: string;
  aiWrongExplanation?: string;
  revealed?: boolean;
}

export interface GameSession {
  id?: string;
  conversationId: string;
  createdBy: string;
  status: GameStatus;
  category: string;
  difficulty: Difficulty;
  totalQuestions: number;
  timeLimitPerQuestion: number;
  currentQuestionIndex: number;
  questions: GameQuestion[];
  players: string[];
  startedAt?: string;
  finishedAt?: string;
}

export interface CreateGameRequest {
  conversationId: string;
  createdBy: string;
  category: string;
  difficulty: Difficulty;
  totalQuestions: number;
  timeLimitPerQuestion: number;
}

// ============================================================================
//  Service
// ============================================================================
const MESSAGING_DIRECT = 'http://localhost:8089';

@Injectable({ providedIn: 'root' })
export class MessagingService implements OnDestroy {

  private stomp?: Client;
  private subs = new Map<string, StompSubscription>();
  private reactionSubs = new Map<string, StompSubscription>();

  /** Stream of messages received in real-time, keyed by conversationId. */
  readonly incomingMessage$ = new Subject<ChatMessage>();
  /** Stream of reaction updates: { messageId, reactions } */
  readonly incomingReactions$ = new Subject<{ messageId: string; reactions: Reaction[] }>();
  readonly connected = signal(false);

  constructor(private http: HttpClient) {}

  ngOnDestroy(): void {
    this.disconnect();
  }

  // ---- HTTP : Conversations ------------------------------------------------
  listConversations(userId: string): Observable<ConversationDTO[]> {
    return this.http.get<ConversationDTO[]>(apiUrl('/api/conversations'), {
      params: new HttpParams().set('userId', userId),
    });
  }

  getConversation(id: string): Observable<Conversation> {
    return this.http.get<Conversation>(apiUrl(`/api/conversations/${id}`));
  }

  createGroup(c: Conversation): Observable<Conversation> {
    return this.http.post<Conversation>(apiUrl('/api/conversations'), c);
  }

  createPrivate(userId1: string, userId2: string): Observable<Conversation> {
    return this.http.post<Conversation>(apiUrl('/api/conversations/private'), null, {
      params: new HttpParams().set('userId1', userId1).set('userId2', userId2),
    });
  }

  updateConversationName(id: string, name: string): Observable<Conversation> {
    return this.http.patch<Conversation>(apiUrl(`/api/conversations/${id}/name`), { name });
  }

  markConversationRead(conversationId: string, userId: string): Observable<any> {
    return this.http.put(apiUrl(`/api/conversations/${conversationId}/read`), { userId });
  }

  // ---- HTTP : Messages -----------------------------------------------------
  listMessages(conversationId: string, userId?: string): Observable<ChatMessage[]> {
    const params = userId ? new HttpParams().set('userId', userId) : undefined;
    return this.http.get<ChatMessage[]>(
      apiUrl(`/api/conversations/${conversationId}/messages`),
      { params },
    );
  }

  sendMessage(conversationId: string, msg: ChatMessage): Observable<ChatMessage> {
    return this.http.post<ChatMessage>(
      apiUrl(`/api/conversations/${conversationId}/messages`),
      msg,
    );
  }

  editMessage(conversationId: string, id: string, msg: ChatMessage): Observable<ChatMessage> {
    return this.http.put<ChatMessage>(
      apiUrl(`/api/conversations/${conversationId}/messages/${id}`),
      msg,
    );
  }

  deleteMessage(conversationId: string, id: string): Observable<ChatMessage> {
    return this.http.delete<ChatMessage>(
      apiUrl(`/api/conversations/${conversationId}/messages/${id}`),
    );
  }

  // ---- HTTP : Participants -------------------------------------------------
  listParticipants(conversationId: string): Observable<any[]> {
    return this.http.get<any[]>(apiUrl(`/api/conversations/${conversationId}/participants`));
  }

  addParticipant(conversationId: string, userId: string, role: string = 'MEMBRE'): Observable<any> {
    return this.http.post<any>(apiUrl(`/api/conversations/${conversationId}/participants`), {
      conversationId, userId, role,
    });
  }

  // ---- HTTP : Reactions ----------------------------------------------------
  listReactions(conversationId: string, messageId: string): Observable<Reaction[]> {
    return this.http.get<Reaction[]>(
      apiUrl(`/api/conversations/${conversationId}/messages/${messageId}/reactions`),
    );
  }

  toggleReaction(conversationId: string, messageId: string, userId: string, emoji: EmojiType): Observable<Reaction[]> {
    return this.http.post<Reaction[]>(
      apiUrl(`/api/conversations/${conversationId}/messages/${messageId}/reactions`),
      { userId, emoji },
    );
  }

  // ---- HTTP : Games --------------------------------------------------------
  createGame(req: CreateGameRequest): Observable<GameSession> {
    return this.http.post<GameSession>(apiUrl('/api/games/create'), req);
  }

  joinGame(gameId: string, userId: string): Observable<GameSession> {
    return this.http.post<GameSession>(apiUrl(`/api/games/${gameId}/join`), null, {
      params: new HttpParams().set('userId', userId),
    });
  }

  startGame(gameId: string, adminUserId: string): Observable<GameSession> {
    return this.http.post<GameSession>(apiUrl(`/api/games/${gameId}/start`), null, {
      params: new HttpParams().set('adminUserId', adminUserId),
    });
  }

  submitAnswer(gameId: string, body: { questionIndex: number; userId: string; selectedAnswer: string; responseTimeMs: number }): Observable<any> {
    return this.http.post(apiUrl(`/api/games/${gameId}/answer`), body);
  }

  getActiveGame(conversationId: string): Observable<GameSession> {
    return this.http.get<GameSession>(apiUrl(`/api/games/conversation/${conversationId}/active`));
  }

  // ---- HTTP : Image upload -------------------------------------------------
  uploadImage(file: File): Observable<{ url: string }> {
    const fd = new FormData();
    fd.append('file', file);
    return this.http.post<{ url: string }>(apiUrl('/api/images/upload'), fd);
  }

  // ---- WebSocket / STOMP ---------------------------------------------------
  /** Connect once per session. Idempotent. */
  connect(): void {
    if (this.stomp?.active) return;

    this.stomp = new Client({
      // SockJS via direct messaging service (gateway WS forwarding can be flaky)
      webSocketFactory: () => new SockJS(`${MESSAGING_DIRECT}/ws`) as any,
      reconnectDelay: 4000,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
      debug: () => {},
    });

    this.stomp.onConnect = () => {
      this.connected.set(true);
    };
    this.stomp.onDisconnect = () => this.connected.set(false);
    this.stomp.onStompError = (f) => {
      console.warn('[messaging] STOMP error', f.headers['message']);
    };
    this.stomp.activate();
  }

  disconnect(): void {
    this.subs.forEach(s => s.unsubscribe());
    this.subs.clear();
    this.reactionSubs.forEach(s => s.unsubscribe());
    this.reactionSubs.clear();
    this.stomp?.deactivate();
    this.stomp = undefined;
    this.connected.set(false);
  }

  /** Subscribe to a conversation topic — receive messages in real time. */
  subscribeConversation(conversationId: string): void {
    if (!this.stomp || !this.stomp.active) {
      // queue: try again on next connect
      const tryAgain = () => {
        if (this.stomp?.active) this.subscribeConversation(conversationId);
        else setTimeout(tryAgain, 500);
      };
      tryAgain();
      return;
    }
    if (this.subs.has(conversationId)) return;
    const sub = this.stomp.subscribe(`/topic/conversation/${conversationId}`, (frame: IMessage) => {
      try {
        const msg = JSON.parse(frame.body) as ChatMessage;
        this.incomingMessage$.next(msg);
      } catch (e) {
        console.warn('[messaging] invalid frame', e);
      }
    });
    this.subs.set(conversationId, sub);
  }

  unsubscribeConversation(conversationId: string): void {
    const s = this.subs.get(conversationId);
    if (s) { s.unsubscribe(); this.subs.delete(conversationId); }
  }

  subscribeReactions(messageId: string): void {
    if (!this.stomp?.active || this.reactionSubs.has(messageId)) return;
    const sub = this.stomp.subscribe(`/topic/reactions/${messageId}`, (frame: IMessage) => {
      try {
        const data = JSON.parse(frame.body);
        this.incomingReactions$.next(data);
      } catch {}
    });
    this.reactionSubs.set(messageId, sub);
  }

  /** Send via STOMP (alternative to HTTP POST — both broadcast). */
  publishSend(payload: { conversationId: string; senderId: string; content: string; type?: MessageType; parentMessageId?: string }): void {
    if (!this.stomp?.active) return;
    this.stomp.publish({
      destination: '/app/chat.send',
      body: JSON.stringify({ type: 'TEXT', ...payload }),
    });
  }
}
