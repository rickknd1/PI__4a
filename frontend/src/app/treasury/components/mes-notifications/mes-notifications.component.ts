import { Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { UserContextService } from '../../services/user-context.service';
import { MockUser } from '../../models/treasury.models';

interface Notif {
  id: number; type: string; title: string; message: string;
  read: boolean; emailSent: boolean; createdAt: string;
}

@Component({
  selector: 'app-mes-notifications',
  standalone: true,
  imports: [CommonModule, DatePipe, RouterLink],
  template: `
    <div class="p-6 space-y-6">

      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <a routerLink="/treasury/espace-membre" class="p-2 hover:bg-gray-100 rounded-lg transition">
            <svg class="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
            </svg>
          </a>
          <div>
            <h2 class="text-2xl font-bold text-gray-800 dark:text-white">My notifications</h2>
            <p class="text-sm text-gray-500" *ngIf="user">{{ user.firstName }} {{ user.lastName }}</p>
          </div>
        </div>
        <button *ngIf="notifications.length > 0" (click)="markAllRead()"
                class="px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition">
          Mark all as read
        </button>
      </div>

      <div *ngIf="!user" class="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-center">
        <p class="text-yellow-700 font-medium">Please sign in first</p>
        <a routerLink="/treasury/login" class="mt-3 inline-block px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">Sign in</a>
      </div>

      <div *ngIf="loading" class="text-center py-12">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
      </div>

      <div *ngIf="!loading && notifications.length === 0" class="bg-gray-50 rounded-xl border p-8 text-center">
        <p class="text-gray-400">No notifications yet.</p>
      </div>

      <div *ngIf="!loading" class="space-y-3">
        <div *ngFor="let n of paginatedNotifications" (click)="markRead(n)"
             class="bg-white dark:bg-gray-800 rounded-xl border p-4 cursor-pointer transition hover:shadow-sm"
             [class.border-blue-300]="!n.read" [class.bg-blue-50]="!n.read">
          <div class="flex items-start justify-between">
            <div class="flex-1">
              <div class="flex items-center gap-2 mb-1">
                <span [class]="typeClass(n.type)" class="px-2 py-0.5 rounded-full text-xs font-medium">{{ typeLabel(n.type) }}</span>
                <span *ngIf="!n.read" class="w-2 h-2 bg-blue-500 rounded-full"></span>
                <span *ngIf="n.emailSent" class="text-xs text-gray-400">Email sent</span>
              </div>
              <p class="font-medium text-gray-800 dark:text-white">{{ n.title }}</p>
              <p class="text-sm text-gray-500 mt-1">{{ n.message }}</p>
            </div>
            <p class="text-xs text-gray-400 whitespace-nowrap ml-4">{{ n.createdAt | date:'dd/MM HH:mm' }}</p>
          </div>
        </div>
      </div>

      <!-- Pagination -->
      <div *ngIf="!loading && totalPages > 1" class="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700">
        <span class="text-sm text-gray-500">Page {{page+1}} / {{totalPages}} ({{total}} items)</span>
        <div class="flex gap-2">
          <button (click)="page=page-1" [disabled]="page===0" class="px-3 py-1 text-sm border rounded-lg hover:bg-gray-50 disabled:opacity-40 dark:border-gray-600 dark:hover:bg-gray-700">Previous</button>
          <button (click)="page=page+1" [disabled]="page>=totalPages-1" class="px-3 py-1 text-sm border rounded-lg hover:bg-gray-50 disabled:opacity-40 dark:border-gray-600 dark:hover:bg-gray-700">Next</button>
        </div>
      </div>

    </div>
  `,
})
export class MesNotificationsComponent implements OnInit {
  user: MockUser | null = null;
  notifications: Notif[] = [];
  loading = true;

  // Pagination
  page = 0;
  pageSize = 10;
  get total(): number { return this.notifications.length; }
  get totalPages(): number { return Math.max(1, Math.ceil(this.total / this.pageSize)); }
  get paginatedNotifications(): Notif[] {
    const start = this.page * this.pageSize;
    return this.notifications.slice(start, start + this.pageSize);
  }

  constructor(private http: HttpClient, private userCtx: UserContextService) {}

  ngOnInit() {
    this.user = this.userCtx.getCurrentUser();
    if (!this.user) { this.loading = false; return; }
    this.load();
  }

  load() {
    this.http.get<Notif[]>(`http://localhost:8084/api/v1/treasury/1/notifications/user/${this.user!.id}`).subscribe({
      next: (data) => { this.notifications = data; this.page = 0; this.loading = false; },
      error: () => { this.loading = false; }
    });
  }

  markRead(n: Notif) {
    if (n.read) return;
    this.http.patch(`http://localhost:8084/api/v1/treasury/1/notifications/${n.id}/read`, {}).subscribe({
      next: () => { n.read = true; }
    });
  }

  markAllRead() {
    this.http.patch(`http://localhost:8084/api/v1/treasury/1/notifications/user/${this.user!.id}/read-all`, {}).subscribe({
      next: () => { this.notifications.forEach(n => n.read = true); }
    });
  }

  typeClass(t: string): string {
    const m: Record<string, string> = {
      PAYMENT_DUE: 'bg-yellow-100 text-yellow-700', PAYMENT_CONFIRMED: 'bg-green-100 text-green-700',
      PAYMENT_LATE: 'bg-red-100 text-red-700', PAYMENT_REFUNDED: 'bg-blue-100 text-blue-700',
      EXPENSE_SUBMITTED: 'bg-blue-100 text-blue-700', EXPENSE_VALIDATED: 'bg-yellow-100 text-yellow-700',
      EXPENSE_APPROVED: 'bg-green-100 text-green-700', EXPENSE_REJECTED: 'bg-red-100 text-red-700',
      BUDGET_ALERT: 'bg-orange-100 text-orange-700', INVOICE_GENERATED: 'bg-purple-100 text-purple-700',
      REPORT_GENERATED: 'bg-indigo-100 text-indigo-700',
    };
    return m[t] ?? 'bg-gray-100 text-gray-600';
  }
  typeLabel(t: string): string {
    const m: Record<string, string> = {
      PAYMENT_DUE: 'Due', PAYMENT_CONFIRMED: 'Payment', PAYMENT_LATE: 'Late',
      EXPENSE_SUBMITTED: 'Expense', EXPENSE_VALIDATED: 'Validation', EXPENSE_APPROVED: 'Approval',
      EXPENSE_REJECTED: 'Rejected', BUDGET_ALERT: 'Budget', INVOICE_GENERATED: 'Invoice',
    };
    return m[t] ?? t;
  }
}
