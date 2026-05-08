import { Component, OnInit } from '@angular/core';
import { CommonModule, DecimalPipe, DatePipe } from '@angular/common';
import { TreasuryApiService } from '../../services/treasury-api.service';
import { AuthService } from '../../services/auth.service';
import { Payment, MockUser } from '../../models/treasury.models';

@Component({
  selector: 'app-membre-paiement',
  standalone: true,
  imports: [CommonModule, DecimalPipe, DatePipe],
  template: `
    <div class="p-6 space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-2xl font-bold text-gray-800 dark:text-white">My Payments</h2>
          <p class="text-sm text-gray-500 mt-1" *ngIf="user">Signed in as {{ user.firstName }} {{ user.lastName }} ({{ user.role }})</p>
        </div>
      </div>

      <div *ngIf="!user" class="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-yellow-700">
        Please sign in first via the user selection page.
      </div>

      <div *ngIf="loading" class="text-center py-12">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
      </div>

      <div *ngIf="error" class="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">{{ error }}</div>

      <!-- Stats rapides -->
      <div *ngIf="!loading && user" class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div class="bg-white dark:bg-gray-800 rounded-xl border p-4 text-center">
          <p class="text-sm text-gray-500">Total due</p>
          <p class="text-xl font-bold text-gray-800 dark:text-white">{{ totalDue | number:'1.2-2' }} TND</p>
        </div>
        <div class="bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 p-4 text-center">
          <p class="text-sm text-green-600">Paid</p>
          <p class="text-xl font-bold text-green-700">{{ totalPaid | number:'1.2-2' }} TND</p>
        </div>
        <div class="bg-yellow-50 dark:bg-yellow-900/20 rounded-xl border border-yellow-200 p-4 text-center">
          <p class="text-sm text-yellow-600">Pending</p>
          <p class="text-xl font-bold text-yellow-700">{{ totalPending | number:'1.2-2' }} TND</p>
        </div>
        <div class="bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 p-4 text-center">
          <p class="text-sm text-red-600">Late</p>
          <p class="text-xl font-bold text-red-700">{{ totalLate | number:'1.2-2' }} TND</p>
        </div>
      </div>

      <!-- Liste des paiements -->
      <div *ngIf="!loading && user" class="bg-white dark:bg-gray-800 rounded-xl border overflow-hidden">
        <table class="w-full text-sm">
          <thead class="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Due date</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Paid on</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
            <tr *ngFor="let p of payments" class="hover:bg-gray-50 dark:hover:bg-gray-700/50">
              <td class="px-4 py-3 text-gray-400">#{{ p.id }}</td>
              <td class="px-4 py-3 font-medium">{{ p.amount | number:'1.2-2' }} TND</td>
              <td class="px-4 py-3">
                <span [class]="statusClass(p.status)" class="px-2 py-1 rounded-full text-xs font-medium">{{ statusLabel(p.status) }}</span>
              </td>
              <td class="px-4 py-3 text-gray-500">{{ p.dueDate }}</td>
              <td class="px-4 py-3 text-gray-400">{{ p.paidAt ? (p.paidAt | date:'dd/MM/yy HH:mm') : '-' }}</td>
              <td class="px-4 py-3">
                <button *ngIf="p.status === 'PENDING' || p.status === 'LATE'"
                        (click)="pay(p)" [disabled]="paying === p.id"
                        class="px-3 py-1 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-40 transition">
                  {{ paying === p.id ? 'Processing...' : 'Pay' }}
                </button>
                <button *ngIf="p.status === 'PAID'"
                        (click)="downloadReceipt(p)"
                        class="px-3 py-1 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-200 transition">
                  PDF Receipt
                </button>
                <span *ngIf="p.status === 'EXEMPT'" class="text-xs text-gray-400">Exempt</span>
              </td>
            </tr>
            <tr *ngIf="payments.length === 0">
              <td colspan="6" class="px-4 py-8 text-center text-gray-400">No payments yet.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div *ngIf="paymentMessage" class="bg-green-50 border border-green-200 rounded-xl p-4 text-green-700">
        {{ paymentMessage }}
      </div>
    </div>
  `,
})
export class MembrePaiementComponent implements OnInit {
  user: MockUser | null = null;
  payments: Payment[] = [];
  loading = true;
  error = '';
  paying: string | null = null;
  paymentMessage = '';
  totalDue = 0; totalPaid = 0; totalPending = 0; totalLate = 0;

  constructor(private api: TreasuryApiService, private auth: AuthService) {}

  ngOnInit() {
    this.user = this.auth.current();
    if (!this.user) {
      this.auth.refreshFromServer().subscribe((u) => {
        this.user = u;
        if (u) { this.loadPayments(); } else { this.loading = false; }
      });
    } else {
      this.loadPayments();
    }
  }

  loadPayments() {
    this.loading = true;
    this.api.getMyPayments(1, this.user!.id).subscribe({
      next: (data) => {
        this.payments = data;
        this.computeStats();
        this.loading = false;
      },
      error: () => { this.error = 'Unable to load payments.'; this.loading = false; }
    });
  }

  computeStats() {
    this.totalDue = this.totalPaid = this.totalPending = this.totalLate = 0;
    this.payments.forEach(p => {
      const a = Number(p.amount);
      this.totalDue += a;
      if (p.status === 'PAID') this.totalPaid += a;
      else if (p.status === 'PENDING') this.totalPending += a;
      else if (p.status === 'LATE') this.totalLate += a;
    });
  }

  pay(p: Payment) {
    this.paying = p.id;
    this.paymentMessage = '';
    // Simuler confirmation Stripe (en mode test)
    this.api.createPaymentIntent(1, p.id, this.user!.firstName + ' ' + this.user!.lastName).subscribe({
      next: (intent) => {
        // En mode mock ou test, confirmer directement
        const headers: any = { 'Content-Type': 'application/json', 'X-Actor-Id': String(this.user!.id), 'X-Actor-Email': this.user!.email };
        this.api.confirmPayment(1, p.id, intent.paymentIntentId, this.user!.id, this.user!.email).subscribe({
          next: () => {
            this.paymentMessage = 'Payment #' + p.id + ' confirmed! Mode: ' + intent.mode + '. A receipt will be sent to you by email.';
            this.paying = null;
            this.loadPayments();
          },
          error: () => { this.paymentMessage = 'Payment initiated (intent: ' + intent.paymentIntentId + '). Confirm via Stripe.'; this.paying = null; }
        });
      },
      error: () => { this.error = 'Stripe error.'; this.paying = null; }
    });
  }

  downloadReceipt(p: Payment) {
    this.api.downloadReceipt(1, p.id, this.user!.firstName + ' ' + this.user!.lastName, 'Club ESPRIT').subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = 'recu-' + p.id + '.pdf'; a.click();
      },
      error: () => { this.error = 'Error downloading receipt.'; }
    });
  }

  statusClass(s: string): string {
    const m: Record<string, string> = { PAID: 'bg-green-100 text-green-700', PENDING: 'bg-yellow-100 text-yellow-700', LATE: 'bg-red-100 text-red-700', REFUNDED: 'bg-blue-100 text-blue-700', EXEMPT: 'bg-gray-100 text-gray-500' };
    return m[s] ?? 'bg-gray-100 text-gray-600';
  }
  statusLabel(s: string): string {
    const m: Record<string, string> = { PAID: 'Paid', PENDING: 'Pending', LATE: 'Late', REFUNDED: 'Refunded', EXEMPT: 'Exempt' };
    return m[s] ?? s;
  }
}
