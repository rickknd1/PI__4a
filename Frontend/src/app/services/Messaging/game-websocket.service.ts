import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { WebSocketService } from './websocket.service';
import { StompSubscription } from '@stomp/stompjs';
import { GameEvent } from '../../models/game.model';

@Injectable({ providedIn: 'root' })
export class GameWebSocketService implements OnDestroy {
    private gameSubscriptions: Map<string, StompSubscription> = new Map();
    private currentConversationId: string | null = null;

    private gameEventSubject = new BehaviorSubject<GameEvent | null>(null);
    public gameEvent$ = this.gameEventSubject.asObservable();

    constructor(private webSocketService: WebSocketService) {
        this.webSocketService.connect();
    }

    subscribeToGameEvents(conversationId: string): void {
        this.unsubscribeFromGameEvents();
        this.currentConversationId = conversationId;
        const topic = `/topic/game/${conversationId}`;

        this.webSocketService.subscribeToTopicAsync(topic, (event: any) => {
            console.log('🎮 Game event received:', event);
            this.gameEventSubject.next(event);
        }).then(sub => {
            if (sub) {
                this.gameSubscriptions.set(conversationId, sub);
                console.log(`🎮 Subscribed to game topic: ${topic}`);
            }
        });
    }

    unsubscribeFromGameEvents(): void {
        if (this.currentConversationId) {
            const sub = this.gameSubscriptions.get(this.currentConversationId);
            if (sub) {
                sub.unsubscribe();
                this.gameSubscriptions.delete(this.currentConversationId);
            }
        }
        this.currentConversationId = null;
    }

    // Expose so ChatWindow can push restored game state into the stream
    emitEvent(event: GameEvent): void {
        this.gameEventSubject.next(event);
    }

    ngOnDestroy(): void {
        this.unsubscribeFromGameEvents();
        this.gameEventSubject.complete();
    }
}