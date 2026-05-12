// src/app/models/game.model.ts

export enum GameStatus {
    WAITING = 'WAITING',
    IN_PROGRESS = 'IN_PROGRESS',  // was PLAYING — must match backend exactly
    FINISHED = 'FINISHED'
}

export enum Difficulty {
    EASY = 'EASY',
    MEDIUM = 'MEDIUM',
    HARD = 'HARD'
}

export interface GameSession {
    id: string;
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
    createdAt: string;
}

export interface GameQuestion {
    index: number;
    questionText: string;
    options: string[];       // exactly 4 options
    correctAnswer: string;
    aiFunFact: string;
    aiWrongExplanation: string;
    revealed: boolean;
    revealedAt?: string;
}

export interface LeaderboardEntry {
    userId: string;
    username: string;
    totalPoints: number;
    correctAnswers: number;
    wrongAnswers: number;
    avgResponseTimeMs: number;
    rank: number;
    aiTitle: string;
}

export interface GameLeaderboard {
    id: string;
    gameSessionId: string;
    conversationId: string;
    entries: LeaderboardEntry[];
    aiGameSummary: string;
    createdAt: string;
}

export interface GameAnswer {
    id: string;
    gameSessionId: string;
    questionIndex: number;
    userId: string;
    selectedAnswer: string;
    isCorrect: boolean;
    responseTimeMs: number;
    pointsEarned: number;
    submittedAt: string;
}

// WebSocket Event Payloads
export interface GameCreatedEvent {
    type: 'GAME_CREATED';
    gameId: string;
    category: string;
    createdBy: string;
    totalQuestions: number;        // ← was totalQ
    timeLimitPerQuestion: number;  // ← was timeLimit
    difficulty: string;
}

export interface GameStartedEvent {
    type: 'GAME_STARTED';
    gameId: string;
    firstQuestion: QuestionPayload;
}

export interface QuestionEvent {
    type: 'QUESTION';
    index: number;
    text: string;
    options: string[];
    timeLimit: number;
    total: number;
}

export interface AnswerRevealEvent {
    type: 'ANSWER_REVEAL';
    correctAnswer: string;
    aiFunFact: string;
    scores: PlayerScore[];
}

export interface GameOverEvent {
    type: 'GAME_OVER';
    leaderboard: LeaderboardEntry[];
    aiSummary: string;
}

export interface PlayerScore {
    userId: string;
    username: string;
    points: number;
    isCorrect: boolean;
    responseTimeMs: number;
}

export interface PlayerJoinedEvent {
    type: 'PLAYER_JOINED';
    userId: string;
    username: string;
    playerCount: number;
}

export interface PlayerAnsweredEvent {
    type: 'PLAYER_ANSWERED';
    answeredCount: number;
    totalPlayers: number;
}

export type GameEvent =
    | GameCreatedEvent
    | GameStartedEvent
    | QuestionEvent
    | AnswerRevealEvent
    | GameOverEvent
    | PlayerJoinedEvent
    | PlayerAnsweredEvent;

export interface QuestionPayload {
    index: number;
    questionText: string;
    options: string[];
    correctAnswer: string;
    aiFunFact: string;
    timeLimit: number;
    total: number;
}

export interface CreateGameRequest {
    conversationId: string;
    createdBy: string;
    category: string;
    difficulty: Difficulty;
    totalQuestions: number;
    timeLimitPerQuestion: number;
}

export interface SubmitAnswerRequest {
    questionIndex: number;
    userId: string;
    selectedAnswer: string;
    responseTimeMs: number;
}