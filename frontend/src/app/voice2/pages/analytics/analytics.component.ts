import { Component, OnInit } from '@angular/core';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration } from 'chart.js';
import { VirtualEventService } from '../../../ameni-ve/services/virtual-event.service';

@Component({
  selector: 'app-voice2-analytics',
  standalone: true,
  imports: [BaseChartDirective],
  templateUrl: './analytics.component.html',
  styleUrls: ['./analytics.component.css'],
})
export class Voice2AnalyticsComponent implements OnInit {
  totalEvents = 0;
  totalParticipants = 0;
  totalRevenue = 0;

  pieChartData: ChartConfiguration<'pie'>['data'] = {
    labels: ['Paid', 'Free'],
    datasets: [{ data: [0, 0] }],
  };

  lineChartData: ChartConfiguration<'line'>['data'] = {
    labels: [],
    datasets: [{ data: [], label: 'Events / Month' }],
  };

  constructor(private eventService: VirtualEventService) {}

  ngOnInit(): void {
    this.eventService.getAllEvents().subscribe((res: any[]) => {
      this.totalEvents = res.length;
      this.totalParticipants = res.reduce((sum, event) => sum + (event.currentParticipants || 0), 0);
      this.totalRevenue = res.reduce(
        (sum, event) => (event.isPaid ? sum + (event.price || 0) * (event.currentParticipants || 0) : sum),
        0,
      );

      const paid = res.filter((event) => event.isPaid).length;
      const free = res.filter((event) => !event.isPaid).length;
      this.pieChartData.datasets[0].data = [paid, free];

      const months: Record<string, number> = {};
      res.forEach((event) => {
        const month = String(new Date(event.scheduledAt).getMonth() + 1);
        months[month] = (months[month] || 0) + 1;
      });

      this.lineChartData.labels = Object.keys(months);
      this.lineChartData.datasets[0].data = Object.values(months);
    });
  }
}
