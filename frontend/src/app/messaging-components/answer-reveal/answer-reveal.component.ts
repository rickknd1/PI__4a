// src/app/components/Game/answer-reveal/answer-reveal.component.ts

import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AnswerRevealEvent, LeaderboardEntry } from '../../models/game.model';

@Component({
    selector: 'app-answer-reveal',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './answer-reveal.component.html',
    styleUrls: ['./answer-reveal.component.css']
})
export class AnswerRevealComponent implements OnInit, OnDestroy {
    @Input() event: AnswerRevealEvent | null = null;
    @Input() selectedAnswer: string | null = null;
    @Input() currentUserId: string = '';

    displayedFunFact = '';
    isTyping = false;
    private typingInterval: any;

    answerColors = ['bg-red-500', 'bg-blue-500', 'bg-yellow-500', 'bg-green-500'];
    answerLetters = ['A', 'B', 'C', 'D'];

    topPlayers: LeaderboardEntry[] = [];

    ngOnInit(): void {
        if (this.event) {
            this.startTypewriter(this.event.aiFunFact);
            this.topPlayers = this.event.scores
                ?.sort((a, b) => b.points - a.points)
                .slice(0, 3)
                .map((s, i) => ({
                    userId: s.userId,
                    username: s.username,
                    totalPoints: s.points,
                    correctAnswers: s.isCorrect ? 1 : 0,
                    wrongAnswers: s.isCorrect ? 0 : 1,
                    avgResponseTimeMs: s.responseTimeMs,
                    rank: i + 1,
                    aiTitle: ''
                })) || [];
        }
    }

    ngOnDestroy(): void {
        this.clearTypingInterval();
    }

    private startTypewriter(text: string): void {
        this.displayedFunFact = '';
        this.isTyping = true;
        let index = 0;

        this.typingInterval = setInterval(() => {
            if (index < text.length) {
                this.displayedFunFact += text[index];
                index++;
            } else {
                this.isTyping = false;
                this.clearTypingInterval();
            }
        }, 30);
    }

    private clearTypingInterval(): void {
        if (this.typingInterval) {
            clearInterval(this.typingInterval);
            this.typingInterval = null;
        }
    }

    isCorrectAnswer(): boolean {
        return this.selectedAnswer === this.event?.correctAnswer;
    }

    // ✅ FIXED: Removed the problematic method or simplified it
    getCorrectAnswerDisplay(): string {
        return this.event?.correctAnswer ?? '';
    }

    getRankEmoji(rank: number): string {
        switch (rank) {
            case 1: return '🥇';
            case 2: return '🥈';
            case 3: return '🥉';
            default: return '🏅';
        }
    }

    getRankColor(rank: number): string {
        switch (rank) {
            case 1: return 'from-yellow-400 to-amber-500';
            case 2: return 'from-slate-300 to-slate-400';
            case 3: return 'from-orange-400 to-orange-500';
            default: return 'from-blue-400 to-blue-500';
        }
    }
}