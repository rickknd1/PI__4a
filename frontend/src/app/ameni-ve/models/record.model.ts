export interface EventRecord {
  id?: string;
  fileUrl: string;
  gdprConsent?: boolean;
  virtualEvent?: any;           // Référence à VirtualEvent
  createdAt?: string;
  duration?: number;
  fileName?: string;
  fileSize?: number;
}

export interface Transcription {
  id?: string;
  content: string;
  language?: string;
  confidence?: number;
  eventRecordId?: string;
  createdAt?: string;
}