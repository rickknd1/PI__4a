import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../shared/services/auth.service';
import { CommitteeResponsableService } from '../shared/services/committee-responsable.service';

/**
 * Bloque l'accès si l'utilisateur n'est pas connecté.
 * Redirige vers /signin.
 */
export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isLoggedIn()) {
    return true;
  }

  router.navigate(['/signin']);
  return false;
};

/**
 * Empêche un utilisateur déjà connecté d'accéder aux pages signin / signup.
 * - Si l'utilisateur a un club  → redirige vers /clubs/:id
 * - Sinon (signup ou signin sans club) → redirige vers /setup-club pour créer le club
 */
export const guestGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isLoggedIn()) {
    const clubId = authService.getCurrentClubId();
    if (clubId) {
      router.navigate(['/clubs', clubId]);
    } else {
      router.navigate(['/setup-club']);
    }
    return false;
  }
  return true;
};

/**
 * Redirection pour la racine /.
 * - Pas connecté → /signin
 * - Connecté (tout rôle) → /home (Front-office commun)
 *
 * Le /home affiche un bouton "Mon back-office" pour les rôles privilégiés
 * et un bouton "Créer mon club" optionnel pour PRESIDENT/CEO sans club.
 */
export const homeGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isLoggedIn()) {
    router.navigate(['/signin']);
    return false;
  }

  router.navigate(['/home']);
  return false;
};

/** Réservé au PRESIDENT / RH / SECRETAIRE_GENERALE. */
export const ceoGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const role = authService.getCurrentRole();

  if (role === 'PRESIDENT' || role === 'RH' || role === 'SECRETAIRE_GENERALE') {
    return true;
  }

  router.navigate(['/']);
  return false;
};

/** Réservé aux rôles pouvant gérer les paramètres du club (Pres, VP, RH, Trésorier, Resp Events). */
export const clubSettingsGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const respService = inject(CommitteeResponsableService);
  const router = inject(Router);
  const role = authService.getCurrentRole();

  // On exclut explicitement le secrétaire (check en dur)
  const isSecretary = role === 'SECRETAIRE_GENERALE' || role === 'SECRETAIRE_GENERAL';
  const allowed = ['PRESIDENT', 'VICE_PRESIDENT', 'RH', 'TRESORIER'];

  if ((allowed.includes(role) || respService.isResponsable()) && !isSecretary) {
    return true;
  }

  router.navigate(['/']);
  return false;
};

/** Réservé aux rôles pouvant gérer les rôles (Pres, VP, RH). */
export const roleManagementGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const role = authService.getCurrentRole();

  const isSecretary = role === 'SECRETAIRE_GENERALE' || role === 'SECRETAIRE_GENERAL';
  const allowed = ['PRESIDENT', 'VICE_PRESIDENT', 'RH'];

  if (allowed.includes(role) && !isSecretary) {
    return true;
  }

  router.navigate(['/']);
  return false;
};

/** Réservé au PRESIDENT. */
export const presidentGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.getCurrentRole() === 'PRESIDENT') {
    return true;
  }

  router.navigate(['/']);
  return false;
};

/** Réservé au TRESORIER (approve / reject borrowed items). */
export const treasurerGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.getCurrentRole() === 'TRESORIER') {
    return true;
  }

  router.navigate(['/']);
  return false;
};

/** Réservé au SECRETAIRE_GENERALE (rédaction des PV des événements). */
export const secretaryGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.getCurrentRole() === 'SECRETAIRE_GENERALE') {
    return true;
  }

  router.navigate(['/']);
  return false;
};

/**
 * Voice2: accès réservé aux membres du bureau (tout rôle sauf MEMBRE_SIMPLE).
 */
export const voice2BureauGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const role = authService.getCurrentRole();

  if (role && role !== 'MEMBRE_SIMPLE') {
    return true;
  }

  router.navigate(['/voice2/my-reports']);
  return false;
};

/**
 * Voice2: accès réservé aux membres simples pour "My Reports".
 */
export const voice2MyReportsGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const role = (authService.getCurrentRole() ?? '').toUpperCase();

  if (role === 'MEMBRE_SIMPLE') {
    return true;
  }

  router.navigate(['/voice2/audio-reports']);
  return false;
};

/**
 * Boutique admin: réservé au bureau du club (Président, VP, Trésorier,
 * Secrétaire, Comité). Les membres simples sont redirigés vers /products
 * (catalogue front-office). Évite que n'importe quel client accède
 * à la création/suppression de produits.
 */
const STORE_ADMIN_ROLES = ['PRESIDENT', 'VICE_PRESIDENT', 'TRESORIER', 'SECRETAIRE_GENERALE', 'COMMITTEE_MEMBER', 'RH'];

export const storeAdminGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const role = (authService.getCurrentRole() ?? '').toUpperCase();

  if (STORE_ADMIN_ROLES.includes(role)) {
    return true;
  }

  router.navigate(['/products']);
  return false;
};
