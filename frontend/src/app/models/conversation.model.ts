import {Theme} from "./theme.model";

export interface ConversationDTO {
    id: string;
    nom: string;
    description: string;
    type: 'PRIVATE' | 'GROUP';

    createdByUserId: string;
    createdAt: string;

    lastMessageContent: string | null;
    lastMessageSender: string | null;
    lastMessageAt: string | null;

    unreadCount: number;
    theme?: Theme;
    photoUrl?: string;
}
