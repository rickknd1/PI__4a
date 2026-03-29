import { Component, OnInit } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { TreasuryApiService } from '../../services/treasury-api.service';
import { Budget } from '../../models/treasury.models';

@Component({
  selector: 'app-budget',
  standalone: true,
  imports: [CommonModule, DecimalPipe, FormsModule, ReactiveFormsModule],
  templateUrl: './budget.component.html',
})
export class BudgetComponent implements OnInit {
  clubId = 1;
  budgets: Budget[] = [];
  loading = true;
  showForm = false;
  form: FormGroup;

  constructor(private api: TreasuryApiService, private fb: FormBuilder) {
    this.form = this.fb.group({
      label: ['', Validators.required],
      totalAmount: [null, [Validators.required, Validators.min(1)]],
      periodStart: ['', Validators.required],
      periodEnd: ['', Validators.required],
    });
  }

  ngOnInit() { this.load(); }

  load() {
    this.loading = true;
    this.api.getBudgets(this.clubId).subscribe({
      next: (d) => { this.budgets = d; this.loading = false; },
      error: () => { this.budgets = this.mockData(); this.loading = false; }
    });
  }

  create() {
    if (this.form.invalid) return;
    this.api.createBudget(this.clubId, this.form.value).subscribe({
      next: () => { this.showForm = false; this.form.reset(); this.load(); },
      error: () => { this.showForm = false; }
    });
  }

  alertClass(pct: number): string {
    if (pct >= 100) return 'border-red-300 bg-red-50 dark:bg-red-900/10';
    if (pct >= 90) return 'border-red-200 bg-red-50/50 dark:bg-red-900/5';
    if (pct >= 75) return 'border-yellow-200 bg-yellow-50/50 dark:bg-yellow-900/5';
    return 'border-gray-100 bg-white dark:bg-gray-800';
  }

  barClass(pct: number): string {
    if (pct >= 90) return 'bg-red-500';
    if (pct >= 75) return 'bg-yellow-500';
    if (pct >= 50) return 'bg-blue-500';
    return 'bg-green-500';
  }

  alertBadge(pct: number): { text: string; cls: string } | null {
    if (pct >= 100) return { text: 'Budget épuisé', cls: 'bg-red-100 text-red-700' };
    if (pct >= 90) return { text: 'Alerte 90%', cls: 'bg-red-100 text-red-600' };
    if (pct >= 75) return { text: 'Alerte 75%', cls: 'bg-yellow-100 text-yellow-700' };
    if (pct >= 50) return { text: 'Alerte 50%', cls: 'bg-blue-100 text-blue-600' };
    return null;
  }

  private mockData(): Budget[] {
    return [
      { id: 1, clubId: 1, label: 'Budget annuel 2025/2026', totalAmount: 5000, consumedAmount: 3100, remainingAmount: 1900, consumptionPercentage: 62, periodStart: '2025-09-01', periodEnd: '2026-08-31' },
      { id: 2, clubId: 1, label: 'Budget événements S2', totalAmount: 1500, consumedAmount: 1380, remainingAmount: 120, consumptionPercentage: 92, periodStart: '2026-02-01', periodEnd: '2026-06-30' },
      { id: 3, clubId: 1, label: 'Budget communication', totalAmount: 800, consumedAmount: 350, remainingAmount: 450, consumptionPercentage: 44, periodStart: '2025-09-01', periodEnd: '2026-08-31' },
    ];
  }
}
