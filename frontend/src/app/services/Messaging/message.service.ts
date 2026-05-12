import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { MessageDTO } from '../../models/message.model';

@Injectable({
    providedIn: 'root'
})
export class MessageService {

    private baseUrl = 'http://localhost:8089/api';

    constructor(private http: HttpClient) {}

    getMessagesByConversation(conversationId: string, userId: string): Observable<MessageDTO[]> {
        return this.http.get<MessageDTO[]>(
            `${this.baseUrl}/conversations/${conversationId}/messages?userId=${userId}`,
            { withCredentials: true }
        );
    }

    sendMessage(
        conversationId: string,
        senderId: string,
        content: string,
        parentMessageId?: string | null,
        type: string = 'TEXT'
    ): Observable<MessageDTO> {
        return this.http.post<MessageDTO>(
            `${this.baseUrl}/conversations/${conversationId}/messages`,
            { conversationId, senderId, content, type, parentMessageId: parentMessageId || null },
            { withCredentials: true }
        );
    }

    updateMessage(conversationId: string, messageId: string, content: string): Observable<MessageDTO> {
        return this.http.put<MessageDTO>(
            `${this.baseUrl}/conversations/${conversationId}/messages/${messageId}`,
            { content },
            { withCredentials: true }
        );
    }

    deleteMessage(conversationId: string, messageId: string): Observable<MessageDTO> {
        return this.http.delete<MessageDTO>(
            `${this.baseUrl}/conversations/${conversationId}/messages/${messageId}`,
            { withCredentials: true }
        );
    }

    /**
     * Upload an image or file to GridFS.
     * Returns the public URL string e.g. "/api/images/abc123"
     */
    uploadMedia(file: File): Observable<string> {
        const formData = new FormData();
        formData.append('file', file, file.name);
        return this.http.post(
            `${this.baseUrl}/images/upload`,
            formData,
            { withCredentials: true, responseType: 'text' }
        );
    }

    /**
     * Mark a single message as read by a user.
     * POST /api/conversations/{conversationId}/messages/{messageId}/read?userId=...
     */
    markAsRead(conversationId: string, messageId: string, userId: string): Observable<MessageDTO> {
        return this.http.post<MessageDTO>(
            `${this.baseUrl}/conversations/${conversationId}/messages/${messageId}/read?userId=${userId}`,
            {},
            { withCredentials: true }
        );
    }
}