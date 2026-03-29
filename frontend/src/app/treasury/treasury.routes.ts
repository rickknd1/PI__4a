import { Routes } from '@angular/router';

export const TREASURY_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./components/dashboard/treasury-dashboard.component').then(m => m.TreasuryDashboardComponent),
  },
  {
    path: 'cotisations',
    loadComponent: () =>
      import('./components/cotisations/cotisations.component').then(m => m.CotisationsComponent),
  },
  {
    path: 'depenses',
    loadComponent: () =>
      import('./components/depenses/depenses.component').then(m => m.DepensesComponent),
  },
  {
    path: 'budget',
    loadComponent: () =>
      import('./components/budget/budget.component').then(m => m.BudgetComponent),
  },
  {
    path: 'rapports',
    loadComponent: () =>
      import('./components/rapports/rapports.component').then(m => m.RapportsComponent),
  },
  {
    path: 'remboursements',
    loadComponent: () =>
      import('./components/remboursements/remboursements.component').then(m => m.RemboursementsComponent),
  },
  {
    path: 'chatbot',
    loadComponent: () =>
      import('./components/chatbot/chatbot.component').then(m => m.ChatbotComponent),
  },
];
