// src/app/components/Game/game-banner/game-banner.component.ts

import { Component, Input, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { GameService } from '../../services/Messaging/game.service';
import { GameWebSocketService } from '../../services/Messaging/game-websocket.service';
import { GameCreatedEvent, PlayerJoinedEvent } from '../../models/game.model';

@Component({
    selector: 'app-game-banner',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './game-banner.component.html',
    styleUrls: ['./game-banner.component.css']
})
export class GameBannerComponent implements OnInit, OnDestroy {
    @Input() conversationId: string = '';
    @Input() currentUserId: string = '';
    @Output() gameStarted = new EventEmitter<void>();
    @Output() bannerDismissed = new EventEmitter<void>();

    @Input() localGameData: {
        gameId: string;
        category: string;
        totalQuestions: number;        // ← was totalQ
        timeLimitPerQuestion: number;  // ← was timeLimit
        createdBy: string
    } | null = null;
    showBanner = false;
    gameData: GameCreatedEvent | null = null;
    playerCount = 0;
    isCreator = false;
    joining = false;
    hasJoined = false;
    private wsSub?: Subscription;

    constructor(
        private gameService: GameService,
        private gameWsService: GameWebSocketService
    ) {}

    ngOnInit(): void {
        // ✅ FIXED: If local data exists (we created the game), show banner immediately
        if (this.localGameData) {
            this.gameData = {
                type: 'GAME_CREATED',
                gameId: this.localGameData.gameId,
                category: this.localGameData.category,
                createdBy: this.localGameData.createdBy,
                totalQuestions: this.localGameData.totalQuestions,        // ← was totalQ
                timeLimitPerQuestion: this.localGameData.timeLimitPerQuestion,  // ← was timeLimit
                difficulty: 'MEDIUM'
            };
            this.playerCount = 1;
            this.isCreator = this.localGameData.createdBy === this.currentUserId;
            this.hasJoined = this.isCreator;
            this.showBanner = true;
        }
        // Also listen for WebSocket events (for when OTHER users create games)
        this.wsSub = this.gameWsService.gameEvent$.subscribe((event: any) => {
            if (!event) return;

            switch (event.type) {
                case 'GAME_CREATED':
                    // Only show if we don't already have local data
                    if (!this.gameData) {
                        this.gameData = event;
                        this.playerCount = 1;
                        this.isCreator = event.createdBy === this.currentUserId;
                        this.showBanner = true;
                    }
                    break;

                case 'PLAYER_JOINED':
                    if (this.showBanner) {
                        this.playerCount = (event as PlayerJoinedEvent).playerCount;
                    }
                    break;
                case 'GAME_STARTED':
                    this.showBanner = false;
                    this.gameStarted.emit();
                    break;
            }
        });
    }



    ngOnDestroy(): void {
        if (this.wsSub) {
            this.wsSub.unsubscribe();
        }
    }


    joinGame(): void {
        if (!this.gameData?.gameId || !this.currentUserId || this.joining || this.hasJoined) return;

        this.joining = true;
        this.gameService.joinGame(this.gameData.gameId, this.currentUserId).subscribe({
            next: (game) => {
                this.joining = false;
                this.hasJoined = true;
                // Use the actual player count from the server response, not a local increment
                this.playerCount = game.players.length;
            },
            error: (err) => {
                console.error('Failed to join game:', err);
                this.joining = false;
            }
        });
    }

    startGame(): void {
        if (!this.gameData?.gameId || !this.currentUserId) return;

        this.gameService.startGame(this.gameData.gameId, this.currentUserId).subscribe({
            next: () => {
                // Game started event will be received via WebSocket
            },
            error: (err) => {
                console.error('Failed to start game:', err);
            }
        });
    }
    dismissBanner(): void {
        this.showBanner = false;
        this.bannerDismissed.emit();
    }
}