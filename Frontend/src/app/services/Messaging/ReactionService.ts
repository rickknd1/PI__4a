// src/app/services/Messaging/reaction.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ReactionDTO } from '../../models/message.model';

@Injectable({ providedIn: 'root' })
export class ReactionService {

    private baseUrl = 'http://localhost:8089/api';

    constructor(private http: HttpClient) {}

    toggleReaction(
        conversationId: string,
        messageId: string,
        userId: string,
        emoji: string
    ): Observable<ReactionDTO[]> {
        return this.http.post<ReactionDTO[]>(
            `${this.baseUrl}/conversations/${conversationId}/messages/${messageId}/reactions`,
            { userId, emoji },
            { withCredentials: true }
        );
    }

    getReactions(conversationId: string, messageId: string): Observable<ReactionDTO[]> {
        return this.http.get<ReactionDTO[]>(
            `${this.baseUrl}/conversations/${conversationId}/messages/${messageId}/reactions`,
            { withCredentials: true }
        );
    }
}