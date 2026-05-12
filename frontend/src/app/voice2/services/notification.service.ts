import { Injectable, NgZone, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject } from 'rxjs';
import { apiUrl } from '../../../environments/environment';

export interface Voice2AppNotification {
  id: string;
  userId: string;
  type?: string;
  message: string;
  reportId: string;
  reportedUserId: string;
  read: boolean;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class Voice2NotificationService implements OnDestroy {
  private readonly api = apiUrl('/api/voice2/notifications');
  private notificationsSubject = new BehaviorSubject<Voice2AppNotification[]>([]);
  readonly notifications$ = this.notificationsSubject.asObservable();

  private pollInterval: ReturnType<typeof setInterval> | null = null;
  private currentUserId = '';

  constructor(private http: HttpClient, private ngZone: NgZone) {}

  load(userId: string): void {
    if (!userId?.trim()) return;
    if (this.currentUserId === userId && this.pollInterval) return;
    this.currentUserId = userId;
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    this.fetch();

    this.ngZone.runOutsideAngular(() => {
      this.pollInterval = setInterval(() => this.fetch(), 15000);
    });
  }

  private fetch(): void {
    if (!this.currentUserId) return;
    this.http.get<Voice2AppNotification[]>(`${this.api}?userId=${encodeURIComponent(this.currentUserId)}`).subscribe({
      next: (data) => this.ngZone.run(() => this.notificationsSubject.next(data)),
      error: (err) => {
        console.error('[voice2] notifications fetch failed', {
          url: this.api,
          userId: this.currentUserId,
          status: err?.status,
          error: err?.error,
        });
      },
    });
  }

  markRead(id: string): void {
    this.http.patch(`${this.api}/${id}/read`, {}).subscribe({
      next: () => {
        const nextList = this.notificationsSubject.value.map((item) =>
          item.id === id ? { ...item, read: true } : item,
        );
        this.notificationsSubject.next(nextList);
      },
      error: (err) => {
        console.error('[voice2] mark notification read failed', {
          id,
          status: err?.status,
          error: err?.error,
        });
      },
    });
  }

  get unreadCount(): number {
    return this.notificationsSubject.value.filter((item) => !item.read).length;
  }

  ngOnDestroy(): void {
    if (this.pollInterval) clearInterval(this.pollInterval);
  }
}
