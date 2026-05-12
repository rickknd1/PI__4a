export interface ReactionDTO {
    id: string;
    messageId: string;
    userId: string;
    emoji: 'LIKE' | 'LOVE' | 'HAHA' | 'NOTBAD' | 'GREATJOB';
}

export interface MessageReceiptDTO {
    userId: string;
    readAt: string;
}

export interface MessageDTO {
    id: string;
    conversationId: string;
    senderId: string;
    senderName?: string;
    content: string;
    type?: 'TEXT' | 'IMAGE' | 'FILE';
    parentMessageId?: string;
    createdAt: string;
    edited?: boolean;
    deleted?: boolean;
    parentMessageContent?: string;
    reactions?: ReactionDTO[];
    receipts?: MessageReceiptDTO[];
    // local-only fields for optimistic UI before upload completes
    _localPreviewUrl?: string;
    _localFileName?: string;
}

export type ChatMessage = MessageDTO;