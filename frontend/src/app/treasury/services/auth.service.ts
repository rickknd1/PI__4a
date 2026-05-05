import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, catchError, map, of, tap } from 'rxjs';
import { Router } from '@angular/router';
import { MockUser, UserRole } from '../models/treasury.models';

/** Le module User renvoie "userId" au lieu de "id" — on normalise. */
function normalizeUser(raw: any): MockUser | null {
  if (!raw) return null;
  return {
    id: raw.id || raw.userId,
    email: raw.email,
    firstName: raw.firstName,
    lastName: raw.lastName,
    phoneNumber: raw.phoneNumber,
    role: raw.role,
    clubId: raw.clubId,
    profilePhoto: raw.profilePhoto,
  };
}

/**
 * AuthService — pont vers le module User (esprit.com.clubhub) sur le port 8081.
 *
 * Le module User pose un cookie httpOnly `jwt` lors du login. Toutes les requetes
 * passent par le Gateway Spring Cloud sur 8084 avec withCredentials: true
 * pour que le navigateur transmette automatiquement le cookie.
 *
 * Permissions metier (cohrente avec backend treasury security/Roles.java):
 *  - TRESORIER : full back-office
 *  - PRESIDENT/VICE_PRESIDENT/SECRETAIRE_GENERALE : lecture rapports + validation N2
 *  - RH : lecture seule
 *  - MEMBRE_SIMPLE : front-office uniquement
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly userServiceBase = 'http://localhost:8084/api';
  private readonly currentUser$ = new BehaviorSubject<MockUser | null>(null);

  readonly user$ = this.currentUser$.asObservable();

  private http = inject(HttpClient);
  private router = inject(Router);

  constructor() {
    // Ne PAS appeler refreshFromServer() ici — ca provoque une boucle
    // avec l'intercepteur 401 au chargement. Le refresh est fait
    // explicitement par UserSelectComponent.ngOnInit() et authGuard.
  }

  /** Login direct sur le module User. Le cookie jwt est pose automatiquement. */
  login(email: string, password: string): Observable<MockUser | null> {
    return this.http
      .post<any>(
        `${this.userServiceBase}/auth/login`,
        { email, password },
        { withCredentials: true }
      )
      .pipe(
        map(normalizeUser),
        tap((u) => this.currentUser$.next(u)),
        catchError(() => of(null))
      );
  }

  /**
   * Recupere le profil courant.
   *
   * 1. Premier essai : localStorage cle 'currentUser' (pose par l'AuthService
   *    global lors du login signin). C'est la source de verite cote SPA et
   *    permet de fonctionner meme quand le cookie JWT (SameSite=Lax) ne suit
   *    pas en cross-origin XHR vers localhost:8084.
   * 2. Fallback : appel HTTP /users/me avec cookie (utilise si meme origine).
   */
  refreshFromServer(): Observable<MockUser | null> {
    // Source primaire : SPA localStorage (Global AuthService)
    try {
      const raw = localStorage.getItem('currentUser');
      if (raw) {
        const stored = JSON.parse(raw);
        const user = normalizeUser(stored);
        if (user) {
          this.currentUser$.next(user);
          return of(user);
        }
      }
    } catch {
      // localStorage corrompu, on tente l'appel HTTP
    }
    // Fallback : appel HTTP avec cookie (peut echouer en cross-origin)
    return this.http
      .get<any>(`${this.userServiceBase}/users/me`, { withCredentials: true })
      .pipe(
        map(normalizeUser),
        tap((u) => this.currentUser$.next(u)),
        catchError(() => {
          this.currentUser$.next(null);
          return of(null);
        })
      );
  }

  logout(): Observable<unknown> {
    return this.http
      .post(`${this.userServiceBase}/auth/logout`, {}, { withCredentials: true })
      .pipe(
        tap(() => {
          this.currentUser$.next(null);
          // Efface aussi la session du AuthService GLOBAL pour eviter une
          // desynchronisation (header vs page affichant des users differents).
          try { localStorage.removeItem('currentUser'); localStorage.removeItem('token'); } catch {}
          this.router.navigateByUrl('/signin');
        }),
        catchError(() => {
          this.currentUser$.next(null);
          try { localStorage.removeItem('currentUser'); localStorage.removeItem('token'); } catch {}
          this.router.navigateByUrl('/signin');
          return of(null);
        })
      );
  }

  // ── Helpers role ──────────────────────────────────────────────────────
  /**
   * Retourne le user courant. SOURCE DE VERITE : localStorage 'currentUser'
   * (pose par le AuthService GLOBAL au login). On le lit a chaque appel pour
   * rester synchro avec le Global auth meme apres un re-login (sinon le
   * BehaviorSubject Treasury garde l'ancien user et la page affiche un nom
   * different de celui du header).
   */
  current(): MockUser | null {
    try {
      const raw = localStorage.getItem('currentUser');
      if (raw) {
        const parsed = JSON.parse(raw);
        const fresh = normalizeUser(parsed);
        const cached = this.currentUser$.value;
        // Si l'user a change (login/logout/switch), on synchronise le BehaviorSubject
        if (fresh && (!cached || cached.id !== fresh.id || cached.email !== fresh.email)) {
          this.currentUser$.next(fresh);
        } else if (!fresh && cached) {
          this.currentUser$.next(null);
        }
        return fresh;
      }
    } catch {
      // localStorage corrompu : on retombe sur le BehaviorSubject
    }
    // Pas de localStorage : on revient au BehaviorSubject (peut etre populé par login())
    return this.currentUser$.value;
  }

  isAuthenticated(): boolean {
    return this.currentUser$.value !== null;
  }

  hasRole(...roles: UserRole[]): boolean {
    const r = this.currentUser$.value?.role;
    return r != null && roles.includes(r);
  }

  isTresorier(): boolean { return this.hasRole('TRESORIER'); }
  isPresident(): boolean { return this.hasRole('PRESIDENT'); }
  isBureau(): boolean { return this.hasRole('PRESIDENT', 'VICE_PRESIDENT', 'SECRETAIRE_GENERALE'); }
  isMembreSimple(): boolean { return this.hasRole('MEMBRE_SIMPLE'); }
  canReadReports(): boolean { return this.hasRole('TRESORIER', 'PRESIDENT', 'VICE_PRESIDENT', 'SECRETAIRE_GENERALE', 'RH'); }
  canApproveExpense(): boolean { return this.hasRole('PRESIDENT', 'VICE_PRESIDENT', 'SECRETAIRE_GENERALE'); }
}
