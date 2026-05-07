import {Component, Input, OnInit, OnDestroy, ViewChild, ElementRef, ChangeDetectorRef} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { GameWebSocketService } from '../../services/Messaging/game-websocket.service';
import { WebSocketService } from '../../services/Messaging/websocket.service';
import { QuestionEvent, AnswerRevealEvent, GameOverEvent } from '../../models/game.model';
import { GameQuestionComponent } from '../Game Question Screen Component/game-question.component';
import { AnswerRevealComponent } from '../answer-reveal/answer-reveal.component';
import { GameLeaderboardComponent } from '../game-leaderboard/game-leaderboard.component';

@Component({
    selector: 'app-game-container',
    standalone: true,
    imports: [CommonModule, FormsModule, GameQuestionComponent, AnswerRevealComponent, GameLeaderboardComponent],
    templateUrl: './game-container.component.html',
    styleUrls: ['./game-container.component.css']
})
export class GameContainerComponent implements OnInit, OnDestroy {
    @ViewChild('questionComp') questionComponent?: GameQuestionComponent;
    @ViewChild('gameRoot') gameRoot!: ElementRef;
    @ViewChild('chatScroll') chatScroll!: ElementRef; // renamed from chatMessages

    @Input() currentUserId: string = '';
    @Input() conversationId: string = '';

    gameId: string = '';
    gamePhase: 'QUESTION' | 'REVEAL' | 'LEADERBOARD' | null = null;
    isFullscreen: boolean = false;
    showChat: boolean = false;

    currentQuestion: QuestionEvent | null = null;
    selectedAnswer: string | null = null;
    totalPlayers: number = 0;
    revealEvent: AnswerRevealEvent | null = null;
    leaderboardEvent: GameOverEvent | null = null;

    // renamed from chatMessages to messages to avoid template collision
    messages: { senderId: string; content: string; time: string }[] = [];
    chatInput: string = '';
    unreadCount: number = 0;

    private wsSub?: Subscription;
    private chatSub?: Subscription;
    private pendingQuestion: QuestionEvent | null = null;

    constructor(
        private gameWsService: GameWebSocketService,
        private webSocketService: WebSocketService,
        private cdr: ChangeDetectorRef

    ) {}

    ngOnInit(): void {
        document.body.classList.add('game-active');

        this.wsSub = this.gameWsService.gameEvent$.subscribe((event: any) => {
            if (event) this.handleGameEvent(event);
        });
        console.log('🎮 GameContainer init, conversationId:', this.conversationId);
        this.chatSub = this.webSocketService.message$.subscribe((msg: any) => {
            console.log('💬 Chat message received in game:', msg, 'conversationId match:', msg.conversationId === this.conversationId);
            if (msg.conversationId !== this.conversationId) return;
            if (msg.senderId === this.currentUserId) return; // own messages added locally
            this.messages.push({
                senderId: msg.senderId,
                content: msg.content,
                time: new Date().toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })
            });
            if (!this.showChat) this.unreadCount++;
            setTimeout(() => this.scrollChat(), 50);
        });

        document.addEventListener('fullscreenchange', this.onFullscreenChange.bind(this));
    }

    ngOnDestroy(): void {
        this.wsSub?.unsubscribe();
        this.chatSub?.unsubscribe();
        document.removeEventListener('fullscreenchange', this.onFullscreenChange.bind(this));
    }

    private handleGameEvent(event: any): void {
        switch (event.type) {
            case 'GAME_STARTED':
                this.gameId = event.gameId;
                this.gamePhase = null;
                break;
            case 'QUESTION':
                this.handleQuestionPhase(event);
                break;
            case 'PLAYER_ANSWERED':
                this.totalPlayers = event.totalPlayers;
                if (this.questionComponent) {
                    this.questionComponent.answeredCount = event.answeredCount;
                    this.questionComponent.totalPlayers = event.totalPlayers;
                }
                break;
            case 'ANSWER_REVEAL':
                this.handleRevealPhase(event);
                break;
            case 'GAME_OVER':
                this.handleGameOverPhase(event);
                break;
        }
    }

    private handleQuestionPhase(event: any): void {
        const q: QuestionEvent = {
            type: 'QUESTION',
            index: event.index,
            text: event.text,
            options: event.options,
            timeLimit: event.timeLimit,
            total: event.total
        };
        this.pendingQuestion = q;
        this.currentQuestion = q;
        this.selectedAnswer = null;
        this.revealEvent = null;
        this.leaderboardEvent = null;
        this.gamePhase = 'QUESTION';
        this.cdr.detectChanges();
        setTimeout(() => {
            if (this.questionComponent && this.pendingQuestion) {
                this.questionComponent.setQuestion(this.pendingQuestion, this.totalPlayers);
                this.pendingQuestion = null;
            }
        }, 150);
    }

    private handleRevealPhase(event: any): void {
        if (this.questionComponent) {
            this.selectedAnswer = this.questionComponent.selectedAnswer;
            this.questionComponent.clearTimer();
        }
        this.revealEvent = {
            type: 'ANSWER_REVEAL',
            correctAnswer: event.correctAnswer,
            aiFunFact: event.aiFunFact,
            scores: event.scores
        };
        this.currentQuestion = null;
        this.gamePhase = 'REVEAL';
        this.cdr.detectChanges();
    }
    private handleGameOverPhase(event: any): void {
        console.log('🏆 GAME OVER - setting LEADERBOARD phase', event);

        this.leaderboardEvent = {
            type: 'GAME_OVER',
            leaderboard: event.leaderboard || [],
            aiSummary: event.aiSummary || ''
        };

        this.gamePhase = 'LEADERBOARD';

        this.cdr.markForCheck();
        this.cdr.detectChanges();

        setTimeout(() => {
            this.cdr.markForCheck();
            this.cdr.detectChanges();
        }, 10);
    }

    toggleChat(): void {
        this.showChat = !this.showChat;
        if (this.showChat) {
            this.unreadCount = 0;
            setTimeout(() => this.scrollChat(), 100);
        }
    }

    sendChatMessage(): void {
        if (!this.chatInput.trim() || !this.conversationId) return;
        const content = this.chatInput.trim();
        this.webSocketService.sendMessage(this.conversationId, this.currentUserId, content);
        this.messages.push({
            senderId: this.currentUserId,
            content,
            time: new Date().toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })
        });
        this.chatInput = '';
        setTimeout(() => this.scrollChat(), 50);
    }

    private scrollChat(): void {
        if (this.chatScroll) {
            this.chatScroll.nativeElement.scrollTop = this.chatScroll.nativeElement.scrollHeight;
        }
    }

    onAnswerSubmitted(): void {
        if (this.questionComponent) this.selectedAnswer = this.questionComponent.selectedAnswer;
    }

    onPlayAgain(): void { this.resetState(); }
    onCloseGame(): void { this.resetState();
        this.gamePhase = null;}

    private resetState(): void {
        this.gamePhase = null;
        this.gameId = '';
        this.currentQuestion = null;
        this.selectedAnswer = null;
        this.revealEvent = null;
        this.leaderboardEvent = null;
        this.pendingQuestion = null;
        this.messages = [];
        this.unreadCount = 0;
        this.showChat = false;
    }

    toggleFullscreen(): void {
        if (!this.isFullscreen) {
            this.gameRoot.nativeElement.requestFullscreen?.();
        } else {
            document.exitFullscreen?.();
        }
    }

    private onFullscreenChange(): void {
        this.isFullscreen = !!document.fullscreenElement;
    }

    isMine(senderId: string): boolean {
        return senderId === this.currentUserId;
    }

    onChatKeydown(event: KeyboardEvent): void {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            this.sendChatMessage();
        }
    }
}