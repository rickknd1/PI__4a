import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { DropdownComponent } from '../../ui/dropdown/dropdown.component';
import { DropdownItemComponent } from '../../ui/dropdown/dropdown-item/dropdown-item.component';
import { NotificationService, AppNotification } from '../../../services/notification.service';
import { AuthService } from '../../../../services/auth.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-notification-dropdown',
  standalone: true,
  templateUrl: './notification-dropdown.component.html',
  imports: [CommonModule, RouterModule, DropdownComponent, DropdownItemComponent]
})
export class NotificationDropdownComponent implements OnInit, OnDestroy {
  isOpen = false;
  notifications: AppNotification[] = [];
  private sub = new Subscription();

  constructor(
    public notifService: NotificationService,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit() {
    const user = this.authService.getCurrentUser();
    if (user?.userId) {
      this.notifService.load(user.userId);
    }
    // Subscribe so this.notifications stays in sync — Angular CD picks up changes here
    this.sub.add(
      this.notifService.notifications$.subscribe(n => this.notifications = n)
    );
  }

  ngOnDestroy() { this.sub.unsubscribe(); }

  get unreadCount(): number {
    return this.notifications.filter(n => !n.read).length;
  }

  get notifying(): boolean { return this.unreadCount > 0; }

  get isBureauMember(): boolean {
    const user = this.authService.getCurrentUser();
    return !!user && user.role !== 'MEMBRE_SIMPLE';
  }

  toggleDropdown() { this.isOpen = !this.isOpen; }
  closeDropdown() { this.isOpen = false; }

  onNotificationClick(notif: AppNotification) {
    if (!notif.read) this.notifService.markRead(notif.id);
    this.closeDropdown();
    const user = this.authService.getCurrentUser();
    if (user && user.role !== 'MEMBRE_SIMPLE') {
      this.router.navigate(['/audio-reports']);
    } else {
      this.router.navigate(['/my-reports']);
    }
  }

  formatTime(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const min = Math.floor(diff / 60000);
    if (min < 60) return min <= 1 ? 'Just now' : `${min} min ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr} hr ago`;
    return `${Math.floor(hr / 24)} day${Math.floor(hr / 24) > 1 ? 's' : ''} ago`;
  }
}
