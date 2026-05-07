// src/app/messaging-components/game-launch-modal/game-launch-modal.component.ts

import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {Difficulty, CreateGameRequest, GameSession} from '../../models/game.model';
import { GameService } from '../../services/Messaging/game.service';

@Component({
    selector: 'app-game-launch-modal',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './game-launch-modal.component.html',
    styleUrls: ['./game-launch-modal.component.css']
})
export class GameLaunchModalComponent implements OnInit {
    @Output() close = new EventEmitter<void>();

    @Output() gameCreated = new EventEmitter<GameSession>();
    @Input() conversationId: string = '';
    @Input() userId: string = '';

    readonly categories = [
        { value: 'General Knowledge', icon: '🧠', label: 'General' },
        { value: 'Science', icon: '🔬', label: 'Science' },
        { value: 'History', icon: '📜', label: 'History' },
        { value: 'Geography', icon: '🌍', label: 'Geo' },
        { value: 'Sports', icon: '⚽', label: 'Sports' },
        { value: 'Entertainment', icon: '🎬', label: 'Movies' },
        { value: 'Technology', icon: '💻', label: 'Tech' },
        { value: 'Music', icon: '🎵', label: 'Music' }
    ];

    readonly difficulties = [
        { value: Difficulty.EASY, label: 'Easy', icon: '🌱', desc: 'Relaxed pace with straightforward questions.' },
        { value: Difficulty.MEDIUM, label: 'Medium', icon: '⚔️', desc: 'Balanced timer and general trivia depth.' },
        { value: Difficulty.HARD, label: 'Hard', icon: '🔥', desc: 'Rapid-fire questions for trivia masters.' }
    ];

    readonly questionCounts = [5, 10, 15, 20];
    readonly timeLimits = [10, 15, 20, 30];

    selectedCategory = 'General Knowledge';
    selectedDifficulty = Difficulty.MEDIUM;
    selectedQuestionCount = 10;
    selectedTimeLimit = 20;
    loading = false;
    error: string | null = null;

    constructor(private gameService: GameService) {}

    ngOnInit(): void {
        console.log('🎮 Game Modal Init:', { conversationId: this.conversationId, userId: this.userId });
    }

    // Helper for template to show correct description
    getSelectedDifficultyIndex(): number {
        return this.difficulties.findIndex(d => d.value === this.selectedDifficulty);
    }
    createGame(): void {
        if (!this.conversationId || !this.userId) {
            this.error = 'Session data missing. Please restart the app.';
            return;
        }

        this.loading = true;
        this.error = null;

        const request: CreateGameRequest = {
            conversationId: this.conversationId,
            createdBy: this.userId,
            category: this.selectedCategory,
            difficulty: this.selectedDifficulty,
            totalQuestions: this.selectedQuestionCount,
            timeLimitPerQuestion: this.selectedTimeLimit
        };

        this.gameService.createGame(request).subscribe({
            next: (game) => {
                this.loading = false;
                if (!game) {
                    // Should not happen after backend fix, but guard anyway
                    this.error = 'Unexpected server response. Please try again.';
                    return;
                }
                this.gameCreated.emit(game);
            },
            error: (err) => {
                this.loading = false;
                if (err.status === 409) {
                    // Game already exists — close modal, let restoreGameState show the banner
                    this.close.emit();
                } else {
                    this.error = err.error?.error || err.error?.message || 'Server connection failed.';
                }
            }
        });
    }

    closeModal(): void {
        this.close.emit();
    }
}