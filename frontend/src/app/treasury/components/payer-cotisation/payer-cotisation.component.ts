import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, DecimalPipe, DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TreasuryApiService } from '../../services/treasury-api.service';
import { AuthService } from '../../services/auth.service';
import { Payment, MockUser } from '../../models/treasury.models';

@Component({
  selector: 'app-payer-cotisation',
  standalone: true,
  imports: [CommonModule, DecimalPipe, DatePipe, RouterLink],
  template: `
    <div class="p-6 max-w-3xl mx-auto space-y-6">

      <!-- Header -->
      <div class="flex items-center gap-3">
        <a routerLink="/treasury/espace-membre" class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition">
          <svg class="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
          </svg>
        </a>
        <div>
          <h2 class="text-2xl font-bold text-gray-800 dark:text-white">Pay my due</h2>
          <p class="text-sm text-gray-500" *ngIf="user">{{ user.firstName }} {{ user.lastName }} - {{ user.email }}</p>
        </div>
      </div>

      <!-- Not logged in -->
      <div *ngIf="!user" class="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-center">
        <p class="text-yellow-700 font-medium">Please sign in first</p>
        <a routerLink="/treasury/login" class="mt-3 inline-block px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">Sign in</a>
      </div>

      <div *ngIf="loading" class="text-center py-12">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
      </div>

      <div *ngIf="error" class="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">{{ error }}</div>
      <div *ngIf="success" class="bg-green-50 border border-green-200 rounded-xl p-4 text-green-700 text-sm">{{ success }}</div>

      <!-- ====== COTISATIONS EN RETARD / EN ATTENTE ====== -->
      <div *ngIf="!loading && user && unpaid.length > 0">
        <h3 class="font-semibold text-gray-700 dark:text-gray-200 mb-3">Dues to pay</h3>

        <div *ngFor="let p of unpaid" class="bg-white dark:bg-gray-800 rounded-xl border p-5 mb-4">
          <div class="flex items-center justify-between mb-4">
            <div>
              <p class="font-medium text-gray-800 dark:text-white">Due - Deadline {{ p.dueDate | date:'dd/MM/yyyy' }}</p>
              <span class="px-2 py-0.5 rounded-full text-xs font-medium mt-1 inline-block"
                    [class]="p.status === 'LATE' ? 'bg-red-100 text-red-700' : p.status === 'PENDING_CASH' ? 'bg-amber-100 text-amber-700' : 'bg-yellow-100 text-yellow-700'">
                {{ p.status === 'LATE' ? 'LATE' : p.status === 'PENDING_CASH' ? 'CASH - AWAITING TREASURER' : 'PENDING' }}
              </span>
            </div>
            <p class="text-2xl font-bold text-gray-800 dark:text-white">{{ p.amount | number:'1.2-2' }} <span class="text-sm text-gray-400">TND</span></p>
          </div>

          <!-- Choix mode de paiement (seulement si pas deja en cours et pas PENDING_CASH) -->
          <div *ngIf="activePayment !== p.id && p.status !== 'PENDING_CASH'">
            <p class="text-sm text-gray-500 mb-3">Choose your payment method:</p>
            <div class="flex gap-3">
              <button (click)="selectMode(p, 'card')"
                      class="flex-1 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition text-sm flex items-center justify-center gap-2">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/>
                </svg>
                Credit Card
              </button>
              <button (click)="selectMode(p, 'cash')"
                      class="flex-1 py-3 bg-gray-600 text-white rounded-xl font-medium hover:bg-gray-700 transition text-sm flex items-center justify-center gap-2">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"/>
                </svg>
                Cash
              </button>
            </div>
          </div>

          <!-- ===== MODE CARTE (Stripe) ===== -->
          <div *ngIf="activePayment === p.id && paymentMode === 'card'" class="mt-4 space-y-3">
            <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p class="text-sm text-blue-800 font-medium mb-1">Credit card payment</p>
              <p class="text-xs text-blue-600">Payment is secured via Stripe. You will receive a confirmation + PDF receipt by email.</p>
            </div>

            <button (click)="payByCard(p)" [disabled]="processing"
                    class="w-full py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 transition">
              {{ processing ? 'Processing...' : 'Confirm payment of ' + (p.amount | number:'1.2-2') + ' TND' }}
            </button>

            <button (click)="cancel()" class="w-full py-2 text-gray-500 text-sm hover:underline">Cancel</button>
          </div>

          <!-- ===== MODE ESPECE ===== -->
          <div *ngIf="activePayment === p.id && paymentMode === 'cash'" class="mt-4 space-y-3">
            <div class="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p class="text-sm text-amber-800 font-medium mb-1">Cash payment</p>
              <p class="text-xs text-amber-700">Confirm your request. The treasurer will validate the payment once you hand over the amount.</p>
              <div class="mt-3 bg-white rounded-lg p-3 border border-amber-100">
                <p class="text-xs text-gray-500">Amount to hand over</p>
                <p class="text-xl font-bold text-gray-800">{{ p.amount | number:'1.2-2' }} TND</p>
              </div>
            </div>
            <button (click)="requestCash(p)" [disabled]="processing"
                    class="w-full py-3 bg-amber-600 text-white rounded-xl font-medium hover:bg-amber-700 disabled:opacity-50 transition">
              {{ processing ? 'Sending...' : 'Confirm cash request' }}
            </button>
            <button (click)="cancel()" class="w-full py-2 text-gray-500 text-sm hover:underline">Cancel</button>
          </div>
        </div>
      </div>

      <!-- All paid -->
      <div *ngIf="!loading && user && unpaid.length === 0" class="bg-green-50 border border-green-200 rounded-xl p-8 text-center">
        <svg class="w-12 h-12 text-green-500 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        <h3 class="font-semibold text-green-700">You are up to date</h3>
        <p class="text-sm text-green-600 mt-1">All your dues have been paid.</p>
      </div>

      <!-- ====== HISTORIQUE ====== -->
      <div *ngIf="!loading && user && paid.length > 0">
        <h3 class="font-semibold text-gray-700 dark:text-gray-200 mb-3">History</h3>
        <div class="bg-white dark:bg-gray-800 rounded-xl border overflow-hidden">
          <table class="w-full text-sm">
            <thead class="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Paid on</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Receipt</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
              <tr *ngFor="let p of paid">
                <td class="px-4 py-3 font-medium">{{ p.amount | number:'1.2-2' }} TND</td>
                <td class="px-4 py-3 text-gray-500">{{ p.paidAt | date:'dd/MM/yyyy HH:mm' }}</td>
                <td class="px-4 py-3">
                  <button (click)="downloadReceipt(p)" class="text-blue-600 hover:underline text-xs font-medium">Download PDF</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `,
})
export class PayerCotisationComponent implements OnInit {
  user: MockUser | null = null;
  unpaid: Payment[] = [];
  paid: Payment[] = [];
  loading = true;
  error = '';
  success = '';
  processing = false;
  activePayment: string | null = null;
  paymentMode: 'card' | 'cash' | null = null;

  private api = inject(TreasuryApiService);
  private auth = inject(AuthService);
  private route = inject(ActivatedRoute);

  ngOnInit() {
    this.user = this.auth.current();
    if (this.user) {
      this.handleReturnFromStripe();
      this.loadPayments();
    } else {
      this.auth.refreshFromServer().subscribe((u) => {
        this.user = u;
        if (u) {
          this.handleReturnFromStripe();
          this.loadPayments();
        } else { this.loading = false; }
      });
    }
  }

  /** Gere le retour de Stripe Checkout — si ?session_id= est present, on confirme le paiement */
  private handleReturnFromStripe() {
    const params = this.route.snapshot.queryParams;
    const sessionId = params['session_id'];
    const paymentId = params['paymentId'];
    if (sessionId && paymentId) {
      this.processing = true;
      this.success = 'Stripe payment detected, retrieving information...';
      // First, resolve the Checkout Session to get the real PaymentIntent ID (pi_xxx)
      this.api.getStripeSession(1, sessionId).subscribe({
        next: (session) => {
          const stripeIntentId = session.paymentIntentId || sessionId;
          this.success = 'Confirming payment...';
          this.api.confirmPayment(1, paymentId, stripeIntentId, '', 'Club Test ClubHub').subscribe({
            next: () => {
              this.success = 'Payment confirmed! A receipt has been sent to ' + this.user!.email + '.';
              this.processing = false;
              this.loadPayments();
            },
            error: () => {
              this.success = 'The Stripe payment was processed. Contact the treasurer if the status does not update.';
              this.processing = false;
              this.loadPayments();
            }
          });
        },
        error: () => {
          // Fallback: try confirming with sessionId directly (old behavior)
          this.api.confirmPayment(1, paymentId, sessionId, '', 'Club Test ClubHub').subscribe({
            next: () => {
              this.success = 'Payment confirmed! A receipt has been sent to ' + this.user!.email + '.';
              this.processing = false;
              this.loadPayments();
            },
            error: () => {
              this.success = 'The Stripe payment was processed. Contact the treasurer if the status does not update.';
              this.processing = false;
              this.loadPayments();
            }
          });
        }
      });
    }
    if (params['cancelled']) {
      this.error = 'Payment cancelled. You can try again.';
    }
  }

  loadPayments() {
    this.loading = true;
    // D1 fix : utiliser le clubId reel du user (plus 1 hardcode).
    // Status null tolere : backend cree des payments sans status -> on les considere PENDING.
    const clubId = (this.user as any)?.clubId || '1';
    this.api.getMyPayments(clubId, this.user!.id).subscribe({
      next: (data) => {
        this.unpaid = data.filter(p => !p.status || p.status === 'PENDING' || p.status === 'LATE' || p.status === 'PENDING_CASH');
        this.paid = data.filter(p => p.status === 'PAID');
        this.loading = false;
      },
      error: (e) => { this.error = 'Unable to load your payments. (user.id=' + this.user?.id + ', status=' + e?.status + ')'; this.loading = false; }
    });
  }

  selectMode(p: Payment, mode: 'card' | 'cash') {
    this.activePayment = p.id;
    this.paymentMode = mode;
    this.error = '';
    this.success = '';
  }

  cancel() {
    this.activePayment = null;
    this.paymentMode = null;
  }

  payByCard(p: Payment) {
    this.processing = true;
    this.error = '';
    this.success = 'Creating payment session...';
    const memberName = this.user!.firstName + ' ' + this.user!.lastName;

    // Cree une Stripe Checkout Session et redirige vers le portail Stripe
    this.api.createCheckoutSession(1, p.id, memberName).subscribe({
      next: (session) => {
        if (session?.url) {
          this.success = 'Redirecting to Stripe...';
          // Redirection vers le portail Stripe Checkout
          window.location.assign(session.url);
        } else {
          this.error = 'No Stripe URL received. Response: ' + JSON.stringify(session);
          this.processing = false;
        }
      },
      error: (err) => {
        this.error = 'Stripe error: ' + (err?.error?.message || err?.message || err?.status || JSON.stringify(err));
        this.success = '';
        this.processing = false;
      }
    });
  }

  requestCash(p: Payment) {
    this.processing = true;
    this.error = '';
    this.api.requestCashPayment(1, p.id).subscribe({
      next: () => {
        this.success = 'Request recorded. Present yourself to the treasurer with ' + p.amount + ' TND. They will validate your payment.';
        this.processing = false;
        this.activePayment = null;
        this.paymentMode = null;
        this.loadPayments();
      },
      error: () => {
        this.error = 'Error during request. Please try again.';
        this.processing = false;
      }
    });
  }

  downloadReceipt(p: Payment) {
    this.api.downloadReceipt(1, p.id, this.user!.firstName + ' ' + this.user!.lastName, 'Club Test ClubHub').subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = 'recu-' + p.id + '.pdf'; a.click();
        URL.revokeObjectURL(url);
      },
      error: () => { this.error = 'Error downloading receipt.'; }
    });
  }
}
