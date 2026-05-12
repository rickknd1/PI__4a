// participant.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface ConversationParticipant {
    id?: string;
    conversationId: string;
    userId: string;
    role: 'ADMIN' | 'MEMBRE' | 'SUPERADMIN';
    joinedAt?: string;
    lastReadMessageId?: string;
}

@Injectable({ providedIn: 'root' })
export class ParticipantService {
    private base = 'http://localhost:8089/api/conversations';

    constructor(private http: HttpClient) {}

    // GET /api/conversations/{conversationId}/participants
    getParticipants(conversationId: string): Observable<ConversationParticipant[]> {
        return this.http.get<ConversationParticipant[]>(`${this.base}/${conversationId}/participants`);
    }

    // POST /api/conversations/{conversationId}/participants
    addParticipant(conversationId: string, participant: Partial<ConversationParticipant>): Observable<ConversationParticipant> {
        return this.http.post<ConversationParticipant>(`${this.base}/${conversationId}/participants`, participant);
    }

    // DELETE /api/conversations/{conversationId}/participants/{id}
    removeParticipant(conversationId: string, participantId: string): Observable<void> {
        return this.http.delete<void>(`${this.base}/${conversationId}/participants/${participantId}`);
    }

    // POST /api/conversations/{conversationId}/participants/leave?userId=...
    leaveConversation(conversationId: string, userId: string): Observable<{ [key: string]: string }> {
        const params = new HttpParams().set('userId', userId);
        return this.http.post<{ [key: string]: string }>(`${this.base}/${conversationId}/participants/leave`, {}, { params });
    }

    // POST /api/conversations/{conversationId}/participants/transfer?fromUserId=...&toUserId=...
    transferSuperAdmin(conversationId: string, fromUserId: string, toUserId: string): Observable<void> {
        const params = new HttpParams().set('fromUserId', fromUserId).set('toUserId', toUserId);
        return this.http.post<void>(`${this.base}/${conversationId}/participants/transfer`, {}, { params });
    }

    // POST /api/conversations/{conversationId}/participants/read?userId=...
    markAsRead(conversationId: string, userId: string): Observable<void> {
        const params = new HttpParams().set('userId', userId);
        return this.http.post<void>(`${this.base}/${conversationId}/participants/read`, {}, { params });
    }
}