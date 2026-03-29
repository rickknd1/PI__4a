import { Component, OnInit } from '@angular/core';
import { CommonModule, DecimalPipe, DatePipe } from '@angular/common';
import { TreasuryApiService } from '../../services/treasury-api.service';
import { Payment } from '../../models/treasury.models';

@Component({
  selector: 'app-rapports',
  standalone: true,
  imports: [CommonModule, DecimalPipe, DatePipe],
  templateUrl: './rapports.component.html',
})
export class RapportsComponent implements OnInit {
  clubId = 1;
  payments: Payment[] = [];
  loading = true;

  stats = { total: 0, paid: 0, pending: 0, late: 0, paidCount: 0, pendingCount: 0, lateCount: 0 };

  constructor(private api: TreasuryApiService) {}

  ngOnInit() {
    this.api.getPayments(this.clubId).subscribe({
      next: (data) => { this.payments = data; this.computeStats(); this.loading = false; },
      error: () => { this.payments = this.mockData(); this.computeStats(); this.loading = false; }
    });
  }

  computeStats() {
    this.payments.forEach(p => {
      const a = Number(p.amount);
      if (p.status === 'PAID') { this.stats.paid += a; this.stats.paidCount++; }
      else if (p.status === 'PENDING') { this.stats.pending += a; this.stats.pendingCount++; }
      else if (p.status === 'LATE') { this.stats.late += a; this.stats.lateCount++; }
      this.stats.total += a;
    });
  }

  exportCSV() {
    const headers = ['ID', 'Membre', 'Montant', 'Statut', 'Echeance', 'Paye le'];
    const rows = this.payments.map(p => [
      p.id, p.memberName || `Membre#${p.memberId}`,
      p.amount, p.status, p.dueDate, p.paidAt || ''
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'rapport-tresorerie.csv'; a.click();
  }

  statusClass(s: string): string {
    const map: Record<string, string> = {
      PAID: 'bg-green-100 text-green-700', PENDING: 'bg-yellow-100 text-yellow-700',
      LATE: 'bg-red-100 text-red-700', REFUNDED: 'bg-blue-100 text-blue-700',
    };
    return map[s] ?? 'bg-gray-100 text-gray-500';
  }

  private mockData(): Payment[] {
    return [
      { id: 1, memberId: 10, memberName: 'Ali Ben Salah', clubId: 1, amount: 120, status: 'PAID', dueDate: '2026-01-01', paidAt: '2026-01-03T10:00:00' },
      { id: 2, memberId: 11, memberName: 'Sana Khelifi', clubId: 1, amount: 120, status: 'PENDING', dueDate: '2026-02-01' },
      { id: 3, memberId: 12, memberName: 'Omar Mansouri', clubId: 1, amount: 120, status: 'LATE', dueDate: '2026-01-01' },
      { id: 4, memberId: 13, memberName: 'Fatma Haddad', clubId: 1, amount: 120, status: 'PAID', dueDate: '2026-01-01', paidAt: '2026-01-05T14:00:00' },
      { id: 5, memberId: 14, memberName: 'Hedi Saidi', clubId: 1, amount: 15, status: 'PAID', dueDate: '2026-03-01', paidAt: '2026-03-02T09:00:00' },
    ];
  }
}
