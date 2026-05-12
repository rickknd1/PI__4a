import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { apiUrl } from '../../../environments/environment';

export interface EventFeedback {
  id?: string;
  eventId: string;
  eventTitle?: string;
  eventFormat?: string;
  clubId?: string;
  userId: string;
  userName?: string;

  organizationScore?: number | null;
  contentScore?: number | null;
  animationScore?: number | null;
  venueScore?: number | null;
  scheduleScore?: number | null;
  npsLikelihood?: number | null;

  tags?: string[];
  /** Per-staff-member rating (1..5). Missing key means "not rated". */
  staffRatings?: { [staffKey: string]: number | undefined };
  comment?: string;
  createdAt?: string;
}

export interface EventFeedbackSummary {
  count: number;
  organization: number | null;
  content: number | null;
  animation: number | null;
  venue: number | null;
  schedule: number | null;
  nps: number | null;
  topTags: { tag: string; count: number }[];
}

/**
 * Shape of the LLM-generated feedback summary.
 *
 * Most fields are marked optional because the model is allowed to omit a
 * section when it has nothing useful to say (e.g. no negatives → empty
 * `pain_points`, sometimes the field itself absent). The UI must guard
 * every block.
 */
export interface AiFeedbackSummary {
  eventId: string;
  feedbackCount: number;
  source: 'llm';
  model: string;
  generatedAt: string;
  summary: {
    executive_summary?: string;
    sentiment?: { label: 'positive' | 'mixed' | 'negative'; score: number };
    dimension_highlights?: { dimension: string; average: number; comment: string }[];
    recurring_themes?: { theme: string; polarity: 'positive' | 'negative'; mentions: number; sample_quote?: string | null }[];
    praise?: string[];
    pain_points?: string[];
    action_items?: string[];
    would_repeat_signal?: string;
  };
}

export interface AiSummaryDisabled {
  enabled: false;
  message: string;
}
export interface AiSummaryEmpty {
  feedbackCount: 0;
  message: string;
}

/** Per-comment classification returned by the custom Logistic Regression model. */
export interface SentimentItem {
  index: number;
  text: string;
  label: 'positive' | 'neutral' | 'negative';
  confidence: number;
}

/** Aggregate + per-comment sentiment payload from /event/{id}/sentiment. */
export interface SentimentBreakdown {
  eventId: string;
  source: 'custom-ml';
  model: string;
  generatedAt: string;
  count: number;
  positive: number;
  neutral: number;
  negative: number;
  percentPositive: number;
  percentNeutral: number;
  percentNegative: number;
  items: SentimentItem[];
}

export interface SentimentDisabled {
  enabled: false;
  message: string;
}
export interface SentimentEmpty {
  feedbackCount: number;
  commentCount?: number;
  message: string;
}

@Injectable({ providedIn: 'root' })
export class EventFeedbackService {
  private baseUrl = apiUrl('/api/feedbacks');

  constructor(private http: HttpClient) {}

  submit(feedback: EventFeedback): Observable<EventFeedback> {
    return this.http.post<EventFeedback>(this.baseUrl, feedback);
  }

  myFeedback(eventId: string, userId: string): Observable<EventFeedback | { exists: false }> {
    return this.http.get<EventFeedback | { exists: false }>(
      `${this.baseUrl}/event/${eventId}/me?userId=${encodeURIComponent(userId)}`
    );
  }

  byEvent(eventId: string): Observable<EventFeedback[]> {
    return this.http.get<EventFeedback[]>(`${this.baseUrl}/event/${eventId}`);
  }

  summary(eventId: string): Observable<EventFeedbackSummary> {
    return this.http.get<EventFeedbackSummary>(`${this.baseUrl}/event/${eventId}/summary`);
  }

  aiSummary(eventId: string): Observable<AiFeedbackSummary | AiSummaryDisabled | AiSummaryEmpty> {
    return this.http.get<AiFeedbackSummary | AiSummaryDisabled | AiSummaryEmpty>(
      `${this.baseUrl}/event/${eventId}/ai-summary`
    );
  }

  /** Custom-ML sentiment breakdown (no LLM). */
  sentiment(eventId: string): Observable<SentimentBreakdown | SentimentDisabled | SentimentEmpty> {
    return this.http.get<SentimentBreakdown | SentimentDisabled | SentimentEmpty>(
      `${this.baseUrl}/event/${eventId}/sentiment`
    );
  }
}
