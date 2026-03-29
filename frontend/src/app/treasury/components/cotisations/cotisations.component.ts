import { Component, OnInit } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { TreasuryApiService } from '../../services/treasury-api.service';
import { CotisationRule, Payment } from '../../models/treasury.models';

@Component({
  selector: 'app-cotisations',
  standalone: true,
  imports: [CommonModule, DecimalPipe, FormsModule, ReactiveFormsModule],
  templateUrl: './cotisations.component.html',
})
export class CotisationsComponent implements OnInit {
  clubId = 1;
  rules: CotisationRule[] = [];
  payments: Payment[] = [];
  loading = true;
  showRuleForm = false;
  activeTab: 'rules' | 'payments' = 'rules';

  form: FormGroup;

  frequencies = [
    { value: 'MONTHLY', label: 'Mensuelle' },
    { value: 'QUARTERLY', label: 'Trimestrielle' },
    { value: 'ANNUAL', label: 'Annuelle' },
  ];

  constructor(private api: TreasuryApiService, private fb: FormBuilder) {
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

  ngOnInit() { this.load(); }

  load() {
    this.loading = true;
    this.api.getCotisationRules(this.clubId).subscribe({
      next: (data) => { this.rules = data; this.loading = false; },
      error: () => { this.rules = this.mockRules(); this.loading = false; }
    });
    this.api.getPayments(this.clubId).subscribe({
      next: (data) => { this.payments = data; },
      error: () => { this.payments = this.mockPayments(); }
    });
  }

  createRule() {
    if (this.form.invalid) return;
    this.api.createCotisationRule(this.clubId, this.form.value).subscribe({
      next: () => { this.showRuleForm = false; this.form.reset(); this.load(); },
      error: () => { this.showRuleForm = false; this.form.reset(); }
    });
  }

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

  private mockRules(): CotisationRule[] {
    return [
      { id: 1, clubId: 1, name: 'Cotisation annuelle 2025/2026', amount: 120, frequency: 'ANNUAL', startDate: '2025-09-01', active: true, allowExemption: false, allowInstallments: true, maxInstallments: 3 },
      { id: 2, clubId: 1, name: 'Cotisation mensuelle activités', amount: 15, frequency: 'MONTHLY', startDate: '2025-10-01', active: true, allowExemption: true, allowInstallments: false },
    ];
  }

  private mockPayments(): Payment[] {
    return [
      { id: 1, memberId: 10, memberName: 'Ali Ben Salah', clubId: 1, amount: 120, status: 'PAID', dueDate: '2025-10-01', paidAt: '2025-10-03T10:30:00' },
      { id: 2, memberId: 11, memberName: 'Sana Khelifi', clubId: 1, amount: 120, status: 'PENDING', dueDate: '2025-10-01' },
      { id: 3, memberId: 12, memberName: 'Omar Mansouri', clubId: 1, amount: 120, status: 'LATE', dueDate: '2025-10-01' },
      { id: 4, memberId: 13, memberName: 'Fatma Haddad', clubId: 1, amount: 15, status: 'PAID', dueDate: '2026-03-01', paidAt: '2026-03-02T09:00:00' },
    ];
  }
}
