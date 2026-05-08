import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';
import { TreasuryApiService } from '../../services/treasury-api.service';
import { MockUser } from '../../models/treasury.models';

@Component({
  selector: 'app-espace-membre',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="p-6 space-y-6 max-w-4xl mx-auto">

      <!-- Header user -->
      <div class="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-8 text-white shadow-lg">
        <p class="text-sm opacity-80">Member Area</p>
        <h1 class="text-3xl font-bold mt-1" *ngIf="user">Hello, {{ user.firstName }}!</h1>
        <p class="text-sm opacity-80 mt-2" *ngIf="user">{{ user.email }} · {{ roleLabel(user.role) }}</p>
        <div *ngIf="!user" class="mt-2">
          <a routerLink="/signin" class="px-4 py-2 bg-white text-blue-700 rounded-lg text-sm font-medium">Sign in</a>
        </div>
      </div>

      <!-- Stats rapides -->
      <div *ngIf="user" class="grid grid-cols-3 gap-4">
        <div class="bg-white dark:bg-gray-800 rounded-xl border p-5 text-center">
          <p class="text-3xl font-bold" [class]="pendingPayments > 0 ? 'text-red-600' : 'text-green-600'">{{ pendingPayments }}</p>
          <p class="text-sm text-gray-500 mt-1">Due(s) to pay</p>
        </div>
        <a routerLink="/treasury/demande-depense" class="bg-white dark:bg-gray-800 rounded-xl border p-5 text-center hover:border-orange-300 transition">
          <div class="text-3xl mb-1">📝</div>
          <p class="text-sm text-gray-500 mt-1">Submit an expense</p>
        </a>
        <div class="bg-white dark:bg-gray-800 rounded-xl border p-5 text-center">
          <p class="text-3xl font-bold" [class]="unreadNotifs > 0 ? 'text-orange-600' : 'text-gray-400'">{{ unreadNotifs }}</p>
          <p class="text-sm text-gray-500 mt-1">Notification(s)</p>
        </div>
      </div>

      <!-- Actions -->
      <div *ngIf="user" class="grid md:grid-cols-3 gap-5">

        <a routerLink="/treasury/payer-cotisation"
           class="bg-white dark:bg-gray-800 rounded-2xl border p-6 hover:border-blue-400 hover:shadow-md transition block group">
          <div class="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mb-4 group-hover:bg-green-200 transition">
            <svg class="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8V7m0 1v8m0 0v1"/>
            </svg>
          </div>
          <h3 class="font-bold text-gray-800 dark:text-white">Pay my due</h3>
          <p class="text-sm text-gray-500 mt-1">Payment by card or cash</p>
          <span *ngIf="pendingPayments > 0" class="mt-3 inline-block px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-bold">{{ pendingPayments }} pending</span>
        </a>

        <a routerLink="/treasury/demande-depense"
           class="bg-white dark:bg-gray-800 rounded-2xl border p-6 hover:border-blue-400 hover:shadow-md transition block group">
          <div class="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center mb-4 group-hover:bg-orange-200 transition">
            <svg class="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
            </svg>
          </div>
          <h3 class="font-bold text-gray-800 dark:text-white">Expense request</h3>
          <p class="text-sm text-gray-500 mt-1">Submit a reimbursement</p>
        </a>

        <a routerLink="/treasury/mes-notifications"
           class="bg-white dark:bg-gray-800 rounded-2xl border p-6 hover:border-blue-400 hover:shadow-md transition block group">
          <div class="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mb-4 group-hover:bg-purple-200 transition">
            <svg class="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
            </svg>
          </div>
          <h3 class="font-bold text-gray-800 dark:text-white">My notifications</h3>
          <p class="text-sm text-gray-500 mt-1">Emails, alerts and confirmations</p>
          <span *ngIf="unreadNotifs > 0" class="mt-3 inline-block px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-bold">{{ unreadNotifs }} unread</span>
        </a>

      </div>
    </div>
  `,
})
export class EspaceMembreComponent implements OnInit {
  user: MockUser | null = null;
  pendingPayments = 0;
  unreadNotifs = 0;

  private auth = inject(AuthService);
  private api = inject(TreasuryApiService);
  private http = inject(HttpClient);

  ngOnInit() {
    this.user = this.auth.current();
    if (!this.user) {
      this.auth.refreshFromServer().subscribe((u) => {
        this.user = u;
        if (u) this.loadStats();
      });
    } else {
      this.loadStats();
    }
  }

  private loadStats() {
    this.api.getMyPayments(1, this.user!.id).subscribe({
      next: (data) => { this.pendingPayments = data.filter(p => p.status === 'PENDING' || p.status === 'LATE').length; },
      error: () => {}
    });
    this.http.get<any>(`http://localhost:8084/api/v1/treasury/1/notifications/user/${this.user!.id}/count`).subscribe({
      next: (r: any) => { this.unreadNotifs = r.unread || 0; },
      error: () => {}
    });
  }

  roleLabel(r: string): string {
    const m: Record<string, string> = {
      PRESIDENT: 'President', VICE_PRESIDENT: 'Vice-president',
      SECRETAIRE_GENERALE: 'General Secretary', TRESORIER: 'Treasurer',
      RH: 'Human Resources', MEMBRE_SIMPLE: 'Member'
    };
    return m[r] ?? r;
  }
}
