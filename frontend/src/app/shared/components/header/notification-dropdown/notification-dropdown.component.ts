import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { DropdownComponent } from '../../ui/dropdown/dropdown.component';
import {
  AppNotification,
  NotificationService
} from '../../../services/notification.service';
import { AuthService } from '../../../services/auth.service';
import { Voice2AppNotification, Voice2NotificationService } from '../../../../voice2/services/notification.service';

/**
 * Header bell icon + dropdown.
 *
 * Subscribes to {@link NotificationService} which polls the backend every
 * 60s and feeds every consumer through a single BehaviorSubject. Items are
 * computed server-side from domain state (e.g. completed events that still
 * lack a PV for the SECRETAIRE_GENERALE), so there is no per-user inbox to
 * maintain — the feed always reflects "what's actionable right now".
 */
@Component({
  selector: 'app-notification-dropdown',
  standalone: true,
  templateUrl: './notification-dropdown.component.html',
  imports: [CommonModule, RouterModule, DropdownComponent]
})
export class NotificationDropdownComponent implements OnInit, OnDestroy {
  isOpen = false;
  /** Pulses the orange dot until the user opens the dropdown at least once. */
  notifying = false;

  notifications: AppNotification[] = [];
  private systemNotifications: AppNotification[] = [];
  private voice2Notifications: Voice2AppNotification[] = [];
  private systemUnread = 0;
  private currentIsBureau = false;
  unreadCount = 0;

  private sub: Subscription | null = null;
  private voice2Sub: Subscription | null = null;
  private userSub: Subscription | null = null;

  constructor(
    private notifService: NotificationService,
    private voice2NotifService: Voice2NotificationService,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.notifService.startPolling();
    this.sub = this.notifService.observe().subscribe(feed => {
      this.systemNotifications = feed.items;
      this.systemUnread = feed.unread;
      this.refreshCombinedFeed();
    });

    this.bindVoice2Notifications();
    this.userSub = this.authService.userProfile$.subscribe((user) => {
      const uid = user?.userId || user?.id || '';
      this.currentIsBureau = this.authService.isBureau();
      if (uid) this.voice2NotifService.load(uid);
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.voice2Sub?.unsubscribe();
    this.userSub?.unsubscribe();
  }

  toggleDropdown(): void {
    this.isOpen = !this.isOpen;
    if (this.isOpen) this.notifying = false;
  }

  closeDropdown(): void {
    this.isOpen = false;
  }

  openNotification(n: AppNotification): void {
    const source = (n as any)._source;
    const voice2Id = (n as any)._voice2Id as string | undefined;
    if (source === 'voice2' && voice2Id) {
      this.voice2NotifService.markRead(voice2Id);
    }
    this.closeDropdown();
    if (n.link) this.router.navigate([n.link]);
  }

  /** Tailwind colour classes for the severity dot on each row. */
  severityDotClass(n: AppNotification): string {
    switch (n.severity) {
      case 'warning': return 'bg-orange-400';
      case 'success': return 'bg-emerald-500';
      default:        return 'bg-blue-500';
    }
  }

  /** Big emoji used in lieu of an avatar (no per-user picture for system notifs). */
  iconFor(n: AppNotification): string {
    switch (n.type) {
      case 'pv-pending':  return '📄';
      case 'pv-overdue':  return '⏰';
      case 'voice2-report': return '🎙️';
      default:            return '🔔';
    }
  }

  private voice2UnreadCount(): number {
    return this.voice2Notifications.filter((n) => !n.read).length;
  }

  private refreshCombinedFeed(): void {
    this.notifications = this.mergeNotifications(this.systemNotifications, this.voice2Notifications);
    this.unreadCount = this.systemUnread + this.voice2UnreadCount();
    this.notifying = this.unreadCount > 0 && !this.isOpen;
  }

  private bindVoice2Notifications(): void {
    const current = this.authService.getCurrentUser();
    const uid = current?.userId || current?.id || '';
    this.currentIsBureau = this.authService.isBureau();
    if (uid) this.voice2NotifService.load(uid);
    this.voice2Sub = this.voice2NotifService.notifications$.subscribe((items) => {
      this.voice2Notifications = items;
      this.refreshCombinedFeed();
    });
  }

  private mergeNotifications(systemItems: AppNotification[], voice2Items: Voice2AppNotification[]): AppNotification[] {
    const mappedVoice2: AppNotification[] = voice2Items.map((n) => ({
      id: `voice2-${n.id}`,
      type: 'voice2-report',
      severity: n.read ? 'info' : 'warning',
      title: 'Voice report update',
      message: n.message,
      link:
        n.type === 'REPORT_CREATED'
          ? '/voice2/audio-reports'
          : n.type === 'REPORT_DECISION'
            ? '/voice2/my-reports'
            : this.currentIsBureau
              ? '/voice2/audio-reports'
              : '/voice2/my-reports',
      createdAt: n.createdAt,
      ageLabel: this.relativeAge(n.createdAt),
      // Internal metadata for click handling
      ...( { _source: 'voice2', _voice2Id: n.id } as any ),
    }));
    const withSourceSystem = systemItems.map((n) => ({ ...(n as any), _source: 'system' })) as AppNotification[];
    return [...mappedVoice2, ...withSourceSystem].sort((a, b) => {
      const da = new Date(a.createdAt).getTime();
      const db = new Date(b.createdAt).getTime();
      return db - da;
    });
  }

  private relativeAge(iso: string): string {
    const ts = new Date(iso).getTime();
    if (Number.isNaN(ts)) return 'now';
    const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
    if (diffSec < 60) return 'now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h`;
    return `${Math.floor(diffSec / 86400)}d`;
  }
}
