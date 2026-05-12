import { Component, Input, Output, EventEmitter, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GameService } from '../../services/Messaging/game.service';
import { QuestionEvent, SubmitAnswerRequest } from '../../models/game.model';

@Component({
    selector: 'app-game-question',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './game-question.component.html',
    styleUrls: ['./game-question.component.css']
})
export class GameQuestionComponent implements OnInit, OnDestroy {
    @Input() gameId: string = '';
    @Input() currentUserId: string = '';
    @Output() answerSubmitted = new EventEmitter<void>();

    // Component State
    question: QuestionEvent | null = null;
    selectedAnswer: string | null = null;
    answeredCount = 0;
    totalPlayers = 0;
    timeRemaining = 0;
    isSubmitting = false;
    hasAnswered = false;

    // Visual Configuration (Constants)
    readonly answerLetters = ['A', 'B', 'C', 'D'];
    readonly answerColors = [
        {
            bg: 'bg-rose-500/10 hover:bg-rose-500/20',
            hover: 'hover:border-rose-500/50',
            selected: 'bg-rose-600 ring-rose-400 shadow-[0_0_20px_rgba(225,29,72,0.4)]',
            shadow: 'shadow-rose-900/20'
        },
        {
            bg: 'bg-blue-500/10 hover:bg-blue-500/20',
            hover: 'hover:border-blue-500/50',
            selected: 'bg-blue-600 ring-blue-400 shadow-[0_0_20px_rgba(37,99,235,0.4)]',
            shadow: 'shadow-blue-900/20'
        },
        {
            bg: 'bg-amber-500/10 hover:bg-amber-500/20',
            hover: 'hover:border-amber-500/50',
            selected: 'bg-amber-600 ring-amber-400 shadow-[0_0_20px_rgba(217,119,6,0.4)]',
            shadow: 'shadow-amber-900/20'
        },
        {
            bg: 'bg-emerald-500/10 hover:bg-emerald-500/20',
            hover: 'hover:border-emerald-500/50',
            selected: 'bg-emerald-600 ring-emerald-400 shadow-[0_0_20px_rgba(5,150,105,0.4)]',
            shadow: 'shadow-emerald-900/20'
        }
    ];

    private timerInterval: any;
    private questionStartTime: number = 0;

    constructor(private gameService: GameService) {}

    ngOnInit(): void {}

    ngOnDestroy(): void {
        this.clearTimer();
    }

    setQuestion(event: QuestionEvent, totalPlayers: number): void {
        this.question = event;
        this.totalPlayers = totalPlayers;
        this.answeredCount = 0;
        this.selectedAnswer = null;
        this.hasAnswered = false;
        this.isSubmitting = false;
        this.questionStartTime = Date.now();
        this.startTimer(event.timeLimit);
    }

    startTimer(seconds: number): void {
        this.clearTimer();
        this.timeRemaining = seconds;

        this.timerInterval = setInterval(() => {
            if (this.timeRemaining > 0) {
                this.timeRemaining--;
            } else {
                this.clearTimer();
                if (!this.hasAnswered) {
                    this.autoSubmit();
                }
            }
        }, 1000);
    }

    clearTimer(): void {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    selectAnswer(answer: string): void {
        if (this.hasAnswered || this.isSubmitting) return;
        this.selectedAnswer = answer;
    }

    confirmAnswer(): void {
        if (!this.selectedAnswer || !this.question || this.hasAnswered || this.isSubmitting) return;

        this.isSubmitting = true;
        const responseTimeMs = Date.now() - this.questionStartTime;

        const request: SubmitAnswerRequest = {
            questionIndex: this.question.index,
            userId: this.currentUserId,
            selectedAnswer: this.selectedAnswer,
            responseTimeMs
        };

        this.gameService.submitAnswer(this.gameId, request).subscribe({
            next: () => {
                this.hasAnswered = true;
                this.isSubmitting = false;
                this.answerSubmitted.emit();
            },
            error: (err) => {
                console.error('Failed to submit answer:', err);
                this.isSubmitting = false;
            }
        });
    }

    private autoSubmit(): void {
        this.hasAnswered = true;
        this.answerSubmitted.emit();
    }

    getQuestionNumber(): number {
        return this.question ? this.question.index + 1 : 1;
    }

    getTotalQuestions(): number {
        return this.question?.total ?? 0;
    }

    getQuestionText(): string {
        return this.question?.text ?? 'Preparing next question...';
    }

    getOptions(): string[] {
        return this.question?.options ?? [];
    }

    getTimerPercentage(): number {
        if (!this.question || this.question.timeLimit <= 0) return 0;
        return (this.timeRemaining / this.question.timeLimit) * 100;
    }

    getTimerColor(): string {
        if (this.timeRemaining <= 5) return 'bg-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.6)]';
        if (this.timeRemaining <= (this.question?.timeLimit || 20) / 2) return 'bg-amber-500';
        return 'bg-emerald-500';
    }
}