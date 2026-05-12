import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, OnChanges, SimpleChanges, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GameOverEvent, LeaderboardEntry } from '../../models/game.model';

@Component({
    selector: 'app-game-leaderboard',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './game-leaderboard.component.html',
    styleUrls: ['./game-leaderboard.component.css']
})
export class GameLeaderboardComponent implements OnInit, OnDestroy, OnChanges {

    @Input() event: GameOverEvent | null = null;
    @Input() currentUserId: string = '';
    @Input() conversationId: string = '';

    @Output() playAgain = new EventEmitter<void>();
    @Output() close = new EventEmitter<void>();

    // UI State
    displayedSummary = '';
    isTypingSummary = false;
    showConfetti = false;
    isChatOpen: boolean = false;
    newMessages: boolean = true;

    // Processed Data
    podiumPlayers: (LeaderboardEntry | null)[] = [null, null, null];
    sortedLeaderboard: LeaderboardEntry[] = [];

    private typingInterval: any;

    constructor(private cdr: ChangeDetectorRef) {}

    ngOnInit(): void {
        // Initial setup if data is already present
        if (this.event) {
            this.triggerVictorySequence();
        }
    }

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['event'] && this.event?.leaderboard) {
            this.triggerVictorySequence();
        }
    }

    ngOnDestroy(): void {
        this.clearTypingInterval();
    }

    /**
     * Orchestrates the entrance: Data Processing -> Confetti -> Typewriter
     */
    private triggerVictorySequence(): void {
        this.processLeaderboard();

        // 1. Start Confetti
        this.showConfetti = true;
        setTimeout(() => this.showConfetti = false, 5000);

        // 2. Start Typewriter with a small delay for the "Wow" feel
        setTimeout(() => {
            const summary = this.event?.aiSummary?.trim() || "What an incredible match! Well played everyone.";
            this.startSummaryTypewriter(summary);
        }, 600);
    }

    private processLeaderboard(): void {
        if (!this.event?.leaderboard?.length) return;

        // 1. Sort the full list for the sidebar
        this.sortedLeaderboard = [...this.event.leaderboard].sort((a, b) => a.rank - b.rank);

        // 2. Map Podium: [2nd Place, 1st Place, 3rd Place]
        // This matches your HTML structure for alignment
        this.podiumPlayers = [
            this.sortedLeaderboard.find(p => p.rank === 2) || null,
            this.sortedLeaderboard.find(p => p.rank === 1) || null,
            this.sortedLeaderboard.find(p => p.rank === 3) || null
        ];
    }

    private startSummaryTypewriter(text: string): void {
        this.clearTypingInterval();
        this.displayedSummary = '';
        this.isTypingSummary = true;

        let index = 0;
        const speed = 30;

        this.typingInterval = setInterval(() => {
            if (index < text.length) {
                this.displayedSummary += text[index];
                index++;
                this.cdr.markForCheck(); // Ensure UI updates character-by-character
            } else {
                this.isTypingSummary = false;
                this.clearTypingInterval();
                this.cdr.markForCheck();
            }
        }, speed);
    }

    private clearTypingInterval(): void {
        if (this.typingInterval) {
            clearInterval(this.typingInterval);
            this.typingInterval = null;
        }
    }

    toggleChat(): void {
        this.isChatOpen = !this.isChatOpen;
        if (this.isChatOpen) {
            this.newMessages = false;
        }
    }

    getRankEmoji(rank: number): string {
        switch (rank) {
            case 1: return '👑';
            case 2: return '🥈';
            case 3: return '🥉';
            default: return '🏅';
        }
    }
}