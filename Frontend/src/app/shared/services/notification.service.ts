import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, Subscription, interval, of } from 'rxjs';
import { catchError, switchMap, tap } from 'rxjs/operators';
import { apiUrl } from '../../../environments/environment';

/** Shape returned by GET /api/notifications. */
export interface AppNotification {
  id: string;
  type: string;
  severity: 'info' | 'warning' | 'success';
  title: string;
  message: string;
  link?: string;
  createdAt: string;
  ageLabel: string;
}

export interface NotificationFeed {
  items: AppNotification[];
  unread: number;
}

/**
 * Polls the backend for the current user's notification feed.
 *
 * Why polling and not WebSocket?
 *   The backend computes the feed from existing collections (events, PVs).
 *   For a 3-week academic demo, a 60s poll is a fair trade-off between
 *   freshness and complexity (no SSE/WS plumbing needed).
 *
 * Why a singleton service with a BehaviorSubject?
 *   So the bell icon, the dropdown panel and any future widget can all
 *   subscribe to the SAME stream — no duplicate HTTP calls.
 */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly endpoint = apiUrl('/api/notifications');
  /** 60 seconds — short enough for a demo, long enough to spare the backend. */
  private readonly pollIntervalMs = 60_000;

  private readonly feed$ = new BehaviorSubject<NotificationFeed>({ items: [], unread: 0 });
  private pollSub: Subscription | null = null;

  constructor(private http: HttpClient) {}

  /** Stream consumed by the bell + dropdown. */
  observe(): Observable<NotificationFeed> {
    return this.feed$.asObservable();
  }

  /** One-shot fetch; also updates the shared stream. */
  refresh(): Observable<NotificationFeed> {
    return this.http.get<NotificationFeed>(this.endpoint).pipe(
      catchError(() => of<NotificationFeed>({ items: [], unread: 0 })),
      tap(feed => this.feed$.next(feed))
    );
  }

  /** Begin background polling. Idempotent — safe to call repeatedly. */
  startPolling(): void {
    if (this.pollSub) return;
    this.refresh().subscribe();
    this.pollSub = interval(this.pollIntervalMs)
      .pipe(switchMap(() => this.refresh()))
      .subscribe();
  }

  /** Stop polling (called on logout / component teardown). */
  stopPolling(): void {
    this.pollSub?.unsubscribe();
    this.pollSub = null;
    this.feed$.next({ items: [], unread: 0 });
  }
}
