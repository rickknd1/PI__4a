import {HttpClient, HttpHeaders} from '@angular/common/http';
import { Injectable } from '@angular/core';
import {Observable, map, of} from 'rxjs';
import { ConversationDTO } from '../../models/conversation.model';
import { UserSimple } from "../../messaging-components/NewPrivateChatModalComponent/new-private-chat-modal.component";

@Injectable({
    providedIn: 'root'
})

export class ConversationService {

    private url = 'http://localhost:8089/api/conversations';
    private userUrl = 'http://localhost:8084/api/users';

    constructor(private http: HttpClient) {}

    getAll(userId: string): Observable<ConversationDTO[]> {
        return this.http.get<ConversationDTO[]>(
            `${this.url}?userId=${userId}`,
            { withCredentials: true }
        );
    }

    createPrivate(userId1: string, userId2: string): Observable<any> {
        return this.http.post(
            `${this.url}/private?userId1=${userId1}&userId2=${userId2}`,
            {},
            { withCredentials: true }
        );
    }



    createConversation(data: { nom: string, type: string }): Observable<any> {
        return this.http.post(`${this.url}`, data, { withCredentials: true });
    }
    delete(id: string, userId: string): Observable<any> {
        return this.http.delete(
            `${this.url}/${id}?userId=${userId}`,
            { withCredentials: true }
        );
    }

    leaveConversation(conversationId: string, userId: string): Observable<any> {
        return this.http.delete(
            `${this.url}/${conversationId}/archive?userId=${userId}`,
            { withCredentials: true }
        );
    }
    addParticipant(conversationId: string, userId: string, role: string): Observable<any> {
        return this.http.post(
            `${this.url}/${conversationId}/participants`,
            { conversationId, userId, role },
            { withCredentials: true }
        );
    }
    archiveConversation(conversationId: string, userId: string): Observable<void> {
        return this.http.delete<void>(
            `${this.url}/${conversationId}/archive?userId=${userId}`
        );
    }
    // Add this method in ConversationService
    // ✅ Corrected method for "Delete for me" / Archive
    hideMessagesForUser(conversationId: string, userId: string): Observable<any> {
        return this.http.delete(
            `${this.url}/${conversationId}/messages?userId=${userId}`,
            { withCredentials: true }
        );
    }






// Delete entire group (only for SUPERADMIN)
    deleteGroup(conversationId: string, userId: string): Observable<any> {
        return this.http.delete(`${this.url}/${conversationId}?userId=${userId}`);
    }
    loadAllUsers(): Observable<UserSimple[]> {
        return this.http.get<any[]>(this.userUrl, {
            withCredentials: true  // ← sends the jwt cookie automatically
        }).pipe(
            map((users: any[]) => users.map((u: any) => ({
                userId: u.id,
                fullName: u.firstName + ' ' + u.lastName
            })))
        );
    }

    searchUsers(query: string): Observable<UserSimple[]> {
        if (!query || query.trim() === '') return of([]);
        return this.loadAllUsers().pipe(
            map(users => {
                const q = query.toLowerCase().trim();
                return users.filter(u => u.fullName.toLowerCase().includes(q));
            })
        );
    }
    updateName(conversationId: string, name: string): Observable<any> {
        return this.http.patch(`${this.url}/${conversationId}/name`, { name });
    }

    updatePhotoUrl(conversationId: string, photoUrl: string): Observable<any> {
        return this.http.patch(
            `${this.url}/${conversationId}/photo-url`,
            { photoUrl },
            {
                withCredentials: true,
                headers: { 'Content-Type': 'application/json' }
            }
        );
    }
    // conversation.service.ts
    // conversation.service.ts  ← Replace the markAsRead method with this corrected version
    markAsRead(conversationId: string, userId: string): Observable<any> {
        return this.http.put(
            `${this.url}/${conversationId}/read`,
            { userId },
            { withCredentials: true }
        );
    }
}