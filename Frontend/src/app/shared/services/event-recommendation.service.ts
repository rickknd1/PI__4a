import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { apiUrl } from '../../../environments/environment';

export interface FormatRecommendation {
  format: string;
  totalEvents: number;
  totalAttendees?: number;
  avgAttendanceRate: number;   // 0..1
  avgRsvpRate?: number;        // 0..1 (stats mode only)
  avgFeedback: number | null;  // 1..5
  score: number;               // 0..100
  confidence: 'low' | 'medium' | 'high';
  /** Plain-language reason from the LLM (only present in 'llm' mode). */
  rationale?: string;
}

export interface StaffRecommendation {
  name: string;
  role: string;
  totalEvents: number;
  avgAttendanceRate: number;
  avgFeedback: number | null;
  score: number;
  confidence: 'low' | 'medium' | 'high';
  rationale?: string;
}

export interface SuggestedStaffRef {
  name: string;
  role: string;
}

export interface TimingRecommendation {
  /** Human-readable day name ("Saturday") OR slot label ("afternoon"). */
  label: string;
  /** Present only on slot buckets ("morning"/"afternoon"/...). */
  slot?: string | null;
  totalEvents: number;
  avgAttendanceRate: number;
  avgHour: number;
  score: number;
  confidence: 'low' | 'medium' | 'high';
}

export interface SuggestedTiming {
  /** "Saturday" (English, returned as-is from Java DayOfWeek). */
  dayOfWeek: string;
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night' | string;
  /** ISO local date-time of the next occurrence of the recommended day. */
  suggestedDate: string;
  typicalHour: number;
  score: number;
  confidence: 'low' | 'medium' | 'high';
  rationale?: string;
}

/**
 * Top-level recommendation payload.
 *
 * All array/string fields are optional because:
 *   - in "stats-fallback" mode some sections may be empty
 *   - in "llm" mode the model may legitimately skip a section it has no
 *     evidence for. The UI guards every block.
 */
export interface EventRecommendations {
  totalPastEvents: number;
  topFormats?: FormatRecommendation[];
  topStaff?: StaffRecommendation[];
  insights?: string[];
  suggestedFormat?: string | null;
  suggestedStaff?: SuggestedStaffRef[] | StaffRecommendation[];
  /** New: best (day-of-week + time-of-day) slot + a concrete next date. */
  suggestedTiming?: SuggestedTiming | null;
  topTiming?: TimingRecommendation[];
  generatedAt: string;
  emptyState?: string;

  /** "llm" when produced by Gemini, "stats" or "stats-fallback" otherwise. */
  source?: 'llm' | 'stats' | 'stats-fallback';
  model?: string;
  /** LLM-only: 2-4 concrete actions to try at the next event. */
  nextActions?: string[];
  /** LLM-only: data-quality warnings the user should be aware of. */
  caveats?: string[];
}

@Injectable({ providedIn: 'root' })
export class EventRecommendationService {
  private baseUrl = apiUrl('/api/recommendations');

  constructor(private http: HttpClient) {}

  getRecommendations(): Observable<EventRecommendations> {
    return this.http.get<EventRecommendations>(`${this.baseUrl}/events`);
  }

  /**
   * Asks the backend to draft a short event description grounded in past
   * same-format events. Returns "" when the LLM is disabled — the caller
   * should keep its own textarea content untouched in that case.
   */
  describeEvent(title: string, format?: string, lang: string = 'fr'):
      Observable<{ description: string; source: 'llm' | 'unavailable'; hint?: string }> {
    let url = `${this.baseUrl}/event-description?title=${encodeURIComponent(title)}&lang=${encodeURIComponent(lang)}`;
    if (format) url += `&format=${encodeURIComponent(format)}`;
    return this.http.get<{ description: string; source: 'llm' | 'unavailable'; hint?: string }>(url);
  }
}
