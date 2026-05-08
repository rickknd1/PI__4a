import { Component, OnInit } from '@angular/core';
import { CommonModule, DecimalPipe, DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { TreasuryApiService } from '../../services/treasury-api.service';
import { AuthService } from '../../../shared/services/auth.service';
import { Payment, MockUser } from '../../models/treasury.models';
import { forkJoin } from 'rxjs';

type ToastKind = 'success' | 'error' | 'info';

@Component({
  selector: 'app-remboursements',
  standalone: true,
  imports: [CommonModule, DecimalPipe, DatePipe],
  templateUrl: './remboursements.component.html',
})
export class RemboursementsComponent implements OnInit {
  clubId: number | string = 1;
  allPaid: Payment[] = [];
  paid: Payment[] = [];
  refunded: Payment[] = [];
  loading = true;
  error = '';
  selectedPayments: string[] = [];

  // Modal confirmation
  showConfirmModal = false;
  // Toast in-app (remplace alert() systeme)
  toast: { kind: ToastKind; message: string } | null = null;
  // Pendant le traitement Stripe
  processing = false;
  processedCount = 0;

  // Pagination
  page = 0;
  pageSize = 10;
  get total(): number { return this.allPaid.length; }
  get totalPages(): number { return Math.max(1, Math.ceil(this.total / this.pageSize)); }

  // Member name resolution
  memberNames = new Map<string, string>();

  constructor(private api: TreasuryApiService,
              private http: HttpClient,
              private auth: AuthService) {}

  ngOnInit() {
    const u = this.auth.getCurrentUser();
    this.clubId = (u?.clubId as any) ?? 1;
    this.loadMembers();
    this.reload();
  }

  reload() {
    this.loading = true;
    this.api.getPayments(this.clubId).subscribe({
      next: (data) => {
        this.allPaid = data.filter(p => p.status === 'PAID');
        this.refunded = data.filter(p => p.status === 'REFUNDED' || p.status === 'PARTIALLY_REFUNDED');
        this.applyView();
        this.loading = false;
      },
      error: () => { this.error = 'Impossible de charger les remboursements.'; this.loading = false; }
    });
  }

  loadMembers() {
    this.http.get<MockUser[]>('http://localhost:8084/api/v1/users/club/1').subscribe({
      next: (users) => {
        users.forEach(u => this.memberNames.set(u.id, u.firstName + ' ' + u.lastName));
        this.applyView();
      },
      error: () => {}
    });
  }

  resolveMember(id: string): string {
    return this.memberNames.get(id) || 'Membre #' + id;
  }

  applyView() {
    const start = this.page * this.pageSize;
    this.paid = this.allPaid.slice(start, start + this.pageSize);
  }

  onPageChange() {
    this.applyView();
  }

  toggle(id: string) {
    const i = this.selectedPayments.indexOf(id);
    if (i === -1) this.selectedPayments.push(id); else this.selectedPayments.splice(i, 1);
  }

  isSelected(id: string) { return this.selectedPayments.includes(id); }

  /** Total du remboursement selectionne (utile pour la modal). */
  get selectedTotalAmount(): number {
    return this.allPaid
      .filter(p => this.selectedPayments.includes(p.id))
      .reduce((s, p) => s + Number(p.amount || 0), 0);
  }

  // ============================================================
  //  Workflow remboursement avec modal in-app + appels backend
  // ============================================================
  initiateRefunds() {
    if (!this.selectedPayments.length) {
      this.showToast('info', 'Selectionnez au moins un paiement a rembourser.');
      return;
    }
    this.showConfirmModal = true;
  }

  cancelRefund() {
    this.showConfirmModal = false;
  }

  confirmRefund() {
    this.showConfirmModal = false;
    this.processing = true;
    this.processedCount = 0;

    const me = this.auth.getCurrentUser();
    const actorId = me?.id || 'anonymous';
    const actorEmail = me?.email || 'unknown@clubhub.tn';

    const calls = this.selectedPayments.map(pid =>
      this.api.refundPayment(this.clubId, pid, actorId, actorEmail)
    );

    forkJoin(calls).subscribe({
      next: (results: any[]) => {
        this.processedCount = results.length;
        this.processing = false;
        this.showToast(
          'success',
          `${results.length} remboursement${results.length > 1 ? 's' : ''} effectue${results.length > 1 ? 's' : ''} (Stripe traite sous 3-5 jours ouvres).`
        );
        this.selectedPayments = [];
        this.reload();
      },
      error: (err) => {
        this.processing = false;
        const msg = err?.error?.message || 'Erreur lors du remboursement. Verifiez le statut Stripe.';
        this.showToast('error', msg);
        this.reload();
      }
    });
  }

  // ============================================================
  //  Toast in-app (auto-dismiss apres 5s)
  // ============================================================
  showToast(kind: ToastKind, message: string) {
    this.toast = { kind, message };
    setTimeout(() => {
      if (this.toast?.message === message) this.toast = null;
    }, 5000);
  }

  closeToast() { this.toast = null; }
}
