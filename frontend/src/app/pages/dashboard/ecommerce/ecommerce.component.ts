import { Component, OnInit } from '@angular/core';
import { EcommerceMetricsComponent } from '../../../shared/components/ecommerce/ecommerce-metrics/ecommerce-metrics.component';
import { MonthlySalesChartComponent } from '../../../shared/components/ecommerce/monthly-sales-chart/monthly-sales-chart.component';
import { MonthlyTargetComponent } from '../../../shared/components/ecommerce/monthly-target/monthly-target.component';
import { StatisticsChartComponent } from '../../../shared/components/ecommerce/statics-chart/statics-chart.component';
import { AuthService } from '../../../shared/services/auth.service';
import { Router } from '@angular/router';


@Component({
  selector: 'app-ecommerce',
  standalone: true,
  imports: [
    EcommerceMetricsComponent,
    MonthlySalesChartComponent,
    MonthlyTargetComponent,
    StatisticsChartComponent,
  ],
  templateUrl: './ecommerce.component.html',
})
export class EcommerceComponent implements OnInit {
  constructor(private authService: AuthService, private router: Router) {}

  ngOnInit(): void {
    // Tout role connecte peut voir le dashboard (lecture seule pour les non-PRESIDENT).
    // Les actions admin sont gardees au niveau des composants individuels (boutons).
    // Plus de redirection forcee : si un role atterit ici via la sidebar, il
    // doit voir la page (eventuellement sans les controles admin).
  }
}
