import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { apiUrl } from '../../../environments/environment';

/** A question shown to the secretary in the wizard. */
export interface PvQuestion {
  /** Stable id used to remap answers across re-edits. */
  id: string;
  /** Human-readable label. */
  label: string;
  /** "yesno" → 3 radios; "text" → free textarea. */
  type: 'yesno' | 'text';
  /** PV section the question belongs to (préambule / déroulement / …). */
  section?: string;
}

/** One question/answer pair the secretary fills in. */
export interface PvQaPair {
  questionId?: string;
  question: string;
  /** "oui" | "non" | "sans avis" for yesno; free text otherwise. */
  answer: string;
  type?: 'yesno' | 'text';
  section?: string;
  /** Free-text explanation revealed only when answer === 'non'. */
  explanation?: string;
}

/** Event waiting for a PV (returned by /api/pv/pending). */
export interface PendingPvEvent {
  eventId: string;
  title: string;
  endDate: string;
  location?: string | null;
}

/** Aggregated stats shown to the secretary BEFORE answering. */
export interface PvEventContext {
  eventId: string;
  title: string;
  description?: string;
  status?: string;
  format?: string;
  capacity?: number;
  startDate?: string;
  endDate?: string;
  durationMinutes?: number;
  location?: { name?: string; address?: string };
  staff?: Array<{ name: string; role: string; budget?: number }>;
  attendance?: {
    confirmed: number;
    checkedIn: number;
    totalRsvps: number;
    noShows: number;
    capacity: number;
    fillRatePct: number;
    attendanceRatePct: number;
  };
  tasks?: {
    total: number;
    done: number;
    inProgress: number;
    todo: number;
    success: number;
    partial: number;
    skipped: number;
    completionRatePct: number;
    highlights?: Array<{ title: string; assignee: string; outcome: string; note: string }>;
  };
  borrowedItems?: {
    count: number;
    items?: Array<{ name: string; lender: string; status: string }>;
  };
  feedback?: {
    count: number;
    avgOrganization: number;
    avgContent: number;
    avgAnimation: number;
    avgVenue: number;
    avgSchedule: number;
    avgNps: number;
    topTags?: Array<{ tag: string; count: number }>;
    comments?: string[];
  };
}

/** Full PV stored in Mongo (returned by /api/pv and /api/pv/{id}). */
export interface MeetingPv {
  id: string;
  eventId: string;
  eventTitle: string;
  eventDate?: string | null;
  secretaryId: string;
  secretaryName?: string | null;
  qaPairs: PvQaPair[];
  additionalNotes?: string | null;
  generatedContent: string;
  sourceLanguage?: string | null;
  createdAt: string;
  updatedAt: string;
}

@Injectable({ providedIn: 'root' })
export class MeetingPvService {
  private readonly base = apiUrl('/api/pv');

  constructor(private http: HttpClient) {}

  /**
   * Default Q&A list (kept server-side so the form stays in sync).
   * `structured` is the new shape (id+label+type) — `questions` remains
   * for backward compatibility.
   */
  getDefaultQuestions(): Observable<{ questions: string[]; structured: PvQuestion[] }> {
    return this.http.get<{ questions: string[]; structured: PvQuestion[] }>(
      `${this.base}/questions`);
  }

  /** Real numbers we already know about the event. */
  getEventContext(eventId: string): Observable<PvEventContext> {
    return this.http.get<PvEventContext>(`${this.base}/event-context/${eventId}`);
  }

  /** Events that have already ended but don't have a PV yet. */
  getPending(): Observable<PendingPvEvent[]> {
    return this.http.get<PendingPvEvent[]>(`${this.base}/pending`);
  }

  /**
   * Generate a draft via Gemini WITHOUT saving — used by the wizard preview
   * so the secretary can edit before commit.
   */
  generateDraft(payload: {
    eventId: string;
    qaPairs: PvQaPair[];
    additionalNotes?: string;
    sourceLanguage?: string;
  }): Observable<{ generatedContent: string; sourceLanguage: string }> {
    return this.http.post<{ generatedContent: string; sourceLanguage: string }>(
      `${this.base}/generate`, payload);
  }

  /** Persist the (possibly edited) PV. */
  save(payload: {
    eventId: string;
    qaPairs: PvQaPair[];
    additionalNotes?: string;
    generatedContent: string;
    sourceLanguage?: string;
  }): Observable<MeetingPv> {
    return this.http.post<MeetingPv>(this.base, payload);
  }

  list(): Observable<MeetingPv[]> {
    return this.http.get<MeetingPv[]>(this.base);
  }

  delete(id: string): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(`${this.base}/${id}`);
  }

  /** URL to download the styled PDF (open in a new tab). */
  pdfUrl(id: string): string {
    return `${this.base}/${id}/pdf`;
  }
}
