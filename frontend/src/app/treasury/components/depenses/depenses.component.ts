import { Component, OnInit } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { TreasuryApiService } from '../../services/treasury-api.service';
import { UserContextService } from '../../services/user-context.service';
import { AuthService } from '../../../shared/services/auth.service';
import { Expense, ExpenseStatus, MockUser } from '../../models/treasury.models';

@Component({
  selector: 'app-depenses',
  standalone: true,
  imports: [CommonModule, DecimalPipe, FormsModule, ReactiveFormsModule],
  templateUrl: './depenses.component.html',
})
export class DepensesComponent implements OnInit {
  clubId: number | string = 1;
  expenses: Expense[] = [];
  allExpenses: Expense[] = [];
  loading = true;
  error = '';
  showForm = false;
  selectedStatus = '';
  form: FormGroup;
  user: MockUser | null = null;
  successMsg = '';

  // Quote selection for validation
  quoteModalExpense: Expense | null = null;
  selectedQuoteIndex: number = 0;

  // Pagination
  page = 0;
  pageSize = 10;
  get total(): number { return this.allExpenses.length; }
  get totalPages(): number { return Math.max(1, Math.ceil(this.total / this.pageSize)); }

  // Sort
  sortField: 'submittedAt' | 'amount' | 'status' = 'submittedAt';
  sortDir: 'asc' | 'desc' = 'desc';

  // Member name resolution
  memberNames = new Map<string, string>();

  statusFilters = ['', 'SUBMITTED', 'VALIDATED', 'APPROVED', 'REJECTED'];

  constructor(private api: TreasuryApiService, private fb: FormBuilder, private userCtx: UserContextService, private http: HttpClient, private auth: AuthService) {
    this.form = this.fb.group({
      title: ['', Validators.required],
      description: [''],
      justificatifUrl: [''],
      quote0: this.fb.group({
        providerName: ['', Validators.required],
        amount: [null, [Validators.required, Validators.min(0.001)]],
        description: [''],
      }),
      quote1: this.fb.group({
        providerName: ['', Validators.required],
        amount: [null, [Validators.required, Validators.min(0.001)]],
        description: [''],
      }),
      quote2: this.fb.group({
        providerName: ['', Validators.required],
        amount: [null, [Validators.required, Validators.min(0.001)]],
        description: [''],
      }),
    });
  }

  ngOnInit() {
    const u = this.auth.getCurrentUser();
    this.clubId = (u?.clubId as any) ?? 1;
    this.user = this.userCtx.getCurrentUser();
    this.loadMembers();
    this.load();
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

  load() {
    this.loading = true;
    this.api.getExpenses(this.clubId, this.selectedStatus || undefined).subscribe({
      next: (d) => { this.allExpenses = d; this.page = 0; this.applyView(); this.loading = false; },
      error: () => { this.error = 'Impossible de charger les depenses.'; this.loading = false; }
    });
  }

  applyView() {
    let sorted = [...this.allExpenses];
    sorted.sort((a, b) => {
      let cmp = 0;
      if (this.sortField === 'submittedAt') {
        cmp = (a.submittedAt || '').localeCompare(b.submittedAt || '');
      } else if (this.sortField === 'amount') {
        cmp = a.amount - b.amount;
      } else if (this.sortField === 'status') {
        cmp = a.status.localeCompare(b.status);
      }
      return this.sortDir === 'asc' ? cmp : -cmp;
    });
    const start = this.page * this.pageSize;
    this.expenses = sorted.slice(start, start + this.pageSize);
  }

  toggleSort(field: 'submittedAt' | 'amount' | 'status') {
    if (this.sortField === field) {
      this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortField = field;
      this.sortDir = 'asc';
    }
    this.page = 0;
    this.applyView();
  }

  sortIcon(field: string): string {
    if (this.sortField !== field) return '';
    return this.sortDir === 'asc' ? ' ▲' : ' ▼';
  }

  onPageChange() {
    this.applyView();
  }

  submit() {
    if (this.form.invalid) return;
    this.successMsg = '';
    const v = this.form.value;
    const quotes = [v.quote0, v.quote1, v.quote2];
    const avgAmount = quotes.reduce((sum: number, q: any) => sum + (q.amount || 0), 0) / 3;
    const payload = {
      title: v.title,
      description: v.description,
      amount: Math.round(avgAmount * 1000) / 1000,
      justificatifUrl: v.justificatifUrl,
      quotes,
    };
    this.api.submitExpense(this.clubId, payload).subscribe({
      next: (exp) => {
        this.showForm = false;
        this.form.reset();
        this.successMsg = 'Depense "' + exp.title + '" soumise ! Categorie IA: ' + (exp.category || 'AUTRE') + ' (' + (exp.categoryConfidenceScore || 0) + '%)';
        this.load();
      },
      error: () => { this.error = 'Erreur soumission depense.'; }
    });
  }

  validate(e: Expense) {
    if (!this.user) return;
    // If expense has quotes, show the quote selection modal
    if (e.quotes && e.quotes.length > 0) {
      this.quoteModalExpense = e;
      this.selectedQuoteIndex = 0;
      return;
    }
    // Fallback: validate without quote selection
    this.api.validateExpense(this.clubId, e.id, 0).subscribe({
      next: () => { this.successMsg = 'Depense "' + e.title + '" validee.'; this.load(); },
      error: (err) => { this.error = err.error?.message || 'Erreur validation.'; }
    });
  }

  confirmValidateWithQuote() {
    if (!this.quoteModalExpense || !this.user) return;
    this.api.validateExpense(this.clubId, this.quoteModalExpense.id, this.selectedQuoteIndex).subscribe({
      next: () => {
        this.successMsg = 'Depense "' + this.quoteModalExpense!.title + '" validee avec le devis #' + (this.selectedQuoteIndex + 1) + '.';
        this.quoteModalExpense = null;
        this.load();
      },
      error: (err) => { this.error = err.error?.message || 'Erreur validation.'; this.quoteModalExpense = null; }
    });
  }

  cancelQuoteModal() {
    this.quoteModalExpense = null;
  }

  approve(e: Expense) {
    if (!this.user) return;
    this.api.approveExpense(this.clubId, e.id).subscribe({
      next: () => { this.successMsg = 'Depense "' + e.title + '" approuvee. Facture envoyee par email.'; this.load(); },
      error: (err) => { this.error = err.error?.message || 'Erreur approbation.'; }
    });
  }

  // Modal de rejet in-app (replace prompt() systeme)
  rejectModal: { expense: Expense; reason: string } | null = null;

  reject(e: Expense) {
    this.rejectModal = { expense: e, reason: '' };
  }

  cancelReject() { this.rejectModal = null; }

  confirmReject() {
    if (!this.rejectModal || !this.rejectModal.reason.trim()) return;
    const { expense, reason } = this.rejectModal;
    this.rejectModal = null;
    this.api.rejectExpense(this.clubId, expense.id, reason).subscribe({
      next: () => { this.successMsg = 'Depense "' + expense.title + '" rejetee.'; this.load(); },
      error: (err) => { this.error = err.error?.message || 'Erreur rejet.'; }
    });
  }

  canValidate(): boolean { return this.userCtx.isTresorier(); }
  canApprove(): boolean { return this.userCtx.isPresident(); }
  getUserLabel(): string {
    if (!this.user) return 'Non connecte';
    return this.user.firstName + ' ' + this.user.lastName + ' (' + this.user.role + ')';
  }

  statusClass(s: ExpenseStatus): string {
    const map: Record<string, string> = {
      SUBMITTED: 'bg-blue-100 text-blue-700', VALIDATED: 'bg-yellow-100 text-yellow-700',
      APPROVED: 'bg-green-100 text-green-700', REJECTED: 'bg-red-100 text-red-700',
      CANCELLED: 'bg-gray-100 text-gray-500',
    };
    return map[s] ?? 'bg-gray-100 text-gray-600';
  }

  filterLabel(s: string) { return s || 'Toutes'; }
}
