// src/app/services/Game/game.service.ts

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { GameSession, CreateGameRequest, SubmitAnswerRequest, GameLeaderboard } from '../../models/game.model';

@Injectable({
    providedIn: 'root'
})
export class GameService {
    private baseUrl = 'http://localhost:8089/api/games';

    constructor(private http: HttpClient) {}

    createGame(request: CreateGameRequest): Observable<GameSession> {
        return this.http.post<GameSession>(`${this.baseUrl}/create`, request);
    }

    joinGame(gameId: string, userId: string): Observable<GameSession> {
        return this.http.post<GameSession>(`${this.baseUrl}/${gameId}/join?userId=${userId}`, {});
    }

    startGame(gameId: string, adminUserId: string): Observable<GameSession> {
        return this.http.post<GameSession>(`${this.baseUrl}/${gameId}/start?adminUserId=${adminUserId}`, {});
    }

    submitAnswer(gameId: string, request: SubmitAnswerRequest): Observable<void> {
        return this.http.post<void>(`${this.baseUrl}/${gameId}/answer`, request);
    }

    getActiveGame(conversationId: string): Observable<GameSession | null> {
        return this.http.get<GameSession | null>(`${this.baseUrl}/conversation/${conversationId}/active`);
    }

    getGameHistory(conversationId: string): Observable<GameSession[]> {
        return this.http.get<GameSession[]>(`${this.baseUrl}/conversation/${conversationId}/history`);
    }

    getLeaderboard(gameId: string): Observable<GameLeaderboard> {
        return this.http.get<GameLeaderboard>(`${this.baseUrl}/${gameId}/leaderboard`);
    }
}