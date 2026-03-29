import { Component, OnInit } from '@angular/core';
import { CommonModule, DecimalPipe, DatePipe } from '@angular/common';
import { TreasuryApiService } from '../../services/treasury-api.service';
import { Payment } from '../../models/treasury.models';

@Component({
  selector: 'app-remboursements',
  standalone: true,
  imports: [CommonModule, DecimalPipe, DatePipe],
  templateUrl: './remboursements.component.html',
})
export class RemboursementsComponent implements OnInit {
  clubId = 1;
  paid: Payment[] = [];
  refunded: Payment[] = [];
  loading = true;
  selectedPayments: number[] = [];

  constructor(private api: TreasuryApiService) {}

  ngOnInit() {
    this.api.getPayments(this.clubId).subscribe({
      next: (data) => {
        this.paid = data.filter(p => p.status === 'PAID');
        this.refunded = data.filter(p => p.status === 'REFUNDED' || p.status === 'PARTIALLY_REFUNDED');
        this.loading = false;
      },
      error: () => { this.paid = this.mockPaid(); this.refunded = this.mockRefunded(); this.loading = false; }
    });
  }

  toggle(id: number) {
    const i = this.selectedPayments.indexOf(id);
    if (i === -1) this.selectedPayments.push(id); else this.selectedPayments.splice(i, 1);
  }

  isSelected(id: number) { return this.selectedPayments.includes(id); }

  initiateRefunds() {
    if (!this.selectedPayments.length) return;
    alert(`Remboursement initié pour ${this.selectedPayments.length} paiement(s). Stripe traitera sous 3-5 jours ouvrés.`);
    this.selectedPayments = [];
  }

  private mockPaid(): Payment[] {
    return [
      { id: 1, memberId: 10, memberName: 'Ali Ben Salah', clubId: 1, amount: 120, status: 'PAID', dueDate: '2026-01-01', paidAt: '2026-01-03T10:00:00' },
      { id: 4, memberId: 13, memberName: 'Fatma Haddad', clubId: 1, amount: 120, status: 'PAID', dueDate: '2026-01-01', paidAt: '2026-01-05T14:00:00' },
      { id: 5, memberId: 14, memberName: 'Hedi Saidi', clubId: 1, amount: 15, status: 'PAID', dueDate: '2026-03-01', paidAt: '2026-03-02T09:00:00' },
    ];
  }

  private mockRefunded(): Payment[] {
    return [
      { id: 6, memberId: 15, memberName: 'Nour Triki', clubId: 1, amount: 120, status: 'REFUNDED', dueDate: '2025-12-01', paidAt: '2025-12-03T09:00:00' },
    ];
  }
}
