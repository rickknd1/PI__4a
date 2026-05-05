import { CommonModule } from '@angular/common';
import { Component, ElementRef, QueryList, ViewChildren, ChangeDetectorRef, OnInit, OnDestroy } from '@angular/core';
import { SidebarService } from '../../services/sidebar.service';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { SafeHtmlPipe } from '../../pipe/safe-html.pipe';
import { SidebarWidgetComponent } from './app-sidebar-widget.component';
import { combineLatest, Subscription } from 'rxjs';
import { AuthService, CurrentUser } from '../../../shared/services/auth.service';
import { ClubService } from '../../services/club.service';
import { Club } from '../../../models/club.model';
import { MeetingPvService } from '../../services/meeting-pv.service';


type SubItem = {
  name: string;
  path: string;
  pro?: boolean;
  new?: boolean;
  /**
   * Optional group/section label for this sub-item. Sub-items sharing the
   * same `group` value will be visually clustered under a small uppercase
   * header inside the parent dropdown. Used by the unified "Gestion Trésorerie"
   * menu to keep the dashboard / opérations / rapports / IA sub-sections
   * legible without resorting to nested dropdowns.
   */
  group?: string;
};
/**
 * Sections logiques de la sidebar :
 *  - `front` : zone "Front-office", visible à tout utilisateur connecté
 *              (Accueil, Événements (lecture/RSVP), Mes cotisations, Profil).
 *  - `back`  : zone "Back-office", filtrée par rôle (Trésorerie complète,
 *              Administration, Gestion événements, PV, Voice, etc.).
 */
type SidebarSection = 'front' | 'back';
type NavItem = {
  name: string;
  icon: string;
  path?: string;
  new?: boolean;
  /** Optional numeric badge (rendered as a small pill on the right). */
  badge?: number;
  subItems?: SubItem[];
  /** Section d'appartenance dans la sidebar. */
  section?: SidebarSection;
};

/**
 * Permissions calculées à partir du rôle global + de l'appartenance aux comités.
 *
 * Matrice de référence :
 *   - Président             : tout (gestion club, membres, rôles, settings)
 *   - VP / RH / Sec. Gén.   : Roles + Notifications + Profile (membres = lecture
 *                              seule via la page club, gérés par le Président)
 *   - Trésorier             : UNIQUEMENT Event Needs (lecture des besoins +
 *                              Lenders + validation des devis + Mark Paid) +
 *                              Profile. Pas de Mon Club, pas de Members,
 *                              pas de Calendar/Events/Tasks.
 *   - Responsable Events    : Calendar + All events + Assign Tasks
 *                              + Event Needs (création/édition) + Lenders
 *   - Membre simple DU comité Events : Calendar + Manage Tasks
 *                              (PAS de RSVP — ils organisent, ils ne s'inscrivent pas)
 *   - Membre simple HORS comité  : RSVP uniquement
 */
type SidebarPermissions = {
  /** Affiche l'item "Mon Club" (vue de la fiche club). */
  canViewMyClub: boolean;
  canViewCalendar: boolean;          // calendrier des événements
  canManageEvents: boolean;          // CRUD events (page "All events")
  canRsvpEvents: boolean;            // page RSVP (s'inscrire à un événement)
  canAssignTasks: boolean;           // créer/distribuer des tâches
  canViewMyTasks: boolean;           // voir & màj ses tâches assignées
  /**
   * Voir la liste des besoins/matériel.
   *  - Responsable Events : oui (peut créer / éditer / supprimer)
   *  - Trésorier          : oui (lecture seule + Mark Paid + valider devis)
   */
  canViewBorrowedItems: boolean;
  canManageLenders: boolean;         // prêteurs
  canManageDevis: boolean;           // approuver/gérer les devis (Trésorier uniquement)
  /** Gestion des membres du club (ajout / édition / suppression). */
  canManageMembers: boolean;
  canManageRoles: boolean;
  canManageClubSettings: boolean;
  canViewNotifications: boolean;
  canViewVirtualEvents: boolean;
};

// Rôles globaux du "bureau exécutif" (cf. enum côté backend Role.java)
const BUREAU_ROLES = ['PRESIDENT', 'VICE_PRESIDENT', 'SECRETAIRE_GENERALE', 'TRESORIER', 'RH'];
const CLUB_SETTINGS_ROLES = ['PRESIDENT', 'VICE_PRESIDENT'];
const TREASURER_ROLES = ['TRESORIER', 'TREASURER'];

/**
 * Side-bar role check tolerant to DB inconsistencies.
 *
 * The backend stores `role` as a free-form String (no enum constraint),
 * which means historic data may contain `SECRETAIRE_GENERALE`,
 * `Secretaire_Generale`, `SECRETAIRE_GENERAL` (no trailing E),
 * `secrétaire générale` (with accents), etc. To make sure the PV section
 * appears for the right person regardless of how their account was
 * created, we normalise: uppercase, strip diacritics, collapse all
 * non-alphanumeric runs to a single `_`. Both spellings (with/without
 * final E) are accepted because both are grammatically valid in French.
 */
function isSecretaireGenerale(role: string | undefined | null): boolean {
  if (!role) return false;
  const norm = role
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
  return norm === 'SECRETAIRE_GENERALE' || norm === 'SECRETAIRE_GENERAL';
}

/**
 * Normalise la chaîne de rôle comme {@link isSecretaireGenerale}.
 * Utilisé pour comparer un rôle libre (DB / rôle custom) à une liste connue
 * sans se laisser piéger par la casse, les accents ou les séparateurs.
 */
function normaliseRole(role: string | undefined | null): string {
  if (!role) return '';
  return role
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

/**
 * Détermine si l'utilisateur doit être considéré comme « membre simple »
 * pour l'affichage de la sidebar.
 *
 * Le backend stocke `role` comme chaîne libre et, depuis l'introduction des
 * rôles personnalisés (CustomRole), un membre peut avoir une valeur comme
 * « Adhérent », « Membre actif », « member », « Membre_Simple », etc. Sans
 * cette tolérance, `role === 'MEMBRE_SIMPLE'` est faux et le menu RSVP
 * disparaît à tort pour tous ces utilisateurs.
 *
 * Règle métier : est « membre simple » toute personne qui n'occupe PAS un
 * siège connu du bureau exécutif (ni trésorier). Les rôles custom sont donc
 * assimilés à un membre simple pour la visibilité RSVP.
 */
function isSimpleMemberRole(role: string | undefined | null): boolean {
  const norm = normaliseRole(role);
  if (!norm) return false;
  const bureauNorm = new Set([
    'PRESIDENT',
    'VICE_PRESIDENT',
    'SECRETAIRE_GENERALE',
    'SECRETAIRE_GENERAL',
    'TRESORIER',
    'TREASURER',
    'RH',
  ]);
  if (bureauNorm.has(norm)) return false;
  return true;
}

@Component({
  selector: 'app-sidebar',
  imports: [
    CommonModule,
    RouterModule,
    SafeHtmlPipe,
    SidebarWidgetComponent
  ],
  templateUrl: './app-sidebar.component.html',
})
export class AppSidebarComponent implements OnInit, OnDestroy {

  currentUser: CurrentUser | null = null;
  currentClub: Club | null = null;

  // ==========================================================================
  //  ARCHITECTURE SIDEBAR
  //
  //  La sidebar est divisée en deux zones :
  //
  //   FRONT-OFFICE (commun à tous les membres connectés)
  //      ├─ Accueil                /dashboard
  //      ├─ Événements             /events  (lecture seule + RSVP simple member)
  //      ├─ Mes cotisations        /treasury/espace-membre
  //      └─ Mon profil             /profile
  //
  //   BACK-OFFICE (visible uniquement si l'utilisateur a au moins un item)
  //      ├─ [TRESORIER]   Trésorerie (suite complète : dashboard, cotisations,
  //      │                dépenses, budget, remboursements, rapports, audit,
  //      │                anomalies, prédictions, chatbot)
  //      ├─ [PRESIDENT]   Administration (Mon Club, Members, Gestion rôles)
  //      ├─ [Resp Events / PRESIDENT] Gestion événements (Calendar, Tasks,
  //      │                            Borrowed-items, Lenders, Quotes)
  //      ├─ [SECRETAIRE_GENERALE] Procès-Verbaux
  //      └─ [BUREAU]      Voice (analytics, audio reports)
  //
  //  Chaque NavItem porte une propriété `section: 'front' | 'back'` qui sera
  //  utilisée par updateNavItems() pour ventiler les items dans deux listes
  //  exposées au template : `frontOfficeNav` et `backOfficeNav`.
  // ==========================================================================
  private baseNavItems: NavItem[] = [
    // -------------------- FRONT-OFFICE --------------------
    {
      section: 'front',
      icon: `<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2 12.2039C2 9.91549 2 8.77128 2.5192 7.82274C3.0384 6.87421 3.98695 6.28551 5.88403 5.10813L7.88403 3.86687C9.88939 2.62229 10.8921 2 12 2C13.1079 2 14.1106 2.62229 16.116 3.86687L18.116 5.10812C20.0131 6.28551 20.9616 6.87421 21.4808 7.82274C22 8.77128 22 9.91549 22 12.2039V13.725C22 17.6258 22 19.5763 20.8284 20.7881C19.6569 22 17.7712 22 14 22H10C6.22876 22 4.34315 22 3.17157 20.7881C2 19.5763 2 17.6258 2 13.725V12.2039Z" stroke="currentColor" stroke-width="1.5"/><path d="M15 18H9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`,
      name: 'Accueil',
      path: '/home',
    },
    {
      section: 'front',
      icon: `<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M11 19.5H21M11 12H21M11 4.5H21M3 5.25C3 6.07843 3.67157 6.75 4.5 6.75C5.32843 6.75 6 6.07843 6 5.25C6 4.42157 5.32843 3.75 4.5 3.75C3.67157 3.75 3 4.42157 3 5.25ZM3 12C3 12.8284 3.67157 13.5 4.5 13.5C5.32843 13.5 6 12.8284 6 12C6 11.1716 5.32843 10.5 4.5 10.5C3.67157 10.5 3 11.1716 3 12ZM3 18.75C3 19.5784 3.67157 20.25 4.5 20.25C5.32843 20.25 6 19.5784 6 18.75C6 17.9216 5.32843 17.25 4.5 17.25C3.67157 17.25 3 17.9216 3 18.75Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
      name: 'Événements',
      path: '/events',
    },
    {
      // Trésorerie front-office : vue membre simple. Pointe vers la LISTE
      // des paiements (mes-paiements) — pas vers /treasury/espace-membre
      // qui est un dashboard sans tableau. L'utilisateur clique "Mes
      // cotisations" et veut voir le détail des PENDING/LATE/PAID, pas
      // un compteur agrégé.
      section: 'front',
      icon: `<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" stroke="currentColor" stroke-width="1.5"/><path d="M12.89 11.1c-1.78-.59-2.64-.96-2.64-1.9 0-1.02 1.11-1.39 1.81-1.39 1.31 0 1.79.99 1.9 1.34l1.58-.67C15.39 7.96 14.78 7 13 6.7V5h-2v1.71C8.84 7.05 8.21 8.62 8.21 9.3c0 1.95 1.86 2.5 2.77 2.83 1.31.47 1.89.89 1.89 1.69 0 .94-.86 1.34-1.62 1.34-1.49 0-1.91-1.53-1.96-1.71l-1.65.67c.63 2.18 2.27 2.77 3.07 2.94V19h2v-1.71c.43-.08 2.83-.55 2.83-3.05 0-1.32-.57-2.49-2.65-3.14z" fill="currentColor"/></svg>`,
      name: 'Mes cotisations',
      path: '/treasury/mes-paiements',
    },
    {
      // ----------------------------------------------------------------------
      // Canaux vocaux (FRONT-OFFICE) — visible pour TOUS les utilisateurs
      // connectes (membre simple + bureau). Ce n'est pas un outil admin :
      // c'est un canal de communication temps reel partage avec le club.
      // Le composant Voice2InstantVoiceComponent gere les permissions
      // internes (creation/kick = bureau, rejoindre/parler = tout le monde).
      // ----------------------------------------------------------------------
      section: 'front',
      icon: `<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 4a3 3 0 0 0-3 3v4a3 3 0 0 0 6 0V7a3 3 0 0 0-3-3z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 10v1a7 7 0 0 0 14 0v-1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M12 18v3M9 21h6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`,
      name: 'Canaux vocaux',
      path: '/voice2/instant-voice',
    },
    {
      // ----------------------------------------------------------------------
      // Boutique (FRONT-OFFICE) - merchandising du club via store-service.
      // Ouvert a tous les membres connectes : ils peuvent acheter t-shirts,
      // tickets evenements, certificats, etc. Le gateway route /api/products
      // /api/orders /api/cart vers store-service (port 8087).
      // ----------------------------------------------------------------------
      section: 'front',
      icon: `<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 9h18l-1.5 11.25a1.5 1.5 0 0 1-1.5 1.25H6a1.5 1.5 0 0 1-1.5-1.25L3 9z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M8 9V6a4 4 0 0 1 8 0v3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`,
      name: 'Boutique',
      path: '/boutique',
    },
    {
      // ----------------------------------------------------------------------
      // Événements virtuels (FRONT-OFFICE) — VEM (visioconférence Jitsi +
      // lobby 3D Three.js). Tout membre connecté peut consulter la liste,
      // s'inscrire, payer et accéder à la salle. Les actions admin
      // (créer/éditer/supprimer un VE) sont gardées par canAccess() au
      // niveau du composant Events lui-même, pas à l'entrée du menu.
      // ----------------------------------------------------------------------
      section: 'front',
      icon: `<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M15 10L19.5528 7.72361C20.2177 7.39116 21 7.87465 21 8.61803V15.382C21 16.1253 20.2177 16.6088 19.5528 16.2764L15 14M7 18H11C12.1046 18 13 17.1046 13 16V8C13 6.89543 12.1046 6 11 6H7C5.89543 6 5 6.89543 5 8V16C5 17.1046 5.89543 18 7 18Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
      name: 'Événements virtuels',
      path: '/ameni/events',
    },
    {
      // ----------------------------------------------------------------------
      // RSVP (FRONT-OFFICE) — page d'inscription aux événements physiques
      // pour TOUS les utilisateurs connectés. Affiche les événements
      // disponibles + le QR code de l'utilisateur pour les events rejoints
      // (à présenter à l'entrée). Distinct de "Événements" (catalogue) :
      // ici on ne fait que s'inscrire / annuler / récupérer son QR.
      // ----------------------------------------------------------------------
      section: 'front',
      icon: `<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" stroke-width="1.5"/><rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" stroke-width="1.5"/><rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" stroke-width="1.5"/><path d="M14 14h3v3h-3zM18 14h3v3h-3zM14 18h3v3h-3zM18 18h3v3h-3z" fill="currentColor"/></svg>`,
      name: 'Mes RSVP',
      path: '/rsvp',
    },
    {
      // ----------------------------------------------------------------------
      // Messages (FRONT-OFFICE) - chat texte + jeux trivia IA via
      // messaging-service (port 8089). Ouvert a tous les membres connectes :
      // ils peuvent demarrer une conversation 1:1, creer un groupe, lancer
      // un jeu trivia genere par IA Groq, reagir aux messages avec emoji,
      // partager des images. WebSocket STOMP pour le temps reel.
      // ----------------------------------------------------------------------
      section: 'front',
      icon: `<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>`,
      name: 'Messages',
      path: '/messaging',
    },
    {
      section: 'front',
      icon: `<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 12C14.7614 12 17 9.76142 17 7C17 4.23858 14.7614 2 12 2C9.23858 2 7 4.23858 7 7C7 9.76142 9.23858 12 12 12Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M20.5899 22C20.5899 18.13 16.7399 15 11.9999 15C7.25991 15 3.40991 18.13 3.40991 22" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
      name: 'Mon profil',
      path: '/profile',
    },

    // -------------------- BACK-OFFICE --------------------
    // Administration (PRESIDENT) — Mon Club est injecté dynamiquement dans
    // updateNavItems() (besoin du clubId/clubName), placé en tête du back.
    // NB: l'ancien "Dashboard global" pointait sur /dashboard (template
    // ecommerce mocke non adapte a ClubHub). Retire de la sidebar — le
    // PRESIDENT a deja sa Home (/home) en front-office qui agit comme
    // dashboard avec les vraies donnees du club.
    {
      section: 'back',
      icon: `<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8 2V5M16 2V5M3.5 9.09H20.5M21 8.5V17C21 20 19.5 22 16 22H8C4.5 22 3 20 3 17V8.5C3 5.5 4.5 3.5 8 3.5H16C19.5 3.5 21 5.5 21 8.5Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M15.6947 13.7H15.7037M15.6947 16.7H15.7037M11.9955 13.7H12.0045M11.9955 16.7H12.0045M8.29431 13.7H8.30329M8.29431 16.7H8.30329" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
      name: 'Calendar',
      path: '/calendar',
    },
    // Virtual events placeholder removed from back-office — déplacé en
    // front-office (visible à tous les utilisateurs connectés). Voir item
    // "Événements virtuels" dans la section front en haut du baseNavItems.
    {
      section: 'back',
      icon: `<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M15.7 11.2C15.7 13.133 14.133 14.7 12.2 14.7C10.267 14.7 8.7 13.133 8.7 11.2V6.5C8.7 4.567 10.267 3 12.2 3C14.133 3 15.7 4.567 15.7 6.5V11.2Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M5.5 10.5V11.2C5.5 14.9 8.5 17.9 12.2 17.9C15.9 17.9 18.9 14.9 18.9 11.2V10.5M12.2 17.9V21M8.5 21H15.9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
      name: 'Transcriptions',
      path: '/ameni/recordings',
    },
    {
      section: 'back',
      icon: `<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 4a3 3 0 00-3 3v4a3 3 0 006 0V7a3 3 0 00-3-3z" stroke="currentColor" stroke-width="1.5"/><path d="M5 10v1a7 7 0 0014 0v-1M12 18v3M9 21h6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`,
      name: 'Instant Voice',
      subItems: [
        { name: 'Voice channels', path: '/voice2/instant-voice' },
        { name: 'Audio reports', path: '/voice2/audio-reports' },
        { name: 'My reports', path: '/voice2/my-reports' },
      ],
    },
    {
      section: 'back',
      icon: `<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M11 19.5H21M11 12H21M11 4.5H21M3 5.25C3 6.07843 3.67157 6.75 4.5 6.75C5.32843 6.75 6 6.07843 6 5.25C6 4.42157 5.32843 3.75 4.5 3.75C3.67157 3.75 3 4.42157 3 5.25ZM3 12C3 12.8284 3.67157 13.5 4.5 13.5C5.32843 13.5 6 12.8284 6 12C6 11.1716 5.32843 10.5 4.5 10.5C3.67157 10.5 3 11.1716 3 12ZM3 18.75C3 19.5784 3.67157 20.25 4.5 20.25C5.32843 20.25 6 19.5784 6 18.75C6 17.9216 5.32843 17.25 4.5 17.25C3.67157 17.25 3 17.9216 3 18.75Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
      name: 'All events',
      path: '/events',
    },
    {
      section: 'back',
      icon: `<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12.37 8.88H17.62M6.38 8.88L7.13 9.63L9.38 7.38M12.37 15.88H17.62M6.38 15.88L7.13 16.63L9.38 14.38" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M9 22H15C20 22 22 20 22 15V9C22 4 20 2 15 2H9C4 2 2 4 2 9V15C2 20 4 22 9 22Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
      name: 'RSVP',
      path: '/rsvp',
    },
    {
      section: 'back',
      icon: `<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M10.4858 3.5L13.5182 3.5C13.9233 3.5 14.2518 3.82851 14.2518 4.23377C14.2518 5.9529 16.1129 7.02795 17.602 6.1682C17.9528 5.96567 18.4014 6.08586 18.6039 6.43667L20.1203 9.0631C20.3229 9.41407 20.2027 9.86286 19.8517 10.0655C18.3625 10.9253 18.3625 13.0747 19.8517 13.9345C20.2026 14.1372 20.3229 14.5859 20.1203 14.9369L18.6039 17.5634C18.4013 17.9142 17.9528 18.0344 17.602 17.8318C16.1129 16.9721 14.2518 18.0471 14.2518 19.7663C14.2518 20.1715 13.9233 20.5 13.5182 20.5H10.4858C10.0804 20.5 9.75182 20.1714 9.75182 19.766C9.75182 18.0461 7.88983 16.9717 6.40067 17.8314C6.04945 18.0342 5.60037 17.9139 5.39767 17.5628L3.88167 14.937C3.67903 14.586 3.79928 14.1372 4.15026 13.9346C5.63949 13.0748 5.63946 10.9253 4.15025 10.0655C3.79926 9.86282 3.67901 9.41401 3.88165 9.06303L5.39764 6.43725C5.60034 6.08617 6.04943 5.96581 6.40065 6.16858C7.88982 7.02836 9.75182 5.9539 9.75182 4.23399C9.75182 3.82862 10.0804 3.5 10.4858 3.5ZM13.5182 2L10.4858 2C9.25201 2 8.25182 3.00019 8.25182 4.23399C8.25182 4.79884 7.64013 5.15215 7.15065 4.86955C6.08213 4.25263 4.71559 4.61859 4.0986 5.68725L2.58261 8.31303C1.96575 9.38146 2.33183 10.7477 3.40025 11.3645C3.88948 11.647 3.88947 12.3531 3.40026 12.6355C2.33184 13.2524 1.96578 14.6186 2.58263 15.687L4.09863 18.3128C4.71562 19.3814 6.08215 19.7474 7.15067 19.1305C7.64015 18.8479 8.25182 19.2012 8.25182 19.766C8.25182 20.9998 9.25201 22 10.4858 22H13.5182C14.7519 22 15.7518 20.9998 15.7518 19.7663C15.7518 19.2015 16.3632 18.8487 16.852 19.1309C17.9202 19.7476 19.2862 19.3816 19.9029 18.3134L21.4193 15.6869C22.0361 14.6185 21.6701 13.2523 20.6017 12.6355C20.1125 12.3531 20.1125 11.647 20.6017 11.3645C21.6701 10.7477 22.0362 9.38152 21.4193 8.3131L19.903 5.68667C19.2862 4.61842 17.9202 4.25241 16.852 4.86917C16.3632 5.15138 15.7518 4.79856 15.7518 4.23377C15.7518 3.00024 14.7519 2 13.5182 2ZM9.6659 11.9999C9.6659 10.7103 10.7113 9.66493 12.0009 9.66493C13.2905 9.66493 14.3359 10.7103 14.3359 11.9999C14.3359 13.2895 13.2905 14.3349 12.0009 14.3349C10.7113 14.3349 9.6659 13.2895 9.6659 11.9999ZM12.0009 8.16493C9.88289 8.16493 8.1659 9.88191 8.1659 11.9999C8.1659 14.1179 9.88289 15.8349 12.0009 15.8349C14.1189 15.8349 15.8359 14.1179 15.8359 11.9999C15.8359 9.88191 14.1189 8.16493 12.0009 8.16493Z" fill="currentColor"></path></svg>`,
      name: "Gestion des Rôles",
      path: "/roles",
    },
    {
      section: 'back',
      icon: `<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M18 7.16C17.94 7.15 17.87 7.15 17.81 7.16C16.43 7.11 15.33 5.98 15.33 4.58C15.33 3.15 16.48 2 17.91 2C19.34 2 20.49 3.16 20.49 4.58C20.48 5.98 19.38 7.11 18 7.16Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M16.97 14.44C18.34 14.67 19.85 14.43 20.91 13.72C22.32 12.78 22.32 11.24 20.91 10.3C19.84 9.59 18.31 9.35 16.94 9.59" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M5.97 7.16C6.03 7.15 6.1 7.15 6.16 7.16C7.54 7.11 8.64 5.98 8.64 4.58C8.64 3.15 7.49 2 6.06 2C4.63 2 3.48 3.16 3.48 4.58C3.49 5.98 4.59 7.11 5.97 7.16Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M7 14.44C5.63 14.67 4.12 14.43 3.06 13.72C1.65 12.78 1.65 11.24 3.06 10.3C4.13 9.59 5.66 9.35 7.03 9.59" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 14.63C11.94 14.62 11.87 14.62 11.81 14.63C10.43 14.58 9.33 13.45 9.33 12.05C9.33 10.62 10.48 9.47 11.91 9.47C13.34 9.47 14.49 10.63 14.49 12.05C14.48 13.45 13.38 14.59 12 14.63Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M9.09 17.78C7.68 18.72 7.68 20.26 9.09 21.2C10.69 22.27 13.31 22.27 14.91 21.2C16.32 20.26 16.32 18.72 14.91 17.78C13.32 16.72 10.69 16.72 9.09 17.78Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
      name: 'Members',
      subItems: [
        { name: 'Member list',  path: '/members' },
      ],
    },
    {
      section: 'back',
      icon: `<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12.37 8.88H17.62M6.38 8.88L7.13 9.63L9.38 7.38M12.37 15.88H17.62M6.38 15.88L7.13 16.63L9.38 14.38" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M9 22H15C20 22 22 20 22 15V9C22 4 20 2 15 2H9C4 2 2 4 2 9V15C2 20 4 22 9 22Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
      name: 'Tasks',
      subItems: [
        { name: 'Assign tasks', path: '/addTask' },
        { name: 'Manage tasks', path: '/tasks' },
      ],
    },
    {
      section: 'back',
      icon: `<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 3v4a1 1 0 0 0 1 1h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M9 13h6M9 17h6M9 9h2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`,
      name: 'Procès-Verbaux',
      path: '/pv',
    },
    {
      section: 'back',
      icon: `<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 10H21M7 15H11M7 18H11M6.2 21H17.8C18.9201 21 19.4802 21 19.908 20.782C20.2843 20.5903 20.5903 20.2843 20.782 19.908C21 19.4802 21 18.9201 21 17.8V8.2C21 7.07989 21 6.51984 20.782 6.09202C20.5903 5.7157 20.2843 5.40974 19.908 5.21799C19.4802 5 18.9201 5 17.8 5H6.2C5.0799 5 4.51984 5 4.09202 5.21799C3.7157 5.40974 3.40974 5.7157 3.21799 6.09202C3 6.51984 3 7.0799 3 8.2V17.8C3 18.9201 3 19.4802 3.21799 19.908C3.40974 20.2843 3.7157 20.5903 4.09202 20.782C4.51984 21 5.07989 21 6.2 21Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M8 5V3M16 5V3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M12 14C13.1046 14 14 13.1046 14 12C14 10.8954 13.1046 10 12 10C10.8954 10 10 10.8954 10 12C10 13.1046 10.8954 14 12 14Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`,
      name: 'Event Needs',
      subItems: [
        { name: 'All needs', path: '/borrowed-items' },
        { name: 'Lenders', path: '/lenders' },
        { name: 'Quotes (Devis)', path: '/borrowed-items' },
      ],
    },
    // ------------------------------------------------------------------
    // Trésorerie BACK-OFFICE — restructurée en 3 GROUPES LOGIQUES + 1 lien
    // direct vers le tableau de bord, pour reproduire l'organisation du
    // module Treasury original (Gestion / Rapports / IA & Alertes) au lieu
    // d'une liste plate de 10+ sous-items qui s'ouvrait d'un coup.
    //
    //   1. "Tableau de bord Trésorerie"  → lien direct  /treasury
    //   2. "Trésorerie - Gestion"        → 4 sub-items  (cotisations, dépenses, budget, remboursements)
    //   3. "Trésorerie - Rapports"       → 2 sub-items  (rapports, audit)
    //   4. "Trésorerie - IA & Alertes"   → 3 sub-items  (anomalies, prédictions, chatbot)
    //
    // Filtrage RBAC : voir filterItem() — chaque item est filtré par un case
    // dédié pour Trésorier/Président.
    // ------------------------------------------------------------------
    {
      // GESTION TRÉSORERIE : un seul groupe unifié contenant TOUS les écrans
      // trésorerie (dashboard, gestion, rapports, IA & alertes). Les rôles
      // continuent d'être appliqués au niveau des sous-items via filterItem.
      section: 'back',
      icon: `<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 7h18v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M3 7l3-4h12l3 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M16 12h3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="17" cy="14" r="1.2" fill="currentColor"/></svg>`,
      name: 'Gestion Trésorerie',
      subItems: [
        // ── Vue d'ensemble ─────────────────────────────────────
        { group: 'Vue d’ensemble',
          name: 'Tableau de bord',     path: '/treasury' },
        // ── Opérations financières (TRESORIER) ─────────────────
        { group: 'Opérations',
          name: 'Cotisations',         path: '/treasury/cotisations' },
        { group: 'Opérations',
          name: 'Dépenses',            path: '/treasury/depenses' },
        { group: 'Opérations',
          name: 'Budget',              path: '/treasury/budget' },
        { group: 'Opérations',
          name: 'Remboursements',      path: '/treasury/remboursements' },
        // ── Rapports & traçabilité (TRESORIER + PRESIDENT) ─────
        { group: 'Rapports',
          name: 'Rapports & Bilans',   path: '/treasury/rapports' },
        { group: 'Rapports',
          name: 'Audit',               path: '/treasury/audit' },
        // ── IA & Alertes (TRESORIER + PRESIDENT) ───────────────
        { group: 'IA & Alertes',
          name: 'Anomalies',           path: '/treasury/anomalies' },
        { group: 'IA & Alertes',
          name: 'Prédictions',         path: '/treasury/predictions' },
        { group: 'IA & Alertes',
          name: 'Chatbot IA',          path: '/treasury/chatbot' },
      ],
    },
  ];

  // Others nav items
  // NB : "My Profile" a été déplacé vers le FRONT-OFFICE ("Mon profil") pour
  // éviter la duplication. La section "Others" du template ne s'affiche
  // désormais que si elle reçoit des items injectés dynamiquement (ex.
  // "Club Settings" gardé pour compat futur).
  othersItems: NavItem[] = [];

  openSubmenu: string | null | number = null;
  subMenuHeights: { [key: string]: number } = {};
  @ViewChildren('subMenu') subMenuRefs!: QueryList<ElementRef>;

  readonly isExpanded$;
  readonly isMobileOpen$;
  readonly isHovered$;

  private subscription: Subscription = new Subscription();

  /** Number of completed events still missing a PV (for the sidebar badge). */
  pendingPvCount = 0;

  constructor(
    public sidebarService: SidebarService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private authService: AuthService,
    private clubService: ClubService,
    private pvService: MeetingPvService
  ) {
    this.isExpanded$ = this.sidebarService.isExpanded$;
    this.isMobileOpen$ = this.sidebarService.isMobileOpen$;
    this.isHovered$ = this.sidebarService.isHovered$;
  }

  ngOnInit() {
    this.currentUser = this.authService.getCurrentUser();
    this.updateNavItems();

    // Diagnostic: helps spot DB role-string typos (the backend stores `role`
    // as free-form text, so a SECRETAIRE_GENERALE account could have ended up
    // with "Secretaire_Generale" or even "SECRETAIRE_GENERAL" without the E).
    // If the PV button isn't showing for someone you think is the secretary,
    // check this log in DevTools to see the raw role string.
    console.debug('[Sidebar] currentUser.role =', JSON.stringify(this.currentUser?.role));
    // Extra RSVP diagnostic: when RSVP is missing for a simple member, the
    // most common causes are (1) the role string doesn't match anything the
    // app recognises, or (2) the user is listed as "responsable" of an
    // Events committee. Log the decisive values so they can be inspected in
    // the DevTools console without having to add breakpoints.
    const rsvpRole = this.currentUser?.role ?? '';
    console.debug(
      '[Sidebar] RSVP diagnostic →',
      'role=', JSON.stringify(rsvpRole),
      'isSimpleMember=', isSimpleMemberRole(rsvpRole),
      'clubLoaded=', !!this.currentClub,
    );

    if (this.currentUser?.clubId) {
      this.subscription.add(
        this.clubService.getClubById(this.currentUser.clubId).subscribe({
          next: (club) => {
            this.currentClub = club;
            this.updateNavItems();
            this.cdr.detectChanges();
          },
          error: (err) => console.error('Erreur chargement club:', err)
        })
      );
    }

    this.subscription.add(
      this.router.events.subscribe(event => {
        if (event instanceof NavigationEnd) {
          this.setActiveMenuFromRoute(this.router.url);
        }
      })
    );

    this.subscription.add(
      combineLatest([this.isExpanded$, this.isMobileOpen$, this.isHovered$]).subscribe(
        ([isExpanded, isMobileOpen, isHovered]) => {
          if (!isExpanded && !isMobileOpen && !isHovered) {
            this.cdr.detectChanges();
          }
        }
      )
    );

    this.setActiveMenuFromRoute(this.router.url);

    // Only the SECRETAIRE_GENERALE sees the PV item, so only she needs the
    // pending-events badge. Avoid spamming the backend for everyone else.
    if (isSecretaireGenerale(this.currentUser?.role)) {
      this.subscription.add(
        this.pvService.getPending().subscribe({
          next: list => { this.pendingPvCount = list.length; this.cdr.detectChanges(); },
          error: () => this.pendingPvCount = 0
        })
      );
    }
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }

  // ============================================================================
  //  RBAC : calcul des permissions du sidebar
  // ============================================================================

  /**
   * Permissions effectives de l'utilisateur courant.
   * Combinaison du rôle global et de l'appartenance aux comités du club
   * (en particulier le comité "Events" qui pilote events/tasks/borrowed/lenders).
   */
  private get permissions(): SidebarPermissions {
    const role = this.currentUser?.role ?? '';
    const userId = this.currentUser?.userId ?? this.currentUser?.id ?? '';

    const isBureau = BUREAU_ROLES.includes(role);
    const isPresOrVP = CLUB_SETTINGS_ROLES.includes(role);
    const isTreasurer = TREASURER_ROLES.includes(role);
    const isRH = role === 'RH';
    const isSecretaireGenerale = role === 'SECRETAIRE_GENERALE';
    const isSimpleMember = isSimpleMemberRole(role);

    const subGroups = this.currentClub?.subGroups ?? [];
    const matchesAny = (name: string, keywords: string[]) => {
      const n = (name ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      return keywords.some(k => n.includes(k));
    };

    // Comité "Events" (pilote events + tasks + borrowed items + lenders + QR)
    const eventCommittees = subGroups.filter(sg => matchesAny(sg.name, ['event', 'evenement']));

    const isRespEvents = eventCommittees.some(sg =>
      sg.responsableId === userId || sg.memberRoles?.[userId] === 'RESPONSABLE'
    );
    const isMemberOfEventCommittee = eventCommittees.some(sg =>
      sg.memberIds?.includes(userId) ||
      sg.memberRoles?.[userId] === 'MEMBRE_COMITE' ||
      sg.responsableId === userId
    );

    const isPresident = role === 'PRESIDENT';

    return {
      // General visibility
      canViewMyClub:          isBureau || isRespEvents,
      canViewCalendar:        isRespEvents || isPresident || isRH,

      // All events (page CRUD admin) : responsable Events et President seulement
      canManageEvents:        isRespEvents || isPresident,

      // Assign Tasks (créer/distribuer) : responsable Events et President seulement
      canAssignTasks:         isRespEvents || isPresident,

      // RSVP : tout membre non-bureau peut s'inscrire à un événement.
      canRsvpEvents:          isSimpleMember && !isRespEvents,

      // Virtual Events : visible par les membres (pour s'inscrire/participer) 
      // et par le responsable/president.
      canViewVirtualEvents:   isSimpleMember || isRespEvents || isPresident || isRH,

      // Manage Tasks (voir / màj mes tâches) : STRICTEMENT les MEMBRE_SIMPLE
      // appartenant au comité Events (PAS le responsable).
      canViewMyTasks:         isSimpleMember && isMemberOfEventCommittee && !isRespEvents,

      // All needs + Lenders : responsable Events (édition complète)
      // OU Trésorier (lecture + validation devis + mark paid).
      canViewBorrowedItems:   isRespEvents || isTreasurer,
      canManageLenders:       isRespEvents || isTreasurer,

      // Devis (quotes) : Trésorier uniquement
      canManageDevis:         isTreasurer,

      // ✦ Gestion des membres : President, Secrétaire Générale, RH
      canManageMembers:       isPresident || isSecretaireGenerale || isRH,
      canManageRoles:         isPresident || isRH,

      // Notifications : tout le monde sauf le Trésorier (UI réduite).
      canViewNotifications:   !isTreasurer,

      // Settings (removed from sidebar but required by interface)
      canManageClubSettings:  false,
    };
  }

  /**
   * Construit dynamiquement le sidebar en deux zones distinctes :
   *
   *  - frontOfficeNav : commun à tous les utilisateurs connectés
   *                     (Accueil, Événements, Mes cotisations, Mon profil).
   *                     Le filtrage `filterItem` ne s'applique pas (ces items
   *                     sont vus par tout le monde) — ils sont passés tels
   *                     quels après une éventuelle adaptation (ex. RSVP n'est
   *                     pas dans le front-office, c'est `/events` qui sert
   *                     d'entrée commune).
   *
   *  - backOfficeNav  : items conditionnels par rôle (Trésorerie, Members,
   *                     Roles, PV, Tasks, Calendar, Voice…). Filtrage RBAC
   *                     complet via `filterItem`. Le bloc "BACK-OFFICE" du
   *                     template s'affiche uniquement si la liste résultante
   *                     n'est pas vide.
   */
  // Les listes calculées pour l'affichage
  public frontOfficeNav: NavItem[] = [];
  public backOfficeNav: NavItem[] = [];
  /**
   * @deprecated Conservé pour compatibilité avec d'éventuelles références
   * externes ; représente la concaténation front + back.
   */
  public navItems: NavItem[] = [];
  public visibleOthersItems: NavItem[] = [];

  /**
   * Met à jour les items affichés en fonction des permissions actuelles.
   * Sépare clairement Front-office (zone commune) et Back-office (filtré).
   */
  private updateNavItems(): void {
    const clubId = this.currentUser?.clubId;
    const clubName = this.currentClub?.name ?? 'Mon Club';
    const p = this.permissions;

    // ---------------------------------------------------------------
    //  FRONT-OFFICE : items toujours visibles (tout user connecté)
    // ---------------------------------------------------------------
    // On prend les items marqués `section: 'front'` tels quels, sans filtrage
    // RBAC — ils représentent la zone publique de l'application.
    const front: NavItem[] = this.baseNavItems
      .filter(it => it.section === 'front')
      .map(it => ({ ...it }));

    // ---------------------------------------------------------------
    //  BACK-OFFICE : items conditionnels selon le rôle
    // ---------------------------------------------------------------
    // "Mon Club" est dynamique (clubId/clubName), on l'injecte en tête du
    // back-office quand l'utilisateur a le droit de le voir.
    const monClubItem: NavItem = {
      section: 'back',
      icon: `<svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M21 21H3M19 21V7C19 5.89543 18.1046 5 17 5H7C5.89543 5 5 5.89543 5 7V21M9 21V17C9 15.8954 9.89543 15 11 15H13C14.1046 15 15 15.8954 15 17V21M17 5V4C17 2.89543 16.1046 2 15 2H9C7.89543 2 7 2.89543 7 4V5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
      name: clubName,
      path: clubId ? `/clubs/${clubId}` : '/clubs'
    };

    const back: NavItem[] = [];
    if (p.canViewMyClub) back.push(monClubItem);

    for (const item of this.baseNavItems) {
      if (item.section !== 'back') continue;
      const filtered = this.filterItem(item, p);
      if (filtered) back.push(filtered);
    }

    this.frontOfficeNav = front;
    this.backOfficeNav = back;
    // Compat : on conserve `navItems` comme concat (front puis back) pour ne
    // pas casser un éventuel consommateur externe.
    this.navItems = [...front, ...back];

    // --- Others Items (Profile, etc.) ---
    this.visibleOthersItems = this.othersItems.map(item => {
      if (item.name === 'Club Settings' && clubId) {
        return { ...item, path: `/clubs/${clubId}/edit` };
      }
      return item;
    }).filter(item =>
      item.name !== 'Club Settings' || p.canManageClubSettings
    );
  }

  /**
   * Filtre un item du back-office selon le ROLE GLOBAL de l'utilisateur.
   * Logique STRICTE : chaque role voit UNIQUEMENT son propre back-office.
   *
   *   PRESIDENT          → tout (Mon Club, Members, Roles, Calendar, All events,
   *                       Tasks (assign), PV (lecture), Voice (analytics), Trésorerie (lecture))
   *   TRESORIER          → Trésorerie + Event Needs (validation devis)
   *   SECRETAIRE_GENERALE→ Procès-Verbaux + Members (lecture)
   *   RH                 → Members + Gestion des rôles
   *   RESP_EVENTS        → Calendar + All events + Tasks (assign) + Event Needs + Virtual events
   *   MEMBRE_SIMPLE      → AUCUN back-office (front-office seulement)
   */
  private filterItem(item: NavItem, p: SidebarPermissions): NavItem | null {
    const role = this.currentUser?.role ?? '';
    const isPresident   = role === 'PRESIDENT';
    const isVP          = role === 'VICE_PRESIDENT';
    const isTresorier   = TREASURER_ROLES.includes(role);
    const isSecGen      = isSecretaireGenerale(role);
    const isRH          = role === 'RH';
    const isSimple      = isSimpleMemberRole(role);
    const isRespEvents  = p.canManageEvents && !isTresorier; // dérivé de la matrice de permissions

    // ---- MEMBRE_SIMPLE : ZERO back-office ----
    if (isSimple) return null;

    // Le Secrétaire Général joue aussi le rôle de Community/Event Manager dans
    // ce club : il a la main sur tout ce qui touche aux événements (création,
    // gestion, tâches, besoins matériel, événements virtuels, transcriptions).
    const canManageEventsLikeManager = isPresident || isRespEvents || isVP || isSecGen;

    switch (item.name) {

      // Dashboard global : PRESIDENT seulement.
      case 'Dashboard global':
        return isPresident ? item : null;

      // Calendrier (création événements) : PRESIDENT + Resp Events + VP + Sec. Gen.
      case 'Calendar':
      case 'All events':
        return canManageEventsLikeManager ? item : null;

      // Événements virtuels : event managers (President / VP / Resp / Sec. Gen.)
      case 'Virtual events':
        return canManageEventsLikeManager ? item : null;

      // Transcriptions / archives audio : event managers
      case 'Transcriptions':
        return canManageEventsLikeManager ? item : null;

      // Instant Voice (talkie-walkie + canaux + audio reports) :
      // tout le BUREAU peut creer/gerer des canaux et recevoir des reports.
      // Le membre simple voit "My reports" pour signaler des audios.
      case 'Instant Voice': {
        const isBureau = isPresident || isVP || isTresorier || isSecGen || isRH;
        if (!isBureau && !isSimple) return null;
        const filteredSubs = (item.subItems ?? []).filter(s => {
          // Canaux + audio reports = bureau
          if (s.path === '/voice2/instant-voice') return isBureau || isSimple; // simple peut rejoindre
          if (s.path === '/voice2/audio-reports') return isBureau;
          // My reports = membre simple uniquement (bureau a "audio-reports" plus complet)
          if (s.path === '/voice2/my-reports') return isSimple;
          return false;
        });
        return filteredSubs.length ? { ...item, subItems: filteredSubs } : null;
      }

      // RSVP n'est PAS dans le back-office (l'inscription se fait depuis /events
      // en front-office pour le membre simple). On le cache toujours en back.
      case 'RSVP':
        return null;

      // Tasks : event managers (peut assigner des taches sur ses evenements).
      case 'Tasks': {
        if (!canManageEventsLikeManager) return null;
        const subItems = (item.subItems ?? []).filter(sub => {
          switch (sub.name) {
            case 'Assign tasks':  return canManageEventsLikeManager;
            case 'Manage tasks':  return false;
            default:              return false;
          }
        });
        return subItems.length ? { ...item, subItems } : null;
      }

      // Event Needs : TRESORIER (validation devis + Mark Paid) + event managers (création).
      case 'Event Needs': {
        if (!isTresorier && !canManageEventsLikeManager) return null;
        const subItems = (item.subItems ?? []).filter(sub => {
          switch (sub.name) {
            case 'All needs':       return isTresorier || canManageEventsLikeManager;
            case 'Lenders':         return canManageEventsLikeManager;
            case 'Quotes (Devis)':  return isTresorier;
            default:                return false;
          }
        });
        return subItems.length ? { ...item, subItems } : null;
      }

      // Members : PRESIDENT + RH + Secrétaire Générale.
      case 'Members':
        return (isPresident || isRH || isSecGen) ? item : null;

      // Gestion des rôles : PRESIDENT + RH.
      case 'Gestion des Rôles':
        return (isPresident || isRH) ? item : null;

      // Procès-Verbaux : SECRETAIRE_GENERALE seulement.
      case 'Procès-Verbaux':
        return isSecGen
          ? { ...item, badge: this.pendingPvCount || undefined }
          : null;

      // ------------------------------------------------------------------
      // Trésorerie BACK-OFFICE — UNE SEULE entrée "Gestion Trésorerie" qui
      // regroupe TOUS les écrans (dashboard, opérations, rapports, IA),
      // organisés en sous-sections via le champ `group` sur chaque sub-item.
      //
      // Filtrage des sub-items par rôle :
      //   - Vue d'ensemble (dashboard)       → TRESORIER + PRESIDENT
      //   - Opérations (cot/dep/budget/remb) → TRESORIER seul
      //   - Rapports (rapports + audit)      → TRESORIER + PRESIDENT
      //   - IA & Alertes                     → TRESORIER + PRESIDENT
      //
      // Si tous les sub-items sont filtrés (ex: rôle non concerné) le menu
      // entier disparaît. Le membre simple voit "Mes cotisations" en
      // front-office uniquement.
      // ------------------------------------------------------------------
      case 'Gestion Trésorerie': {
        if (!isTresorier && !isPresident) return null;
        const subItems = (item.subItems ?? []).filter(sub => {
          if (sub.group === 'Opérations') return isTresorier;
          // Vue d'ensemble / Rapports / IA & Alertes : TRESORIER + PRESIDENT
          return isTresorier || isPresident;
        });
        return subItems.length ? { ...item, subItems } : null;
      }


      // Par défaut : items inconnus = NON visibles en back-office (sécurité par défaut).
      default:
        return null;
    }
  }


  isActive(path: string): boolean {
    return this.router.url === path;
  }

  toggleSubmenu(section: string, index: number) {
    const key = `${section}-${index}`;

    if (this.openSubmenu === key) {
      this.openSubmenu = null;
      this.subMenuHeights[key] = 0;
    } else {
      this.openSubmenu = key;

      setTimeout(() => {
        const el = document.getElementById(key);
        if (el) {
          this.subMenuHeights[key] = el.scrollHeight;
          this.cdr.detectChanges();
        }
      });
    }
  }

  onSidebarMouseEnter() {
    this.isExpanded$.subscribe(expanded => {
      if (!expanded) {
        this.sidebarService.setHovered(true);
      }
    }).unsubscribe();
  }

  private setActiveMenuFromRoute(currentUrl: string) {
    const menuGroups = [
      { items: this.frontOfficeNav, prefix: 'front' },
      { items: this.backOfficeNav, prefix: 'back' },
      { items: this.visibleOthersItems, prefix: 'others' },
    ];

    menuGroups.forEach(group => {
      group.items.forEach((nav, i) => {
        if (nav.subItems) {
          nav.subItems.forEach(subItem => {
            if (currentUrl === subItem.path) {
              const key = `${group.prefix}-${i}`;
              this.openSubmenu = key;

              setTimeout(() => {
                const el = document.getElementById(key);
                if (el) {
                  this.subMenuHeights[key] = el.scrollHeight;
                  this.cdr.detectChanges();
                }
              });
            }
          });
        }
      });
    });
  }

  onSubmenuClick() {
    this.isMobileOpen$.subscribe(isMobile => {
      if (isMobile) {
        this.sidebarService.setMobileOpen(false);
      }
    }).unsubscribe();
  }
}
