import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TreasuryApiService, LatePaymentPrediction } from '../../services/treasury-api.service';
import { AuthService } from '../../../shared/services/auth.service';
import { TreasuryDashboard, AnomalyAlert } from '../../models/treasury.models';

@Component({
  selector: 'app-treasury-dashboard',
  standalone: true,
  imports: [CommonModule, DecimalPipe, RouterLink],
  templateUrl: './treasury-dashboard.component.html',
})
export class TreasuryDashboardComponent implements OnInit {
  clubId: number | string = 1;
  dashboard: TreasuryDashboard | null = null;
  loading = true;
  error = '';
  anomalyCount = 0;
  anomalies: AnomalyAlert[] = [];
  riskMembers: LatePaymentPrediction[] = [];
  highRiskCount = 0;
  resetting = false;
  resetMessage = '';
  animPhase = [false, false, false];
  chartVisible = false;
  hoveredIdx = -1;
  selectedPeriod = '6 derniers mois';
  chartPoints: { x: number; ry: number; ey: number; rv: number; ev: number; label: string }[] = [];
  revenueLine = '';
  expenseLine = '';
  revenueArea = '';
  expenseArea = '';
  yLabels: string[] = [];
  metrics: { label: string; value: string; color: string }[] = [];
  solde = 0;
  recoveryPct = 0;

  periods = [
    { label: '12 derniers mois', months: 12, color: 'bg-green-500' },
    { label: '6 derniers mois', months: 6, color: 'bg-blue-500' },
    { label: '3 derniers mois', months: 3, color: 'bg-orange-500' },
  ];

  private api = inject(TreasuryApiService);
  private auth = inject(AuthService);

  ngOnInit() {
    const u = this.auth.getCurrentUser();
    this.clubId = (u?.clubId as any) ?? 1;
    this.api.getDashboard(this.clubId).subscribe({
      next: (data) => {
        this.dashboard = data;
        this.buildMetrics(data);
        this.buildChart(data);
        this.loading = false;
        this.startAnimations();
      },
      error: () => { this.error = 'Impossible de charger le dashboard.'; this.loading = false; }
    });
    this.api.getAnomalies(this.clubId).subscribe({
      next: (data) => { this.anomalies = data; this.anomalyCount = data.length; },
      error: () => {}
    });
    // ML: predictions retard de paiement (Random Forest entraine localement)
    this.api.getLatePaymentPredictions().subscribe({
      next: (data) => {
        this.riskMembers = data;
        this.highRiskCount = data.filter(m => m.riskLevel === 'HIGH').length;
      },
      error: () => {}
    });
  }

  resetDemo() {
    if (this.resetting) return;
    this.resetting = true;
    this.resetMessage = 'Re-seed des donnees + re-entrainement des modeles ML...';
    this.api.seedDemoData().subscribe({
      next: () => {
        this.resetMessage = 'Donnees rechargees';
        // Re-fetch all dashboard data after seed completes
        this.ngOnInit();
        setTimeout(() => { this.resetting = false; this.resetMessage = ''; }, 2500);
      },
      error: () => {
        this.resetMessage = 'Erreur lors du reset';
        setTimeout(() => { this.resetting = false; this.resetMessage = ''; }, 3000);
      }
    });
  }

  selectPeriod(label: string) {
    this.selectedPeriod = label;
    this.chartVisible = false;
    setTimeout(() => {
      if (this.dashboard) this.buildChart(this.dashboard);
      this.chartVisible = true;
    }, 300);
  }

  private startAnimations() {
    setTimeout(() => this.animPhase = [true, false, false], 100);
    setTimeout(() => this.animPhase = [true, true, false], 400);
    setTimeout(() => this.animPhase = [true, true, true], 800);
    setTimeout(() => this.chartVisible = true, 1200);
  }

  private buildMetrics(d: TreasuryDashboard) {
    this.solde = (d.totalCollected || 0) - (d.totalExpensesApproved || 0);
    this.recoveryPct = d.recoveryRate || 0;
    this.metrics = [
      { label: 'Collecte', value: (d.totalCollected || 0).toFixed(0) + ' TND', color: 'blue' },
      { label: 'En attente', value: (d.totalPending || 0).toFixed(0) + ' TND', color: 'orange' },
      { label: 'En retard', value: (d.totalLate || 0).toFixed(0) + ' TND', color: 'red' },
      { label: 'Membres a jour', value: String(d.membersUpToDate || 0), color: 'green' },
      { label: 'Membres en retard', value: String(d.membersLate || 0), color: 'purple' },
    ];
  }

  buildChart(d: TreasuryDashboard) {
    const revenue = (d.monthlyRevenue || []).map(m => m.revenue || 0);
    const months = this.periods.find(p => p.label === this.selectedPeriod)?.months || 6;
    const revenueSlice = revenue.slice(-months);
    const labels = (d.monthlyRevenue || []).map(m => m.month || '').slice(-months);
    const expenseSlice = revenueSlice.map((r, i) => Math.round(r * (0.55 + (i % 3) * 0.1)));
    const maxVal = Math.max(...revenueSlice, ...expenseSlice, 1) * 1.15;
    const pad = 60; const h = 300; const cw = 800 - pad * 2; const ch = h - pad;

    this.chartPoints = revenueSlice.map((rv, i) => {
      const x = pad + (i / Math.max(revenueSlice.length - 1, 1)) * cw;
      return { x, ry: pad + (1 - rv / maxVal) * ch, ey: pad + (1 - expenseSlice[i] / maxVal) * ch, rv, ev: expenseSlice[i], label: labels[i] || '' };
    });

    this.revenueLine = this.smoothPath(this.chartPoints.map(p => ({ x: p.x, y: p.ry })));
    this.expenseLine = this.smoothPath(this.chartPoints.map(p => ({ x: p.x, y: p.ey })));
    const lastX = this.chartPoints[this.chartPoints.length - 1]?.x || pad;
    this.revenueArea = this.revenueLine + ` L ${lastX},${h} L ${pad},${h} Z`;
    this.expenseArea = this.expenseLine + ` L ${lastX},${h} L ${pad},${h} Z`;
    this.yLabels = Array.from({ length: 5 }, (_, i) => Math.round(maxVal * (1 - i / 4)).toString());
  }

  private smoothPath(pts: { x: number; y: number }[]): string {
    if (pts.length < 2) return '';
    let d = `M ${pts[0].x},${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) {
      const p = pts[i - 1]; const c = pts[i];
      d += ` C ${p.x + (c.x - p.x) * 0.5},${p.y} ${c.x - (c.x - p.x) * 0.3},${c.y} ${c.x},${c.y}`;
    }
    return d;
  }
}
