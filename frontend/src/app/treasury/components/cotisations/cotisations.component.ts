import { Component, OnInit } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { TreasuryApiService } from '../../services/treasury-api.service';
// Service auth LOCAL au module treasury (a `isTresorier()`, `current()`, etc.
// utilises directement par le template). Le shared AuthService n'a pas
// ces helpers — on garde le local pour ne pas casser l'UI.
import { AuthService } from '../../services/auth.service';
import { CotisationRule, Payment, MockUser } from '../../models/treasury.models';

@Component({
  selector: 'app-cotisations',
  standalone: true,
  imports: [CommonModule, DecimalPipe, FormsModule, ReactiveFormsModule],
  templateUrl: './cotisations.component.html',
})
export class CotisationsComponent implements OnInit {
  clubId: number | string = 1;
  rules: CotisationRule[] = [];
  payments: Payment[] = [];
  loading = true;
  error = '';
  showRuleForm = false;
  activeTab: 'rules' | 'payments' = 'rules';
  confirmingId: string | null = null;
  confirmSuccess = '';
  confirmError = '';

  // User lookup map: memberId -> "firstName lastName"
  private userMap = new Map<string, string>();

  // Pagination - payments
  paymentPage = 0;
  paymentPageSize = 10;

  // Pagination - rules
  rulePage = 0;
  rulePageSize = 10;

  // Sort - payments
  sortField: 'member' | 'amount' | 'status' | 'dueDate' | 'paidAt' = 'dueDate';
  sortDir: 'asc' | 'desc' = 'desc';

  // Sort - rules
  ruleSortField: 'name' | 'amount' | 'frequency' | 'startDate' = 'name';
  ruleSortDir: 'asc' | 'desc' = 'asc';

  form: FormGroup;

  frequencies = [
    { value: 'MONTHLY', label: 'Mensuelle' },
    { value: 'QUARTERLY', label: 'Trimestrielle' },
    { value: 'ANNUAL', label: 'Annuelle' },
  ];

  constructor(
    private api: TreasuryApiService,
    private fb: FormBuilder,
    public auth: AuthService,
    private route: ActivatedRoute,
    private http: HttpClient
  ) {
    const tab = this.route.snapshot.data['defaultTab'];
    if (tab === 'payments' || tab === 'rules') {
      this.activeTab = tab;
    }
    this.form = this.fb.group({
      name: ['', Validators.required],
      amount: [null, [Validators.required, Validators.min(0.001)]],
      frequency: ['MONTHLY', Validators.required],
      startDate: [new Date().toISOString().split('T')[0], Validators.required],
      allowExemption: [false],
      allowInstallments: [false],
      maxInstallments: [null],
    });
  }

  ngOnInit() {
    const u = this.auth.current();
    this.clubId = (u?.clubId as any) ?? 1;
    this.loadUsers();
    this.load();
  }

  /** Fetch all users for club and build memberId -> name lookup */
  private loadUsers(): void {
    this.http.get<MockUser[]>('http://localhost:8084/api/users/club/1', { withCredentials: true }).subscribe({
      next: (users) => {
        for (const u of users) {
          const id = (u as any).id || (u as any).userId;
          if (id) {
            this.userMap.set(id, `${u.firstName} ${u.lastName}`);
          }
        }
      },
      error: () => { /* silently ignore - fallback to memberName or truncated id */ }
    });
  }

  /** Resolve member name: userMap > payment.memberName > truncated id */
  getMemberName(memberId: string, memberName?: string): string {
    if (this.userMap.has(memberId)) return this.userMap.get(memberId)!;
    if (memberName) return memberName;
    if (!memberId) return 'Membre';
    return 'Membre #' + memberId.substring(0, 8);
  }

  load() {
    this.loading = true;
    this.api.getCotisationRules(this.clubId).subscribe({
      next: (data) => { this.rules = data; this.rulePage = 0; this.loading = false; },
      error: () => { this.error = 'Impossible de charger les cotisations.'; this.loading = false; }
    });
    this.api.getPayments(this.clubId).subscribe({
      next: (data) => { this.payments = data; this.paymentPage = 0; },
      error: () => { this.error = 'Impossible de charger les cotisations.'; this.loading = false; }
    });
  }

  createRule() {
    if (this.form.invalid) return;
    this.api.createCotisationRule(this.clubId, this.form.value).subscribe({
      next: () => { this.showRuleForm = false; this.form.reset(); this.load(); },
      error: () => { this.showRuleForm = false; this.form.reset(); }
    });
  }

  // ── Sorted + paginated data ────────────────────────────────────────

  get sortedPayments(): Payment[] {
    const arr = [...this.payments];
    const dir = this.sortDir === 'asc' ? 1 : -1;
    arr.sort((a, b) => {
      let va: any, vb: any;
      switch (this.sortField) {
        case 'member':
          va = this.getMemberName(a.memberId, a.memberName).toLowerCase();
          vb = this.getMemberName(b.memberId, b.memberName).toLowerCase();
          break;
        case 'amount': va = a.amount; vb = b.amount; break;
        case 'status': va = a.status; vb = b.status; break;
        case 'dueDate': va = a.dueDate || ''; vb = b.dueDate || ''; break;
        case 'paidAt': va = a.paidAt || ''; vb = b.paidAt || ''; break;
        default: va = ''; vb = '';
      }
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });
    return arr;
  }

  get pagedPayments(): Payment[] {
    const start = this.paymentPage * this.paymentPageSize;
    return this.sortedPayments.slice(start, start + this.paymentPageSize);
  }

  get paymentTotalPages(): number {
    return Math.max(1, Math.ceil(this.payments.length / this.paymentPageSize));
  }

  get sortedRules(): CotisationRule[] {
    const arr = [...this.rules];
    const dir = this.ruleSortDir === 'asc' ? 1 : -1;
    arr.sort((a, b) => {
      let va: any, vb: any;
      switch (this.ruleSortField) {
        case 'name': va = a.name.toLowerCase(); vb = b.name.toLowerCase(); break;
        case 'amount': va = a.amount; vb = b.amount; break;
        case 'frequency': va = a.frequency; vb = b.frequency; break;
        case 'startDate': va = a.startDate || ''; vb = b.startDate || ''; break;
        default: va = ''; vb = '';
      }
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });
    return arr;
  }

  get pagedRules(): CotisationRule[] {
    const start = this.rulePage * this.rulePageSize;
    return this.sortedRules.slice(start, start + this.rulePageSize);
  }

  get ruleTotalPages(): number {
    return Math.max(1, Math.ceil(this.rules.length / this.rulePageSize));
  }

  // ── Sort toggling ──────────────────────────────────────────────────

  togglePaymentSort(field: 'member' | 'amount' | 'status' | 'dueDate' | 'paidAt'): void {
    if (this.sortField === field) {
      this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortField = field;
      this.sortDir = 'asc';
    }
    this.paymentPage = 0;
  }

  toggleRuleSort(field: 'name' | 'amount' | 'frequency' | 'startDate'): void {
    if (this.ruleSortField === field) {
      this.ruleSortDir = this.ruleSortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.ruleSortField = field;
      this.ruleSortDir = 'asc';
    }
    this.rulePage = 0;
  }

  sortIcon(field: string, currentField: string, currentDir: string): string {
    if (field !== currentField) return ' \u2195';
    return currentDir === 'asc' ? ' \u2191' : ' \u2193';
  }

  // ── CSV Export ─────────────────────────────────────────────────────

  exportPaymentsCsv(): void {
    const header = 'Membre,Montant,Statut,Echeance,Paye le\n';
    const rows = this.sortedPayments.map(p => {
      const name = this.getMemberName(p.memberId, p.memberName).replace(/,/g, ' ');
      const amount = p.amount.toFixed(3);
      const status = p.status;
      const dueDate = p.dueDate || '';
      const paidAt = p.paidAt ? new Date(p.paidAt).toLocaleDateString('fr-FR') : '';
      return `${name},${amount},${status},${dueDate},${paidAt}`;
    }).join('\n');

    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `paiements_club${this.clubId}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  exportRulesCsv(): void {
    const header = 'Nom,Montant,Frequence,Date debut,Active\n';
    const rows = this.sortedRules.map(r => {
      const name = r.name.replace(/,/g, ' ');
      const amount = r.amount.toFixed(3);
      const freq = this.freqLabel(r.frequency);
      const start = r.startDate || '';
      const active = r.active ? 'Oui' : 'Non';
      return `${name},${amount},${freq},${start},${active}`;
    }).join('\n');

    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `regles_cotisations_club${this.clubId}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Helpers ────────────────────────────────────────────────────────

  statusClass(status: string): string {
    const map: Record<string, string> = {
      PAID: 'bg-green-100 text-green-700',
      PENDING: 'bg-yellow-100 text-yellow-700',
      LATE: 'bg-red-100 text-red-700',
      REFUNDED: 'bg-blue-100 text-blue-700',
      EXEMPT: 'bg-gray-100 text-gray-500',
    };
    return map[status] ?? 'bg-gray-100 text-gray-600';
  }

  freqLabel(f: string): string {
    return this.frequencies.find(x => x.value === f)?.label ?? f;
  }

  confirmCashPayment(payment: Payment): void {
    this.confirmingId = payment.id;
    this.confirmSuccess = '';
    this.confirmError = '';
    const memberName = this.getMemberName(payment.memberId, payment.memberName);
    this.api.confirmPayment(this.clubId, payment.id, 'CASH', '', 'Club Test ClubHub', memberName).subscribe({
      next: () => {
        this.confirmSuccess = `Paiement de ${memberName} valid\u00e9 avec succ\u00e8s.`;
        this.confirmingId = null;
        this.load();
      },
      error: () => {
        this.confirmError = `Erreur lors de la validation du paiement de ${memberName}.`;
        this.confirmingId = null;
      }
    });
  }

}
