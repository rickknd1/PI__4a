import { Component, OnInit } from '@angular/core';
import { CommonModule, DecimalPipe, DatePipe } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TreasuryApiService } from '../../services/treasury-api.service';
import { UserContextService } from '../../services/user-context.service';
import { Expense, MockUser } from '../../models/treasury.models';

@Component({
  selector: 'app-demande-depense',
  standalone: true,
  imports: [CommonModule, DecimalPipe, DatePipe, FormsModule, ReactiveFormsModule, RouterLink],
  template: `
    <div class="p-6 space-y-6">

      <div class="flex items-center gap-3">
        <a routerLink="/treasury/espace-membre" class="p-2 hover:bg-gray-100 rounded-lg transition">
          <svg class="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
          </svg>
        </a>
        <div>
          <h2 class="text-2xl font-bold text-gray-800 dark:text-white">Demande de depense</h2>
          <p class="text-sm text-gray-500" *ngIf="user">{{ user.firstName }} {{ user.lastName }}</p>
        </div>
      </div>

      <div *ngIf="!user" class="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-center">
        <p class="text-yellow-700 font-medium">Connectez-vous d'abord</p>
        <a routerLink="/treasury/login" class="mt-3 inline-block px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">Se connecter</a>
      </div>

      <!-- Formulaire de demande -->
      <div *ngIf="user" class="bg-white dark:bg-gray-800 rounded-2xl border p-6">
        <h3 class="font-semibold text-gray-700 dark:text-gray-200 mb-4">Nouvelle demande</h3>
        <form [formGroup]="form" (ngSubmit)="submit()" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-600 mb-1">Titre de la depense *</label>
            <input formControlName="title" placeholder="Ex: Location bus, Achat materiel..."
                   class="w-full px-4 py-3 border rounded-xl text-sm dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none">
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-600 mb-1">Description / Justification</label>
            <textarea formControlName="description" rows="3" placeholder="Decrivez la depense en detail..."
                      class="w-full px-4 py-3 border rounded-xl text-sm dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"></textarea>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-600 mb-1">Lien justificatif (optionnel)</label>
            <input formControlName="justificatifUrl" placeholder="URL du document..."
                   class="w-full px-4 py-3 border rounded-xl text-sm dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none">
          </div>

          <!-- 3 Devis obligatoires -->
          <div class="border-t pt-4 mt-2">
            <h4 class="font-semibold text-gray-700 dark:text-gray-200 mb-3">3 Devis obligatoires</h4>
            <p class="text-xs text-gray-400 mb-4">Fournissez 3 devis de fournisseurs differents. Le tresorier choisira le meilleur.</p>
            <div *ngFor="let i of [0, 1, 2]" class="mb-4 bg-gray-50 dark:bg-gray-700 rounded-xl p-4 border" [formGroupName]="'quote' + i">
              <p class="text-sm font-medium text-blue-600 dark:text-blue-400 mb-2">Devis #{{ i + 1 }}</p>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-xs font-medium text-gray-500 mb-1">Fournisseur *</label>
                  <input [formControlName]="'providerName'" placeholder="Nom du fournisseur"
                         class="w-full px-3 py-2 border rounded-lg text-sm dark:bg-gray-600 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none">
                </div>
                <div>
                  <label class="block text-xs font-medium text-gray-500 mb-1">Montant (TND) *</label>
                  <input [formControlName]="'amount'" type="number" step="0.001" placeholder="0.000"
                         class="w-full px-3 py-2 border rounded-lg text-sm dark:bg-gray-600 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none">
                </div>
              </div>
              <div class="mt-2">
                <label class="block text-xs font-medium text-gray-500 mb-1">Description du devis</label>
                <input [formControlName]="'description'" placeholder="Details du devis..."
                       class="w-full px-3 py-2 border rounded-lg text-sm dark:bg-gray-600 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none">
              </div>
            </div>
          </div>
          <button type="submit" [disabled]="form.invalid || submitting"
                  class="w-full py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-40 transition">
            {{ submitting ? 'Envoi en cours...' : 'Soumettre la demande' }}
          </button>
        </form>
      </div>

      <div *ngIf="success" class="bg-green-50 border border-green-200 rounded-xl p-4">
        <p class="text-green-700 font-medium">{{ success }}</p>
      </div>
      <div *ngIf="error" class="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">{{ error }}</div>

      <!-- Workflow explication -->
      <div *ngIf="user" class="bg-gray-50 dark:bg-gray-800 rounded-xl border p-4">
        <h4 class="font-medium text-gray-700 dark:text-gray-300 mb-2">Comment ca marche ?</h4>
        <div class="flex items-center gap-2 text-sm text-gray-500">
          <span class="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs">1. Vous soumettez</span>
          <span>→</span>
          <span class="px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs">2. Tresorier valide</span>
          <span>→</span>
          <span class="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs">3. President approuve</span>
          <span>→</span>
          <span class="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs">Facture par email</span>
        </div>
      </div>

      <!-- Mes demandes -->
      <div *ngIf="user && myExpenses.length > 0">
        <h3 class="font-semibold text-gray-700 dark:text-gray-200 mb-3">Mes demandes</h3>
        <div class="space-y-3">
          <div *ngFor="let e of myExpenses" class="bg-white dark:bg-gray-800 rounded-xl border p-4 flex items-center justify-between">
            <div>
              <p class="font-medium text-gray-800 dark:text-white">{{ e.title }}</p>
              <p class="text-xs text-gray-400 mt-1">{{ e.description }}</p>
              <div class="flex items-center gap-2 mt-2">
                <span [class]="statusClass(e.status)" class="px-2 py-0.5 rounded-full text-xs font-medium">{{ statusLabel(e.status) }}</span>
                <span *ngIf="e.category" class="px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full text-xs">{{ e.category }} ({{ e.categoryConfidenceScore }}% IA)</span>
              </div>
              <p *ngIf="e.rejectionReason" class="text-xs text-red-500 mt-1">Motif rejet: {{ e.rejectionReason }}</p>
            </div>
            <p class="text-xl font-bold text-gray-800 dark:text-white">{{ e.amount | number:'1.2-2' }} <span class="text-sm text-gray-400">TND</span></p>
          </div>
        </div>
      </div>

    </div>
  `,
})
export class DemandeDepenseComponent implements OnInit {
  user: MockUser | null = null;
  myExpenses: Expense[] = [];
  form: FormGroup;
  submitting = false;
  success = '';
  error = '';

  constructor(private api: TreasuryApiService, private userCtx: UserContextService, private fb: FormBuilder) {
    this.form = this.fb.group({
      title: ['', Validators.required],
      description: [''],
      justificatifUrl: [''],
      quote0: this.fb.group({
        providerName: ['', Validators.required],
        amount: [null, [Validators.required, Validators.min(0.001)]],
        description: [''],
      }),
      quote1: this.fb.group({
        providerName: ['', Validators.required],
        amount: [null, [Validators.required, Validators.min(0.001)]],
        description: [''],
      }),
      quote2: this.fb.group({
        providerName: ['', Validators.required],
        amount: [null, [Validators.required, Validators.min(0.001)]],
        description: [''],
      }),
    });
  }

  ngOnInit() {
    this.user = this.userCtx.getCurrentUser();
    if (this.user) this.loadMyExpenses();
  }

  loadMyExpenses() {
    this.api.getExpenses(1).subscribe({
      next: (data) => { this.myExpenses = data.filter(e => e.submittedByMemberId === this.user!.id); },
      error: () => {}
    });
  }

  submit() {
    if (this.form.invalid || !this.user) return;
    this.submitting = true;
    this.success = '';
    this.error = '';
    const v = this.form.value;
    const quotes = [v.quote0, v.quote1, v.quote2];
    // Use the average of the 3 quotes as initial amount
    const avgAmount = quotes.reduce((sum: number, q: any) => sum + (q.amount || 0), 0) / 3;
    const payload = {
      title: v.title,
      description: v.description,
      amount: Math.round(avgAmount * 1000) / 1000,
      justificatifUrl: v.justificatifUrl,
      quotes,
    };
    this.api.submitExpense(1, payload).subscribe({
      next: (exp) => {
        this.success = 'Demande "' + exp.title + '" soumise ! Categorie IA: ' + (exp.category || 'AUTRE') + ' (' + (exp.categoryConfidenceScore || 0) + '% confiance). Le tresorier sera notifie par email.';
        this.form.reset();
        this.submitting = false;
        this.loadMyExpenses();
      },
      error: () => { this.error = 'Erreur lors de la soumission.'; this.submitting = false; }
    });
  }

  statusClass(s: string): string {
    const m: Record<string, string> = { SUBMITTED: 'bg-blue-100 text-blue-700', VALIDATED: 'bg-yellow-100 text-yellow-700', APPROVED: 'bg-green-100 text-green-700', REJECTED: 'bg-red-100 text-red-700' };
    return m[s] ?? 'bg-gray-100 text-gray-600';
  }
  statusLabel(s: string): string {
    const m: Record<string, string> = { SUBMITTED: 'Soumise', VALIDATED: 'Validee', APPROVED: 'Approuvee', REJECTED: 'Rejetee' };
    return m[s] ?? s;
  }
}
