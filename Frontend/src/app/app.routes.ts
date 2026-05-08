import { Routes } from '@angular/router';
import { EcommerceComponent } from './pages/dashboard/ecommerce/ecommerce.component';
import { ProfileComponent } from './pages/profile/profile.component';
import { AppLayoutComponent } from './shared/layout/app-layout/app-layout.component';
import { RoleAwareLayoutComponent } from './shared/layout/role-aware-layout/role-aware-layout.component';

// -------- Composants IA (intégration Souha) --------
import { QrValidationComponent } from './components/moi/qr-validation/qr-validation.component';
import { ScanSuccessComponent } from './components/moi/scan-success/scan-success.component';
import { VoteWithTokenComponent } from './components/moi/vote-with-token/vote-with-token.component';
import { QrScanInstructionsComponent } from './components/moi/qr-scan-instructions/qr-scan-instructions.component';
import { SetupPasswordComponent } from './pages/moi/setup-password/setup-password.component';

import { AllBorrowedComponent } from './pages/borrowed-items/all-borrowed/all-borrowed.component';
import { LendersComponent } from './pages/borrowed-items/lenders/lenders.component';

import { SignInComponent } from './pages/auth-pages/sign-in/sign-in.component';
import { SignUpComponent } from './pages/auth-pages/sign-up/sign-up.component';
import { CalenderComponent } from './pages/calender/calender.component';

import { ClubFormComponent } from './pages/clubs/club-form/club-form.component';
import { ClubDetailComponent } from './pages/clubs/club-detail/club-detail.component';
import { ClubListComponent } from './pages/clubs/club-list/club-list.component';

import { ElectionListComponent } from './pages/elections/election-list/election-list.component';
import { ElectionFormComponent } from './pages/elections/election-form/election-form.component';
import { ElectionDetailComponent } from './pages/elections/election-detail/election-detail.component';

import { UserListComponent } from './pages/users/user-list/user-list.component';
import { RoleManagementComponent } from './pages/roles/role-management.component';
import { SetupClubComponent } from './pages/setup-club/setup-club.component';

import {
  authGuard,
  ceoGuard,
  guestGuard,
  homeGuard,
  presidentGuard,
  secretaryGuard,
  roleManagementGuard,
  clubSettingsGuard,
  voice2BureauGuard,
  voice2MyReportsGuard,
  storeAdminGuard,
} from './guards/auth.guard';

export const routes: Routes = [
  // Racine — redirige selon l'état (logged in / no club / has club)
  { path: '', pathMatch: 'full', canActivate: [homeGuard], children: [] },

  // -------- Pages publiques (sans layout, sans guard — visibles aussi aux non-connectes) --------
  {
    path: 'landing',
    loadComponent: () => import('./landing/landing-page.component').then(m => m.LandingPageComponent),
    title: 'ClubHub — The operating system for student organizations',
  },
  {
    path: 'features/:featureId',
    loadComponent: () => import('./landing/features/feature-detail.component').then(m => m.FeatureDetailComponent),
    title: 'Feature | ClubHub',
  },

  // -------- Pages d'authentification (sans layout) --------
  { path: 'signin',     component: SignInComponent,    canActivate: [guestGuard], title: 'Sign In | ClubHub' },
  { path: 'signup',     component: SignUpComponent,    canActivate: [guestGuard], title: 'Sign Up | ClubHub' },

  // setup-club est accessible aussitôt connecté (avant d'avoir un club)
  { path: 'setup-club', component: SetupClubComponent, canActivate: [authGuard], title: 'Créer votre club | ClubHub' },

  // -------- Application protégée (layout choisi selon le role) --------
  // RoleAwareLayoutComponent rend AppLayoutComponent (sidebar) pour le bureau
  // ou MemberLayoutComponent (top navbar landing-style) pour MEMBRE_SIMPLE.
  {
    path: '',
    component: RoleAwareLayoutComponent,
    canActivate: [authGuard],
    children: [
      // -------- Front-office commun (page d'accueil pour TOUS les roles) --------
      {
        path: 'home',
        loadComponent: () => import('./pages/home/home.component').then(m => m.HomeComponent),
        canActivate: [authGuard],
        title: 'Accueil | ClubHub',
      },

      // /dashboard est l'ancien template ecommerce mocke. On redirige vers
      // /home (le vrai front-office ClubHub avec donnees reelles).
      { path: 'dashboard', redirectTo: '/home', pathMatch: 'full' },
      { path: 'calendar',  component: CalenderComponent,  title: 'Calendar | ClubHub' },
      { path: 'profile',   component: ProfileComponent,   title: 'Profile | ClubHub' },

      {
        path: 'events',
        loadComponent: () => import('./pages/all-events/all-events.component').then(m => m.AllEventsComponent),
        title: 'Events | ClubHub',
      },
      // -------- Événements virtuels (VEM) : prefix /ameni/... (groupement sans layout parent) --------
      {
        path: 'ameni',
        children: [
          {
            path: 'events',
            loadComponent: () => import('./ameni-ve/pages/events/events.component').then(m => m.EventsComponent),
            title: 'Virtual Events | ClubHub',
          },
          {
            path: 'meeting/:id',
            loadComponent: () => import('./ameni-ve/pages/meeting-room/meeting-room.component').then(m => m.MeetingRoomComponent),
            title: 'Réunion Jitsi | ClubHub',
          },
          {
            path: 'lobby/:roomId',
            loadComponent: () => import('./ameni-ve/pages/lobby/lobby.component').then(m => m.LobbyComponent),
            title: 'Lobby 3D | ClubHub',
          },
          {
            path: 'lobby',
            loadComponent: () => import('./ameni-ve/pages/lobby/lobby.component').then(m => m.LobbyComponent),
            title: 'Lobby 3D | ClubHub',
          },
          {
            path: 'virtual-room',
            loadComponent: () => import('./ameni-ve/pages/virtual-room/virtual-room.component').then(m => m.VirtualRoomComponent),
            title: 'Salle virtuelle 3D | ClubHub',
          },
          {
            path: 'recordings',
            loadComponent: () => import('./ameni-ve/pages/recordings/recordings.component').then(m => m.RecordingsComponent),
            title: 'Enregistrements virtuels | ClubHub',
          },
          {
            path: 'admin-dashboard',
            loadComponent: () => import('./ameni-ve/pages/admin-dashboard/admin-dashboard.component').then(m => m.VemAdminDashboardComponent),
            title: 'VEM Admin Dashboard | ClubHub',
          },
        ],
      },
      {
        path: 'rsvp',
        loadComponent: () => import('./pages/rsvp/rsvp.component').then(m => m.RsvpComponent),
        title: 'RSVP | ClubHub',
      },
      // -------- Voice2 (intégration additive isolée) --------
      {
        path: 'voice2',
        children: [
          {
            path: 'analytics',
            loadComponent: () =>
              import('./voice2/pages/analytics/analytics.component').then(
                (m) => m.Voice2AnalyticsComponent,
              ),
            title: 'Voice2 Analytics | ClubHub',
          },
          {
            path: 'management',
            loadComponent: () =>
              import('./voice2/pages/management/management.component').then(
                (m) => m.Voice2ManagementComponent,
              ),
            title: 'Voice2 Management | ClubHub',
          },
          {
            path: 'instant-voice',
            loadComponent: () =>
              import('./voice2/pages/instant-voice/instant-voice.component').then(
                (m) => m.Voice2InstantVoiceComponent,
              ),
            title: 'Voice2 Instant Voice | ClubHub',
          },
          {
            path: 'audio-reports',
            canActivate: [voice2BureauGuard],
            loadComponent: () =>
              import('./voice2/pages/audio-reports/audio-reports.component').then(
                (m) => m.Voice2AudioReportsComponent,
              ),
            title: 'Voice2 Audio Reports | ClubHub',
          },
          {
            path: 'my-reports',
            canActivate: [voice2MyReportsGuard],
            loadComponent: () =>
              import('./voice2/pages/my-reports/my-reports.component').then(
                (m) => m.Voice2MyReportsComponent,
              ),
            title: 'Voice2 My Reports | ClubHub',
          },
        ],
      },
      {
        path: 'addTask',
        loadComponent: () => import('./pages/tasks/event-tasks/event-tasks/event-tasks.component').then(m => m.EventTasksComponent),
        title: 'Assign Tasks | ClubHub',
      },
      {
        path: 'tasks',
        loadComponent: () => import('./pages/tasks/my-tasks/my-tasks/my-tasks.component').then(m => m.MyTasksComponent),
        title: 'My Tasks | ClubHub',
      },

      { path: 'borrowed-items', component: AllBorrowedComponent, title: 'Borrowed Items | ClubHub' },
      { path: 'lenders',        component: LendersComponent,     title: 'Lenders | ClubHub' },

      // -------- Clubs --------
      {
        path: 'clubs',
        children: [
          { path: '',         component: ClubListComponent,   title: 'Tous les clubs' },
          { path: 'create',   component: ClubFormComponent,   canActivate: [ceoGuard],       title: 'Créer un club' },
          { path: ':id',      component: ClubDetailComponent, title: 'Détail club' },
          { path: ':id/edit', component: ClubFormComponent,   canActivate: [clubSettingsGuard], title: 'Modifier le club' },
        ],
      },

      // -------- Élections --------
      // CRUD reserve au bureau (PRESIDENT/RH/SecGen via ceoGuard).
      // La liste + detail restent visibles a tous (vote / consultation).
      {
        path: 'elections',
        children: [
          { path: '',         component: ElectionListComponent,                                   title: 'Élections' },
          { path: 'create',   component: ElectionFormComponent,   canActivate: [ceoGuard],       title: 'Créer une élection' },
          { path: ':id',      component: ElectionDetailComponent,                                 title: 'Détail élection' },
          { path: ':id/edit', component: ElectionFormComponent,   canActivate: [ceoGuard],       title: 'Modifier l\'élection' },
        ],
      },

      // -------- Membres --------
      { path: 'users',   component: UserListComponent, canActivate: [ceoGuard], title: 'Membres' },
      { path: 'members', redirectTo: 'users', pathMatch: 'full' },

      // -------- Rôles (PRESIDENT seulement) --------
      { path: 'roles', component: RoleManagementComponent, canActivate: [roleManagementGuard], title: 'Gestion des rôles' },

      // -------- Procès-Verbaux (SECRETAIRE_GENERALE seulement) --------
      {
        path: 'pv',
        canActivate: [secretaryGuard],
        loadComponent: () => import('./pages/pv/pv-page.component').then(m => m.PvPageComponent),
        title: 'Procès-Verbaux | ClubHub',
      },

      // -------- Trésorerie (module Treasury — Rick) --------
      {
        path: 'treasury',
        loadChildren: () => import('./treasury/treasury.routes').then(m => m.TREASURY_ROUTES),
        title: 'Trésorerie | ClubHub',
      },

      // -------- Boutique (module Clubstore — store-service:8087) --------
      // Page legacy single-page (kept for backward compat)
      {
        path: 'boutique',
        loadComponent: () => import('./clubstore/clubstore.component').then(m => m.ClubstoreComponent),
        title: 'Boutique | ClubHub',
      },
      // Nouvelle architecture : pages dédiées (intégration depuis groupe/clubstore-final)
      {
        path: 'products',
        loadComponent: () => import('./clubstore/products/products.component').then(m => m.ProductsComponent),
        title: 'Produits | ClubHub',
      },
      {
        path: 'products/:id',
        loadComponent: () => import('./clubstore/product-detail/product-detail.component').then(m => m.ProductDetailComponent),
        title: 'Détail produit | ClubHub',
      },
      {
        path: 'tickets',
        loadComponent: () => import('./clubstore/tickets/tickets.component').then(m => m.TicketsComponent),
        title: 'Billets et Événements | ClubHub',
      },
      {
        path: 'cart',
        loadComponent: () => import('./clubstore/cart/cart.component').then(m => m.CartComponent),
        title: 'Mon Panier | ClubHub',
      },
      {
        path: 'orders',
        loadComponent: () => import('./clubstore/orders/orders.component').then(m => m.OrdersComponent),
        title: 'Mes Commandes | ClubHub',
      },
      {
        path: 'store-admin',
        canActivate: [storeAdminGuard],
        loadComponent: () => import('./clubstore/admin/admin.component').then(m => m.StoreAdminComponent),
        title: 'Administration Boutique | ClubHub',
      },

      // -------- Messages (messaging-service:8089 — chat + games trivia + themes) --------
      // Visible à TOUS les utilisateurs connectés (front-office).
      // Nouvelle implémentation (branche messaging-service) : conversation-list + chat-window + games + emoji-mart.
      {
        path: 'messaging',
        loadComponent: () => import('./messaging-components/conversation-list.component/conversation-list.component').then(m => m.ConversationListComponent),
        title: 'Messages | ClubHub',
      },
    ],
  },

  // -------- Routes QR / Vote / Invitation (Souha) — publiques, sans sidebar --------
  // Ces routes doivent être AVANT le wildcard et HORS du AppLayout
  { path: 'setup-password', component: SetupPasswordComponent, title: 'Créer votre mot de passe | ClubHub' },
  { path: 'elections/scan/success', component: ScanSuccessComponent,      title: 'Validation Réussie | ClubHub' },
  { path: 'elections/scan/:token',  component: QrValidationComponent,     canActivate: [authGuard], title: 'Validation QR Code | ClubHub' },
  { path: 'elections/:id/vote',     component: VoteWithTokenComponent,    canActivate: [authGuard], title: 'Voter | ClubHub' },
  { path: 'scan-instructions',      component: QrScanInstructionsComponent, title: 'Instructions Scan QR | ClubHub' },

  // 404 — wildcard MUST be last
  { path: '**', redirectTo: '' },
];
