import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DashboardService } from '../../services/dashboard.service';
import { Chart } from 'chart.js/auto';

@Component({
  selector: 'app-vem-admin-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.css']
})
export class VemAdminDashboardComponent implements OnInit, OnDestroy {

  stats: any = {
    totalEvents: 0,
    totalRegistrations: 0,
    totalParticipants: 0,
    totalRevenue: 0
  };

  events: any[] = [];
  statsChart: Chart | null = null;
  refreshInterval: any;

  loading = false;
  errorMsg = '';

  constructor(private dashboardService: DashboardService) {}

  ngOnInit(): void {
    this.loadData();

    this.refreshInterval = setInterval(() => {
      this.loadData();
    }, 5000);
  }

  ngOnDestroy(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }

    if (this.statsChart) {
      this.statsChart.destroy();
    }
  }

  loadData(): void {
    this.loading = true;
    this.errorMsg = '';

    this.dashboardService.getStats().subscribe({
      next: (res) => {
        console.log('STATS DASHBOARD:', res);

        this.stats = res || {
          totalEvents: 0,
          totalRegistrations: 0,
          totalParticipants: 0,
          totalRevenue: 0
        };

        this.loading = false;

        setTimeout(() => {
          this.createChart();
        }, 100);
      },
      error: (err) => {
        console.error('ERREUR STATS:', err);
        this.loading = false;
        this.errorMsg = 'Erreur lors du chargement des statistiques';
      }
    });

    this.dashboardService.getEvents().subscribe({
      next: (res) => {
        console.log('EVENTS DASHBOARD:', res);
        this.events = Array.isArray(res) ? res : [];
      },
      error: (err) => {
        console.error('ERREUR EVENTS DASHBOARD:', err);
        this.errorMsg = 'Erreur lors du chargement des événements';
      }
    });
  }

  createChart(): void {
    const canvas = document.getElementById('statsChart') as HTMLCanvasElement;

    if (!canvas) return;

    if (this.statsChart) {
      this.statsChart.destroy();
    }

    this.statsChart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: ['Events', 'Registrations', 'Participants', 'Revenue'],
        datasets: [
          {
            label: 'Dashboard Statistics',
            data: [
              this.stats?.totalEvents || 0,
              this.stats?.totalRegistrations || 0,
              this.stats?.totalParticipants || 0,
              this.stats?.totalRevenue || 0
            ],
            borderWidth: 1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true
          }
        }
      }
    });
  }

  getStartDate(event: any): number {
    if (!event || !event.scheduledAt) return 0;

    const date = new Date(event.scheduledAt);
    return isNaN(date.getTime()) ? 0 : date.getTime();
  }

  getEndDate(event: any): number {
    if (!event) return 0;

    if (event.endAt) {
      const end = new Date(event.endAt);
      return isNaN(end.getTime()) ? 0 : end.getTime();
    }

    const start = this.getStartDate(event);

    if (start === 0) return 0;

    return start + 2 * 60 * 60 * 1000;
  }

  getUpcomingEvents(): any[] {
    const now = Date.now();

    return this.events
      .filter(e => this.getStartDate(e) > now)
      .sort((a, b) => this.getStartDate(a) - this.getStartDate(b))
      .slice(0, 5);
  }

  getLiveEvents(): any[] {
    const now = Date.now();

    return this.events.filter(e => {
      const start = this.getStartDate(e);
      const end = this.getEndDate(e);

      return start > 0 && now >= start && now <= end;
    });
  }

  getFinishedEvents(): any[] {
    const now = Date.now();

    return this.events.filter(e => {
      const end = this.getEndDate(e);

      return end > 0 && now > end;
    });
  }

  getTopEvents(): any[] {
    return [...this.events]
      .sort((a, b) => (b.currentParticipants || 0) - (a.currentParticipants || 0))
      .slice(0, 5);
  }

  getEventStatus(event: any): string {
    const now = Date.now();
    const start = this.getStartDate(event);
    const end = this.getEndDate(event);

    if (start === 0) return 'UNKNOWN';

    if (now >= start && now <= end) return 'LIVE';

    if (now > end) return 'FINISHED';

    return 'UPCOMING';
  }

  getFillRate(event: any): number {
    if (!event || !event.maxParticipants || event.maxParticipants === 0) {
      return 0;
    }

    return Math.round(((event.currentParticipants || 0) / event.maxParticipants) * 100);
  }

  formatDate(event: any): string {
    const start = this.getStartDate(event);

    if (start === 0) return 'Not defined';

    return new Date(start).toLocaleString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}