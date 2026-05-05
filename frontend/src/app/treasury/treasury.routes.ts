import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';

// Constantes de roles — alignees sur le module User (esprit.com.clubhub.entity.Role)
const TRESORIER_ONLY: any[] = ['TRESORIER'];
const BUREAU = ['PRESIDENT', 'VICE_PRESIDENT', 'SECRETAIRE_GENERALE'];
const READ_REPORTS = ['TRESORIER', 'PRESIDENT', 'VICE_PRESIDENT', 'SECRETAIRE_GENERALE', 'RH'];
// Rôles "membre simple" tolérés tels quels par le guard. On accepte plusieurs
// alias parce que la base contient historiquement à la fois COMMITTEE_MEMBER
// (alias officiel côté user-service), MEMBRE_SIMPLE (legacy treasury) et
// quelques variantes en français accentué. Sans cette liste élargie, le guard
// rejetait Dylan (COMMITTEE_MEMBER) et redirigeait vers espace-membre, qui
// rejetait à nouveau → boucle infinie → tab freeze.
const ALL_AUTH: any[] = [
  'TRESORIER', 'PRESIDENT', 'VICE_PRESIDENT', 'SECRETAIRE_GENERALE',
  'SECRETAIRE_GENERAL', 'RH', 'MEMBRE_SIMPLE', 'COMMITTEE_MEMBER',
  'MEMBRE', 'MEMBER'
];

export const TREASURY_ROUTES: Routes = [
  {
    path: '',
    canActivate: [authGuard(READ_REPORTS as any)],
    loadComponent: () =>
      import('./components/dashboard/treasury-dashboard.component').then(m => m.TreasuryDashboardComponent),
  },
  {
    path: 'login',
    redirectTo: '/signin',
    pathMatch: 'full',
  },

  // ── Espace MEMBRE_SIMPLE (front-office) ─────────────────────────
  {
    path: 'espace-membre',
    canActivate: [authGuard(ALL_AUTH as any)],
    loadComponent: () =>
      import('./components/espace-membre/espace-membre.component').then(m => m.EspaceMembreComponent),
  },
  {
    path: 'mes-paiements',
    canActivate: [authGuard(ALL_AUTH as any)],
    loadComponent: () =>
      import('./components/membre-paiement/membre-paiement.component').then(m => m.MembrePaiementComponent),
  },
  {
    path: 'payer-cotisation',
    canActivate: [authGuard(ALL_AUTH as any)],
    loadComponent: () =>
      import('./components/payer-cotisation/payer-cotisation.component').then(m => m.PayerCotisationComponent),
  },
  {
    path: 'demande-depense',
    canActivate: [authGuard(ALL_AUTH as any)],
    loadComponent: () =>
      import('./components/demande-depense/demande-depense.component').then(m => m.DemandeDepenseComponent),
  },
  {
    path: 'mes-notifications',
    canActivate: [authGuard(ALL_AUTH as any)],
    loadComponent: () =>
      import('./components/mes-notifications/mes-notifications.component').then(m => m.MesNotificationsComponent),
  },

  // ── Back-office Tresorier ───────────────────────────────────────
  {
    path: 'cotisations',
    canActivate: [authGuard(TRESORIER_ONLY as any)],
    data: { defaultTab: 'rules' },
    loadComponent: () =>
      import('./components/cotisations/cotisations.component').then(m => m.CotisationsComponent),
  },
  {
    path: 'payments',
    canActivate: [authGuard(READ_REPORTS as any)],
    data: { defaultTab: 'payments' },
    loadComponent: () =>
      import('./components/cotisations/cotisations.component').then(m => m.CotisationsComponent),
  },
  {
    path: 'depenses',
    canActivate: [authGuard(READ_REPORTS as any)],
    loadComponent: () =>
      import('./components/depenses/depenses.component').then(m => m.DepensesComponent),
  },
  {
    path: 'budget',
    canActivate: [authGuard(READ_REPORTS as any)],
    loadComponent: () =>
      import('./components/budget/budget.component').then(m => m.BudgetComponent),
  },
  {
    path: 'rapports',
    canActivate: [authGuard(READ_REPORTS as any)],
    loadComponent: () =>
      import('./components/rapports/rapports.component').then(m => m.RapportsComponent),
  },
  {
    path: 'remboursements',
    canActivate: [authGuard(TRESORIER_ONLY as any)],
    loadComponent: () =>
      import('./components/remboursements/remboursements.component').then(m => m.RemboursementsComponent),
  },
  {
    path: 'audit',
    canActivate: [authGuard(READ_REPORTS as any)],
    loadComponent: () =>
      import('./components/audit/audit.component').then(m => m.AuditComponent),
  },

  // ── IA (lecture rapports) ────────────────────────────────────────
  {
    path: 'chatbot',
    canActivate: [authGuard(READ_REPORTS as any)],
    loadComponent: () =>
      import('./components/chatbot/chatbot.component').then(m => m.ChatbotComponent),
  },
  {
    path: 'predictions',
    canActivate: [authGuard(READ_REPORTS as any)],
    loadComponent: () =>
      import('./components/predictions/predictions.component').then(m => m.PredictionsComponent),
  },
  {
    path: 'anomalies',
    canActivate: [authGuard(READ_REPORTS as any)],
    loadComponent: () =>
      import('./components/anomalies/anomalies.component').then(m => m.AnomaliesComponent),
  },
];
