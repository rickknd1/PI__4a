// models/conversation-participant.model.ts
export interface ConversationParticipant {
    id?: string;
    conversationId: string;
    userId: string;
    role: 'ADMIN' | 'MEMBRE' | 'SUPERADMIN';
    joinedAt?: string;
    lastReadMessageId?: string;
    photoUrl?: string;
}