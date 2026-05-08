import { Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { TreasuryApiService } from '../../services/treasury-api.service';
import { AuthService } from '../../../shared/services/auth.service';
import { AnomalyAlert } from '../../models/treasury.models';

@Component({
  selector: 'app-anomalies',
  standalone: true,
  imports: [CommonModule, DatePipe],
  template: `
    <div class="p-6 space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-2xl font-bold text-gray-800 dark:text-white">Detection d'Anomalies</h2>
          <p class="text-sm text-gray-500 mt-1">Detection IA par modele Isolation Forest (entraine localement)</p>
        </div>
        <span class="px-3 py-1 rounded-full text-sm font-medium"
              [class.bg-green-100]="anomalies.length === 0" [class.text-green-700]="anomalies.length === 0"
              [class.bg-red-100]="anomalies.length > 0" [class.text-red-700]="anomalies.length > 0">
          {{ anomalies.length }} anomalie{{ anomalies.length !== 1 ? 's' : '' }} detectee{{ anomalies.length !== 1 ? 's' : '' }}
        </span>
      </div>

      <div *ngIf="loading" class="text-center py-12">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p class="mt-3 text-gray-500">Analyse des transactions en cours...</p>
      </div>

      <!-- No anomalies -->
      <div *ngIf="!loading && anomalies.length === 0" class="bg-green-50 dark:bg-green-900/20 border border-green-200 rounded-xl p-8 text-center">
        <p class="text-4xl mb-3">OK</p>
        <h3 class="font-semibold text-green-700 text-lg">Aucune anomalie detectee</h3>
        <p class="text-sm text-green-600 mt-1">Toutes les transactions sont dans les limites normales.</p>
      </div>

      <!-- Anomalies list -->
      <div *ngIf="!loading && anomalies.length > 0" class="space-y-4">
        <div *ngFor="let a of anomalies" class="bg-white dark:bg-gray-800 rounded-xl border p-5"
             [class.border-red-300]="a.confidenceScore >= 80"
             [class.border-yellow-300]="a.confidenceScore >= 60 && a.confidenceScore < 80"
             [class.border-gray-200]="a.confidenceScore < 60">

          <div class="flex items-start justify-between">
            <div class="flex-1">
              <div class="flex items-center gap-3 mb-2">
                <span [class]="typeClass(a.type)" class="px-2 py-1 rounded-full text-xs font-medium">
                  {{ formatType(a.type) }}
                </span>
                <span class="text-xs text-gray-400">{{ a.detectedAt | date:'dd/MM/yy HH:mm' }}</span>
              </div>
              <p class="text-gray-800 dark:text-white">{{ a.description }}</p>
              <p class="text-xs text-gray-400 mt-1" *ngIf="a.paymentId">Paiement #{{ a.paymentId }}</p>
              <p class="text-xs text-gray-400 mt-1" *ngIf="a.expenseId">Depense #{{ a.expenseId }}</p>
            </div>

            <!-- Confidence gauge -->
            <div class="text-center ml-4">
              <div class="w-16 h-16 rounded-full flex items-center justify-center border-4"
                   [class.border-red-500]="a.confidenceScore >= 80"
                   [class.border-yellow-500]="a.confidenceScore >= 60 && a.confidenceScore < 80"
                   [class.border-gray-300]="a.confidenceScore < 60">
                <span class="text-sm font-bold"
                      [class.text-red-600]="a.confidenceScore >= 80"
                      [class.text-yellow-600]="a.confidenceScore >= 60 && a.confidenceScore < 80">
                  {{ a.confidenceScore }}%
                </span>
              </div>
              <p class="text-xs text-gray-400 mt-1">Confiance</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Method explanation -->
      <div *ngIf="!loading" class="bg-purple-50 dark:bg-gray-800 rounded-xl border border-purple-200 p-4">
        <h3 class="font-medium text-purple-800 dark:text-gray-300 mb-2">Algorithmes IA utilises</h3>
        <div class="space-y-2 text-sm text-gray-700">
          <p><strong>1. Isolation Forest (entraine localement)</strong> : modele ML non-supervise qui apprend les patterns normaux des depenses selon 9 features (montant, categorie, heure, membre, delai validation, etc.) et isole les outliers.</p>
          <p><strong>2. Z-Score</strong> (fallback si modele non entraine) : ecart-type sur montants paiements, seuil > 2.0.</p>
          <p><strong>3. Detection doubles paiements</strong> : meme membre + meme montant + &lt;24h d'ecart.</p>
        </div>
      </div>
    </div>
  `,
})
export class AnomaliesComponent implements OnInit {
  clubId: number | string = 1;
  anomalies: AnomalyAlert[] = [];
  loading = true;
  error = '';

  constructor(private api: TreasuryApiService, private auth: AuthService) {}

  ngOnInit() {
    const u = this.auth.getCurrentUser();
    this.clubId = (u?.clubId as any) ?? 1;
    this.api.getAnomalies(this.clubId).subscribe({
      next: (data) => { this.anomalies = data; this.loading = false; },
      error: () => { this.error = 'Impossible de charger les anomalies.'; this.loading = false; }
    });
  }

  typeClass(type: string): string {
    if (type === 'DOUBLE_PAIEMENT_SUSPECT') return 'bg-red-100 text-red-700';
    if (type === 'MONTANT_INHABITUEL') return 'bg-yellow-100 text-yellow-700';
    if (type === 'DEPENSE_ANORMALE') return 'bg-orange-100 text-orange-700';
    if (type === 'ML_ISOLATION_FOREST') return 'bg-purple-100 text-purple-700';
    return 'bg-gray-100 text-gray-600';
  }

  formatType(type: string): string {
    const map: Record<string, string> = {
      'MONTANT_INHABITUEL': 'Montant inhabituel',
      'DEPENSE_ANORMALE': 'Depense anormale',
      'DOUBLE_PAIEMENT_SUSPECT': 'Double paiement suspect',
      'FREQUENCE_ANORMALE': 'Frequence anormale',
      'ML_ISOLATION_FOREST': 'IA - Isolation Forest',
    };
    return map[type] ?? type;
  }

}
