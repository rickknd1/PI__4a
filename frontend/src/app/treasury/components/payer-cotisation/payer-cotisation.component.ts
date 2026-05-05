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
          <h2 class="text-2xl font-bold text-gray-800 dark:text-white">Payer ma cotisation</h2>
          <p class="text-sm text-gray-500" *ngIf="user">{{ user.firstName }} {{ user.lastName }} - {{ user.email }}</p>
        </div>
      </div>

      <!-- Not logged in -->
      <div *ngIf="!user" class="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-center">
        <p class="text-yellow-700 font-medium">Connectez-vous d'abord</p>
        <a routerLink="/treasury/login" class="mt-3 inline-block px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">Se connecter</a>
      </div>

      <div *ngIf="loading" class="text-center py-12">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
      </div>

      <div *ngIf="error" class="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">{{ error }}</div>
      <div *ngIf="success" class="bg-green-50 border border-green-200 rounded-xl p-4 text-green-700 text-sm">{{ success }}</div>

      <!-- ====== COTISATIONS EN RETARD / EN ATTENTE ====== -->
      <div *ngIf="!loading && user && unpaid.length > 0">
        <h3 class="font-semibold text-gray-700 dark:text-gray-200 mb-3">Cotisations a regler</h3>

        <div *ngFor="let p of unpaid" class="bg-white dark:bg-gray-800 rounded-xl border p-5 mb-4">
          <div class="flex items-center justify-between mb-4">
            <div>
              <p class="font-medium text-gray-800 dark:text-white">Cotisation - Echeance {{ p.dueDate | date:'dd/MM/yyyy' }}</p>
              <span class="px-2 py-0.5 rounded-full text-xs font-medium mt-1 inline-block"
                    [class]="p.status === 'LATE' ? 'bg-red-100 text-red-700' : p.status === 'PENDING_CASH' ? 'bg-amber-100 text-amber-700' : 'bg-yellow-100 text-yellow-700'">
                {{ p.status === 'LATE' ? 'EN RETARD' : p.status === 'PENDING_CASH' ? 'ESPECES - EN ATTENTE TRESORIER' : 'EN ATTENTE' }}
              </span>
            </div>
            <p class="text-2xl font-bold text-gray-800 dark:text-white">{{ p.amount | number:'1.2-2' }} <span class="text-sm text-gray-400">TND</span></p>
          </div>

          <!-- Choix mode de paiement (seulement si pas deja en cours et pas PENDING_CASH) -->
          <div *ngIf="activePayment !== p.id && p.status !== 'PENDING_CASH'">
            <p class="text-sm text-gray-500 mb-3">Choisissez votre mode de reglement :</p>
            <div class="flex gap-3">
              <button (click)="selectMode(p, 'card')"
                      class="flex-1 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition text-sm flex items-center justify-center gap-2">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/>
                </svg>
                Carte bancaire
              </button>
              <button (click)="selectMode(p, 'cash')"
                      class="flex-1 py-3 bg-gray-600 text-white rounded-xl font-medium hover:bg-gray-700 transition text-sm flex items-center justify-center gap-2">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"/>
                </svg>
                Especes
              </button>
            </div>
          </div>

          <!-- ===== MODE CARTE (Stripe) ===== -->
          <div *ngIf="activePayment === p.id && paymentMode === 'card'" class="mt-4 space-y-3">
            <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p class="text-sm text-blue-800 font-medium mb-1">Paiement par carte bancaire</p>
              <p class="text-xs text-blue-600">Le paiement est securise via Stripe. Vous recevrez une confirmation + recu PDF par email.</p>
            </div>

            <button (click)="payByCard(p)" [disabled]="processing"
                    class="w-full py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 transition">
              {{ processing ? 'Traitement en cours...' : 'Confirmer le paiement de ' + (p.amount | number:'1.2-2') + ' TND' }}
            </button>

            <button (click)="cancel()" class="w-full py-2 text-gray-500 text-sm hover:underline">Annuler</button>
          </div>

          <!-- ===== MODE ESPECE ===== -->
          <div *ngIf="activePayment === p.id && paymentMode === 'cash'" class="mt-4 space-y-3">
            <div class="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p class="text-sm text-amber-800 font-medium mb-1">Paiement en especes</p>
              <p class="text-xs text-amber-700">Confirmez votre demande. Le tresorier validera le paiement quand vous lui remettrez le montant.</p>
              <div class="mt-3 bg-white rounded-lg p-3 border border-amber-100">
                <p class="text-xs text-gray-500">Montant a remettre</p>
                <p class="text-xl font-bold text-gray-800">{{ p.amount | number:'1.2-2' }} TND</p>
              </div>
            </div>
            <button (click)="requestCash(p)" [disabled]="processing"
                    class="w-full py-3 bg-amber-600 text-white rounded-xl font-medium hover:bg-amber-700 disabled:opacity-50 transition">
              {{ processing ? 'Envoi...' : 'Confirmer la demande especes' }}
            </button>
            <button (click)="cancel()" class="w-full py-2 text-gray-500 text-sm hover:underline">Annuler</button>
          </div>
        </div>
      </div>

      <!-- All paid -->
      <div *ngIf="!loading && user && unpaid.length === 0" class="bg-green-50 border border-green-200 rounded-xl p-8 text-center">
        <svg class="w-12 h-12 text-green-500 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        <h3 class="font-semibold text-green-700">Vous etes a jour</h3>
        <p class="text-sm text-green-600 mt-1">Toutes vos cotisations sont reglees.</p>
      </div>

      <!-- ====== HISTORIQUE ====== -->
      <div *ngIf="!loading && user && paid.length > 0">
        <h3 class="font-semibold text-gray-700 dark:text-gray-200 mb-3">Historique</h3>
        <div class="bg-white dark:bg-gray-800 rounded-xl border overflow-hidden">
          <table class="w-full text-sm">
            <thead class="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Montant</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Paye le</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Recu</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
              <tr *ngFor="let p of paid">
                <td class="px-4 py-3 font-medium">{{ p.amount | number:'1.2-2' }} TND</td>
                <td class="px-4 py-3 text-gray-500">{{ p.paidAt | date:'dd/MM/yyyy HH:mm' }}</td>
                <td class="px-4 py-3">
                  <button (click)="downloadReceipt(p)" class="text-blue-600 hover:underline text-xs font-medium">Telecharger PDF</button>
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
      this.success = 'Paiement Stripe detecte, recuperation des informations...';
      // First, resolve the Checkout Session to get the real PaymentIntent ID (pi_xxx)
      this.api.getStripeSession(1, sessionId).subscribe({
        next: (session) => {
          const stripeIntentId = session.paymentIntentId || sessionId;
          this.success = 'Confirmation du paiement en cours...';
          this.api.confirmPayment(1, paymentId, stripeIntentId, '', 'Club Test ClubHub').subscribe({
            next: () => {
              this.success = 'Paiement confirme ! Un recu a ete envoye a ' + this.user!.email + '.';
              this.processing = false;
              this.loadPayments();
            },
            error: () => {
              this.success = 'Le paiement Stripe a ete effectue. Contactez le tresorier si le statut ne se met pas a jour.';
              this.processing = false;
              this.loadPayments();
            }
          });
        },
        error: () => {
          // Fallback: try confirming with sessionId directly (old behavior)
          this.api.confirmPayment(1, paymentId, sessionId, '', 'Club Test ClubHub').subscribe({
            next: () => {
              this.success = 'Paiement confirme ! Un recu a ete envoye a ' + this.user!.email + '.';
              this.processing = false;
              this.loadPayments();
            },
            error: () => {
              this.success = 'Le paiement Stripe a ete effectue. Contactez le tresorier si le statut ne se met pas a jour.';
              this.processing = false;
              this.loadPayments();
            }
          });
        }
      });
    }
    if (params['cancelled']) {
      this.error = 'Paiement annule. Vous pouvez reessayer.';
    }
  }

  loadPayments() {
    this.loading = true;
    this.api.getMyPayments(1, this.user!.id).subscribe({
      next: (data) => {
        this.unpaid = data.filter(p => p.status === 'PENDING' || p.status === 'LATE' || p.status === 'PENDING_CASH');
        this.paid = data.filter(p => p.status === 'PAID');
        this.loading = false;
      },
      error: (e) => { this.error = 'Impossible de charger vos paiements. (user.id=' + this.user?.id + ', status=' + e?.status + ')'; this.loading = false; }
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
    this.success = 'Creation de la session de paiement...';
    const memberName = this.user!.firstName + ' ' + this.user!.lastName;

    // Cree une Stripe Checkout Session et redirige vers le portail Stripe
    this.api.createCheckoutSession(1, p.id, memberName).subscribe({
      next: (session) => {
        if (session?.url) {
          this.success = 'Redirection vers Stripe...';
          // Redirection vers le portail Stripe Checkout
          window.location.assign(session.url);
        } else {
          this.error = 'Pas d\'URL Stripe recu. Response: ' + JSON.stringify(session);
          this.processing = false;
        }
      },
      error: (err) => {
        this.error = 'Erreur Stripe: ' + (err?.error?.message || err?.message || err?.status || JSON.stringify(err));
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
        this.success = 'Demande enregistree. Presentez-vous au tresorier avec ' + p.amount + ' TND. Il validera votre paiement.';
        this.processing = false;
        this.activePayment = null;
        this.paymentMode = null;
        this.loadPayments();
      },
      error: () => {
        this.error = 'Erreur lors de la demande. Reessayez.';
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
      error: () => { this.error = 'Erreur telechargement du recu.'; }
    });
  }
}
