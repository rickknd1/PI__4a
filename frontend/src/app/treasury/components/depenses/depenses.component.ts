import { Component, OnInit } from '@angular/core';
import { CommonModule, DecimalPipe, DatePipe } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { TreasuryApiService } from '../../services/treasury-api.service';
import { Expense, ExpenseStatus } from '../../models/treasury.models';

@Component({
  selector: 'app-depenses',
  standalone: true,
  imports: [CommonModule, DecimalPipe, DatePipe, FormsModule, ReactiveFormsModule],
  templateUrl: './depenses.component.html',
})
export class DepensesComponent implements OnInit {
  clubId = 1;
  expenses: Expense[] = [];
  loading = true;
  showForm = false;
  selectedStatus = '';
  form: FormGroup;

  statusFilters = ['', 'SUBMITTED', 'VALIDATED', 'APPROVED', 'REJECTED'];

  constructor(private api: TreasuryApiService, private fb: FormBuilder) {
    this.form = this.fb.group({
      title: ['', Validators.required],
      description: [''],
      amount: [null, [Validators.required, Validators.min(0.001)]],
      justificatifUrl: [''],
    });
  }

  ngOnInit() { this.load(); }

  load() {
    this.loading = true;
    this.api.getExpenses(this.clubId, this.selectedStatus || undefined).subscribe({
      next: (d) => { this.expenses = d; this.loading = false; },
      error: () => { this.expenses = this.mockData(); this.loading = false; }
    });
  }

  submit() {
    if (this.form.invalid) return;
    this.api.submitExpense(this.clubId, this.form.value).subscribe({
      next: () => { this.showForm = false; this.form.reset(); this.load(); },
      error: () => { this.showForm = false; }
    });
  }

  validate(e: Expense) { this.api.validateExpense(this.clubId, e.id).subscribe(() => this.load()); }
  approve(e: Expense) { this.api.approveExpense(this.clubId, e.id).subscribe(() => this.load()); }
  reject(e: Expense) {
    const reason = prompt('Motif du rejet :');
    if (reason) this.api.rejectExpense(this.clubId, e.id, reason).subscribe(() => this.load());
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

  private mockData(): Expense[] {
    return [
      { id: 1, clubId: 1, submittedByMemberId: 2, submittedByMemberName: 'Ali Ben Salah', title: 'Matériel événement', description: 'Tables et chaises', amount: 320, status: 'SUBMITTED', categoryValidatedByTreasurer: false, submittedAt: new Date().toISOString() },
      { id: 2, clubId: 1, submittedByMemberId: 3, submittedByMemberName: 'Sana Khelifi', title: 'Transport déplacement', description: 'Location bus', amount: 180, status: 'VALIDATED', category: 'TRANSPORT', categoryConfidenceScore: 94, categoryValidatedByTreasurer: false, submittedAt: new Date().toISOString() },
      { id: 3, clubId: 1, submittedByMemberId: 4, submittedByMemberName: 'Omar Mansouri', title: 'Restauration réunion', description: 'Buffet', amount: 95, status: 'APPROVED', category: 'RESTAURATION', categoryConfidenceScore: 88, categoryValidatedByTreasurer: true, submittedAt: new Date().toISOString() },
      { id: 4, clubId: 1, submittedByMemberId: 5, submittedByMemberName: 'Fatma Haddad', title: 'Impression flyers', description: 'Flyers événement', amount: 45, status: 'REJECTED', rejectionReason: 'Budget insuffisant', categoryValidatedByTreasurer: false, submittedAt: new Date().toISOString() },
    ];
  }
}
