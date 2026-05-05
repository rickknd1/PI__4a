import { Injectable, NgZone, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject } from 'rxjs';

export interface AppNotification {
  id: string;
  userId: string;
  message: string;
  reportId: string;
  reportedUserId: string;
  read: boolean;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class NotificationService implements OnDestroy {

  private readonly api = 'http://localhost:8080/api/notifications';
  private _notifications = new BehaviorSubject<AppNotification[]>([]);
  readonly notifications$ = this._notifications.asObservable();

  private pollInterval: ReturnType<typeof setInterval> | null = null;
  private currentUserId = '';

  constructor(private http: HttpClient, private ngZone: NgZone) {}

  load(userId: string) {
    if (this.currentUserId === userId && this.pollInterval) return;
    this.currentUserId = userId;
    this.fetch();
    // Run interval outside Angular zone to avoid triggering unnecessary CD,
    // but re-enter zone when data arrives so the template updates
    this.ngZone.runOutsideAngular(() => {
      if (this.pollInterval) clearInterval(this.pollInterval);
      this.pollInterval = setInterval(() => this.fetch(), 15000);
    });
  }

  private fetch() {
    if (!this.currentUserId) return;
    this.http.get<AppNotification[]>(`${this.api}?userId=${this.currentUserId}`)
      .subscribe({
        next: (data) => this.ngZone.run(() => this._notifications.next(data)),
        error: () => {}
      });
  }

  markRead(id: string) {
    this.http.patch(`${this.api}/${id}/read`, {}).subscribe({
      next: () => {
        const list = this._notifications.value.map(n => n.id === id ? { ...n, read: true } : n);
        this._notifications.next(list);
      },
      error: () => {}
    });
  }

  get unreadCount(): number {
    return this._notifications.value.filter(n => !n.read).length;
  }

  ngOnDestroy() {
    if (this.pollInterval) clearInterval(this.pollInterval);
  }
}
