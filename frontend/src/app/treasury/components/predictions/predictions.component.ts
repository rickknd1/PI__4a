import { Component, OnInit } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { TreasuryApiService } from '../../services/treasury-api.service';
import { BudgetPrediction } from '../../models/treasury.models';

@Component({
  selector: 'app-predictions',
  standalone: true,
  imports: [CommonModule, DecimalPipe],
  template: `
    <div class="p-6 space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-2xl font-bold text-gray-800 dark:text-white">Predictions Budgetaires IA</h2>
          <p class="text-sm text-gray-500 mt-1">Previsions sur 3 mois par regression lineaire avec baseline robuste</p>
        </div>
        <span [class]="aiStatusClass" class="px-3 py-1 rounded-full text-sm font-medium">
          {{ aiSource }}
        </span>
      </div>

      <div *ngIf="loading" class="text-center py-12">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p class="mt-3 text-gray-500">Analyse des tendances en cours...</p>
      </div>

      <!-- Predictions cards -->
      <div *ngIf="!loading" class="grid md:grid-cols-3 gap-6">
        <div *ngFor="let p of predictions" class="bg-white dark:bg-gray-800 rounded-xl border p-6 space-y-4"
             [class.border-red-300]="p.predictedBalance < 0"
             [class.border-green-300]="p.predictedBalance > 0 && p.trend === 'UP'">

          <div class="flex items-center justify-between">
            <h3 class="font-semibold text-lg text-gray-800 dark:text-white">{{ p.period }}</h3>
            <span [class]="trendClass(p.trend)" class="px-2 py-1 rounded-full text-xs font-medium">
              {{ trendIcon(p.trend) }} {{ p.trend }}
            </span>
          </div>

          <div class="space-y-3">
            <div class="flex justify-between items-center">
              <span class="text-sm text-gray-500">Revenus prevus</span>
              <span class="font-bold text-green-600">{{ p.predictedRevenue | number:'1.2-2' }} TND</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-sm text-gray-500">Depenses prevues</span>
              <span class="font-bold text-red-600">{{ p.predictedExpenses | number:'1.2-2' }} TND</span>
            </div>
            <hr class="border-gray-100 dark:border-gray-700">
            <div class="flex justify-between items-center">
              <span class="text-sm font-medium text-gray-700 dark:text-gray-300">Solde prevu</span>
              <span class="font-bold text-lg" [class.text-green-600]="p.predictedBalance >= 0" [class.text-red-600]="p.predictedBalance < 0">
                {{ p.predictedBalance | number:'1.2-2' }} TND
              </span>
            </div>
          </div>

          <!-- Confidence bar -->
          <div>
            <div class="flex justify-between text-xs text-gray-500 mb-1">
              <span>Confiance</span>
              <span>{{ p.confidence }}%</span>
            </div>
            <div class="w-full bg-gray-200 rounded-full h-2">
              <div class="h-2 rounded-full transition-all" [style.width.%]="p.confidence"
                   [class.bg-green-500]="p.confidence >= 70"
                   [class.bg-yellow-500]="p.confidence >= 50 && p.confidence < 70"
                   [class.bg-red-500]="p.confidence < 50"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Alerts -->
      <div *ngIf="!loading && alerts.length > 0" class="bg-red-50 dark:bg-red-900/20 border border-red-200 rounded-xl p-4">
        <h3 class="font-semibold text-red-700 mb-2">Alertes proactives</h3>
        <ul class="space-y-1">
          <li *ngFor="let a of alerts" class="text-sm text-red-600 flex items-start gap-2">
            <span class="mt-0.5">!</span> {{ a }}
          </li>
        </ul>
      </div>

      <!-- Method explanation -->
      <div *ngIf="!loading" class="bg-gray-50 dark:bg-gray-800 rounded-xl border p-4">
        <h3 class="font-medium text-gray-700 dark:text-gray-300 mb-2">Methode</h3>
        <p class="text-sm text-gray-500">
          Les predictions sont calculees par <strong>regression lineaire</strong> sur l'historique des 6 derniers mois,
          avec une <strong>baseline robuste</strong> (moyenne historique si le mois courant est incomplet).
          Le score de confiance diminue avec l'horizon de prediction.
        </p>
      </div>
    </div>
  `,
})
export class PredictionsComponent implements OnInit {
  clubId = 1;
  predictions: any[] = [];
  alerts: string[] = [];
  loading = true;
  error = '';
  aiSource = 'Chargement...';
  aiStatusClass = 'bg-gray-100 text-gray-600';

  constructor(private api: TreasuryApiService) {}

  ngOnInit() {
    this.api.getPredictions(this.clubId, 3).subscribe({
      next: (data: any[]) => {
        this.predictions = data;
        this.alerts = data.flatMap((p: any) => p.alerts || []);
        const src = data.length > 0 ? data[0].source : null;
        this.aiSource = 'Regression lineaire';
        this.aiStatusClass = 'bg-blue-100 text-blue-700';
        this.loading = false;
      },
      error: () => { this.error = 'Impossible de charger les predictions.'; this.loading = false; this.aiSource = 'Erreur'; this.aiStatusClass = 'bg-red-100 text-red-600'; }
    });
  }

  trendClass(trend: string): string {
    if (trend === 'UP') return 'bg-green-100 text-green-700';
    if (trend === 'DOWN') return 'bg-red-100 text-red-700';
    return 'bg-gray-100 text-gray-600';
  }

  trendIcon(trend: string): string {
    if (trend === 'UP') return '^';
    if (trend === 'DOWN') return 'v';
    return '~';
  }

}
