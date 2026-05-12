import { Injectable } from '@angular/core';
import { Client, IMessage, StompSubscription } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import {Subject, BehaviorSubject, ReplaySubject} from 'rxjs';
import { ChatMessage } from '../../models/message.model';
import { Theme } from '../../models/theme.model';

@Injectable({ providedIn: 'root' })
export class WebSocketService {

  private themeSubject = new BehaviorSubject<Theme | null>(null);
  public themeUpdated$ = this.themeSubject.asObservable();
  private client: Client;
  private subscriptions: Map<string, StompSubscription> = new Map();
  private pendingSubscriptions: Set<string> = new Set();
  private isConnected = new BehaviorSubject<boolean>(false);

  private messageSubject = new ReplaySubject<ChatMessage>(10); // keeps last 10 messages
  message$ = this.messageSubject.asObservable();

  // Queue for subscribeToTopic calls that arrive before connection is ready
  private pendingTopicSubscriptions: Array<{ topic: string; callback: (data: any) => void; resolve: (sub: StompSubscription) => void }> = [];

  constructor() {
    this.client = new Client({
      webSocketFactory: () => new SockJS('http://localhost:8089/ws'),
      reconnectDelay: 5000,

      onConnect: () => {
        console.log('✅ WebSocket connecté');
        this.isConnected.next(true);

        // Flush pending conversation subscriptions
        this.pendingSubscriptions.forEach(convId => this.subscribeToConversation(convId));
        this.pendingSubscriptions.clear();

        // Flush pending topic subscriptions (game events etc.)
        this.pendingTopicSubscriptions.forEach(({ topic, callback, resolve }) => {
          const sub = this.client.subscribe(topic, (message: IMessage) => {
            callback(JSON.parse(message.body));
          });
          resolve(sub);
        });
        this.pendingTopicSubscriptions = [];
      },

      onDisconnect: () => {
        console.log('❌ WebSocket déconnecté');
        this.isConnected.next(false);
      },

      onStompError: (frame) => {
        console.error('Erreur STOMP:', frame);
      }
    });
  }

  connect(): void {
    if (!this.client.active && !this.client.connected) {
      this.client.activate();
    }
  }

  disconnect(): void {
    this.client.deactivate();
    this.isConnected.next(false);
  }

  subscribeToConversation(conversationId: string): void {
    const topic = `/topic/conversation/${conversationId}`;
    if (this.subscriptions.has(topic)) return;

    // Queue if not connected yet — onConnect will flush it
    if (!this.client.connected) {
      this.pendingSubscriptions.add(conversationId);
      return;
    }

    const sub = this.client.subscribe(topic, (message: IMessage) => {
      try {
        const event = JSON.parse(message.body);
        if (event.type === 'THEME_UPDATED' && event.theme) {
          this.themeSubject.next(event.theme as Theme);
        } else {
          this.messageSubject.next(event as ChatMessage);
        }
      } catch (e) {
        console.error('Failed to parse WebSocket message:', e);
      }
    });

    this.subscriptions.set(topic, sub);
    console.log(`📡 Subscribed to conversation ${conversationId}`);
  }

  unsubscribeFromConversation(conversationId: string): void {
    const topic = `/topic/conversation/${conversationId}`;
    const sub = this.subscriptions.get(topic);
    if (sub) {
      sub.unsubscribe();
      this.subscriptions.delete(topic);
    }
    this.pendingSubscriptions.delete(conversationId);
  }

  sendMessage(conversationId: string, senderId: string, content: string,
              type: string = 'TEXT', parentMessageId?: string): void {
    if (!this.client.connected) {
      console.error('❌ WebSocket non connecté');
      return;
    }
    this.client.publish({
      destination: '/app/chat.send',
      body: JSON.stringify({ conversationId, senderId, content, type, parentMessageId: parentMessageId || null })
    });
  }

  get connected(): boolean {
    return this.client.connected;
  }

  // Synchronous version — used for reactions (returns null if not connected)
  subscribeToTopic(topic: string, callback: (data: any) => void): StompSubscription | null {
    if (!this.client.connected) return null;
    return this.client.subscribe(topic, (message: IMessage) => {
      callback(JSON.parse(message.body));
    });
  }

// Async version — used for game events (queues if not connected yet)
  subscribeToTopicAsync(topic: string, callback: (data: any) => void): Promise<StompSubscription> {
    return new Promise((resolve) => {
      if (this.client.connected) {
        const sub = this.client.subscribe(topic, (message: IMessage) => {
          callback(JSON.parse(message.body));
        });
        resolve(sub);
      } else {
        this.pendingTopicSubscriptions.push({ topic, callback, resolve });
      }
    });
  }
}