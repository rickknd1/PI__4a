export interface VirtualEvent {
  id?: string;

  title: string;
  description?: string;
  category?: string;

  scheduledAt: string;
  endAt?: string;

  meetingLink?: string;
  isRecording?: boolean;

  price?: number;
  isPaid?: boolean;

  maxParticipants?: number;
  currentParticipants?: number;

  imageUrl?: string;
  status?: string;

  organizer?: any;

    // 🔥 AJOUT IMPORTANT
  type: 'VIRTUAL' | 'ROOM';
  roomId?: string;
}
