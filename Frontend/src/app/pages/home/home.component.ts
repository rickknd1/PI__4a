import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { catchError, of } from 'rxjs';

import { AuthService, StoredUser } from '../../shared/services/auth.service';
import { NotificationService, AppNotification } from '../../shared/services/notification.service';
import { apiUrl } from '../../../environments/environment';

/**
 * Front-office commun (HomeComponent)
 *
 * Page d'accueil affichee a TOUS les utilisateurs apres login (peu importe le role).
 * Reunit en un seul ecran : prochains evenements, mes cotisations, mes notifications,
 * acces rapide au QR scanner et acces conditionnel au back-office du role.
 */

interface UpcomingEvent {
  id?: string;
  title: string;
  startDate: string;
  endDate?: string;
  location?: { name?: string; address?: string };
  imageUrl?: string;
  status?: string;
  shortDescription?: string;
}

type PaymentStatus =
  | 'PENDING'
  | 'PENDING_CASH'
  | 'PAID'
  | 'LATE'
  | 'REFUNDED'
  | 'PARTIALLY_REFUNDED'
  | 'FAILED'
  | 'EXEMPT';

interface MyPayment {
  id: string;
  cotisationRuleName?: string;
  amount: number;
  status: PaymentStatus;
  dueDate: string;
  paidAt?: string;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink, DatePipe, DecimalPipe, FormsModule],
  templateUrl: './home.component.html',
})
export class HomeComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly notif = inject(NotificationService);
  private readonly router = inject(Router);

  /** Utilisateur courant — exposé au template pour le header de bienvenue. */
  readonly user = signal<StoredUser | null>(this.auth.getCurrentUser());

  readonly upcomingEvents = signal<UpcomingEvent[]>([]);
  readonly myPayments = signal<MyPayment[]>([]);
  readonly notifications = signal<AppNotification[]>([]);

  readonly loadingEvents = signal(true);
  readonly loadingPayments = signal(true);
  readonly loadingNotifs = signal(true);

  /** Role normalise (uppercase, sans espaces). */
  readonly role = computed(() => (this.user()?.role || '').toUpperCase().trim());

  /** Vrai si l'utilisateur a un back-office (autre que MEMBRE_SIMPLE). */
  readonly hasBackoffice = computed(() => {
    const r = this.role();
    return !!r && r !== 'MEMBRE_SIMPLE' && r !== 'MEMBER';
  });

  /** Libelle du back-office en fonction du role. */
  readonly backofficeLabel = computed(() => this.labelForRole(this.role()));

  /** Cotisations a payer (PENDING ou LATE). */
  readonly payableCotisations = computed(() =>
    this.myPayments().filter(p => p.status === 'PENDING' || p.status === 'LATE' || p.status === 'PENDING_CASH'),
  );

  /** Dette totale en TND (somme des cotisations PENDING + LATE). */
  readonly debtTotal = computed(() =>
    this.payableCotisations().reduce((sum, p) => sum + (p.amount || 0), 0),
  );

  ngOnInit(): void {
    // Each loader is wrapped in try/catch so a single failing call never
    // takes down the whole landing page. Dev tip: open the browser console
    // — every recoverable error is logged as a warning, not silently swallowed.
    try { this.loadEvents();        } catch (e) { console.warn('home/loadEvents error', e); this.loadingEvents.set(false); }
    try { this.loadPayments();      } catch (e) { console.warn('home/loadPayments error', e); this.loadingPayments.set(false); }
    try { this.loadNotifications(); } catch (e) { console.warn('home/loadNotifications error', e); this.loadingNotifs.set(false); }
  }

  // ============================================================
  //  Chargement des donnees
  // ============================================================
  private loadEvents(): void {
    this.loadingEvents.set(true);
    // On recupere tout puis on filtre cote client (l'API peut ne pas supporter ?upcoming=true).
    this.http
      .get<UpcomingEvent[]>(apiUrl('/api/events'))
      .pipe(catchError(() => of<UpcomingEvent[]>([])))
      .subscribe(list => {
        const now = Date.now();
        const upcoming = (list || [])
          .filter(e => {
            const t = new Date(e.startDate).getTime();
            return !isNaN(t) && t >= now;
          })
          .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
          .slice(0, 3);
        this.upcomingEvents.set(upcoming);
        this.loadingEvents.set(false);
      });
  }

  private loadPayments(): void {
    this.loadingPayments.set(true);
    const userId = this.user()?.id || this.user()?.userId;
    if (!userId) {
      this.myPayments.set([]);
      this.loadingPayments.set(false);
      return;
    }
    // Le TRESORIER n'est PAS un membre payant : on ne charge pas de cotisations
    // pour lui sur la home (il a deja sa vue back-office complete a part).
    const role = (this.user()?.role || '').toUpperCase().trim();
    if (role === 'TRESORIER' || role === 'TREASURER') {
      this.myPayments.set([]);
      this.loadingPayments.set(false);
      return;
    }
    // Utilise l'endpoint qui filtre cote BACKEND par memberId (le query param
    // ?memberId=... sur la liste globale est IGNORE par le service Treasury et
    // retourne tous les paiements du club, ce qui creait un faux positif :
    // Rick voyait les cotisations de Dylan).
    const clubId = this.user()?.clubId || '1';
    this.http
      .get<MyPayment[]>(apiUrl(`/api/v1/treasury/${clubId}/payments/member/${userId}`))
      .pipe(catchError(() => of<MyPayment[]>([])))
      .subscribe(list => {
        // Trie : LATE d'abord, puis PENDING, puis le reste, par date d'echeance croissante
        const order: Record<string, number> = { LATE: 0, PENDING: 1, PENDING_CASH: 1, PAID: 2 };
        const sorted = (list || []).slice().sort((a, b) => {
          const oa = order[a.status] ?? 3;
          const ob = order[b.status] ?? 3;
          if (oa !== ob) return oa - ob;
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        });
        this.myPayments.set(sorted.slice(0, 8));
        this.loadingPayments.set(false);
      });
  }

  private loadNotifications(): void {
    this.loadingNotifs.set(true);
    this.notif
      .refresh()
      .pipe(catchError(() => of({ items: [] as AppNotification[], unread: 0 })))
      .subscribe(feed => {
        this.notifications.set((feed.items || []).slice(0, 5));
        this.loadingNotifs.set(false);
      });
  }

  // ============================================================
  //  Actions UI
  // ============================================================
  /** Redirige vers le back-office du role. */
  goToBackoffice(): void {
    this.router.navigate([this.routeForRole(this.role())]);
  }

  /** RSVP sur un evenement. */
  rsvp(event: UpcomingEvent): void {
    if (!event?.id) return;
    this.http
      .post(apiUrl(`/api/events/${event.id}/rsvp`), {})
      .pipe(catchError(() => of(null)))
      .subscribe(() => {
        // Feedback visuel basique. Une notification toast pourrait etre branchee plus tard.
        this.router.navigate(['/rsvp'], { queryParams: { eventId: event.id } });
      });
  }

  /** Lance le paiement d'une cotisation via le module Treasury. */
  payCotisation(payment: MyPayment): void {
    this.router.navigate(['/treasury/payer-cotisation'], {
      queryParams: { paymentId: payment.id },
    });
  }

  // ============================================================
  //  Helpers role -> route / label
  // ============================================================
  private routeForRole(role: string): string {
    switch (role) {
      case 'PRESIDENT':
      case 'VICE_PRESIDENT':
        return '/dashboard';
      case 'TRESORIER':
      case 'TREASURER':
        return '/treasury';
      case 'SECRETAIRE_GENERALE':
      case 'SECRETAIRE_GENERAL':
        return '/pv';
      case 'RH':
        return '/users';
      case 'RESP_EVENTS':
      case 'EVENTS_MANAGER':
        return '/events';
      default:
        return '/dashboard';
    }
  }

  private labelForRole(role: string): string {
    switch (role) {
      case 'PRESIDENT':
      case 'VICE_PRESIDENT':
        return 'Tableau de bord President';
      case 'TRESORIER':
      case 'TREASURER':
        return 'Espace Tresorerie';
      case 'SECRETAIRE_GENERALE':
      case 'SECRETAIRE_GENERAL':
        return 'Proces-Verbaux';
      case 'RH':
        return 'Gestion des membres';
      case 'RESP_EVENTS':
      case 'EVENTS_MANAGER':
        return 'Gestion des evenements';
      default:
        return 'Mon back-office';
    }
  }

  /** Couleur du badge selon le statut de paiement. */
  statusBadgeClass(status: PaymentStatus): string {
    switch (status) {
      case 'PAID':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300';
      case 'LATE':
        return 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300';
      case 'PENDING':
      case 'PENDING_CASH':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
      case 'EXEMPT':
        return 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300';
      default:
        return 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300';
    }
  }

  statusLabel(status: PaymentStatus): string {
    const map: Record<PaymentStatus, string> = {
      PAID: 'Payee',
      LATE: 'En retard',
      PENDING: 'A payer',
      PENDING_CASH: 'A payer (cash)',
      EXEMPT: 'Exempte',
      REFUNDED: 'Remboursee',
      PARTIALLY_REFUNDED: 'Remb. partiel',
      FAILED: 'Echec',
    };
    return map[status] ?? status;
  }

  /** Couleur du badge severity pour les notifications. */
  severityClass(sev: string): string {
    switch (sev) {
      case 'success':
        return 'bg-emerald-500';
      case 'warning':
        return 'bg-amber-500';
      case 'error':
        return 'bg-rose-500';
      default:
        return 'bg-sky-500';
    }
  }
}
