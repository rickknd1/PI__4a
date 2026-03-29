import { Component, OnInit } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { NgApexchartsModule } from 'ng-apexcharts';
import { TreasuryApiService } from '../../services/treasury-api.service';
import { TreasuryDashboard } from '../../models/treasury.models';

@Component({
  selector: 'app-treasury-dashboard',
  standalone: true,
  imports: [CommonModule, DecimalPipe, NgApexchartsModule],
  templateUrl: './treasury-dashboard.component.html',
})
export class TreasuryDashboardComponent implements OnInit {
  clubId = 1;
  dashboard: TreasuryDashboard | null = null;
  loading = true;
  chartOptions: any = {};

  constructor(private api: TreasuryApiService) {}

  ngOnInit() {
    this.api.getDashboard(this.clubId).subscribe({
      next: (data) => { this.dashboard = data; this.buildChart(data); this.loading = false; },
      error: () => { this.dashboard = this.mockData(); this.buildChart(this.dashboard); this.loading = false; }
    });
  }

  buildChart(data: TreasuryDashboard) {
    this.chartOptions = {
      series: [{ name: 'Revenus (TND)', data: data.monthlyRevenue?.map(m => Number(m.revenue)) ?? [] }],
      chart: { type: 'bar', height: 280, toolbar: { show: false }, fontFamily: 'inherit' },
      plotOptions: { bar: { borderRadius: 6, columnWidth: '50%' } },
      colors: ['#3b82f6'],
      xaxis: { categories: data.monthlyRevenue?.map(m => m.month) ?? [], labels: { style: { colors: '#94a3b8', fontSize: '12px' } } },
      yaxis: { labels: { formatter: (v: number) => v + ' TND', style: { colors: '#94a3b8' } } },
      grid: { borderColor: '#f1f5f9', strokeDashArray: 4 },
      tooltip: { y: { formatter: (v: number) => v + ' TND' } },
      dataLabels: { enabled: false }
    };
  }

  statusClass(status: string): string {
    const map: Record<string, string> = {
      PAID: 'bg-green-100 text-green-700', PENDING: 'bg-yellow-100 text-yellow-700',
      LATE: 'bg-red-100 text-red-700', REFUNDED: 'bg-blue-100 text-blue-700',
    };
    return map[status] ?? 'bg-gray-100 text-gray-600';
  }

  private mockData(): TreasuryDashboard {
    return {
      totalCollected: 4250, totalPending: 850, totalLate: 320,
      recoveryRate: 83.3, membersUpToDate: 34, membersLate: 7,
      budgetConsumptionPercentage: 62,
      monthlyRevenue: [
        { month: 'Oct', revenue: 600 }, { month: 'Nov', revenue: 750 },
        { month: 'Déc', revenue: 500 }, { month: 'Jan', revenue: 900 },
        { month: 'Fév', revenue: 750 }, { month: 'Mar', revenue: 750 },
      ],
      recentTransactions: []
    };
  }
}
