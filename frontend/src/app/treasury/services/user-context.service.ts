import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { MockUser } from '../models/treasury.models';
import { AuthService } from './auth.service';

/**
 * Wrapper de compatibilite — la source de verite est desormais AuthService.
 *
 * Conserve l'API existante pour ne pas casser les composants existants
 * (espace-membre, dashboard, etc.) mais delegue tout a AuthService.
 *
 * NOTE: les anciens helpers (createUser, getUsers...) restent pour le seed
 * et l'admin tresorier, mais la session utilisateur n'est plus stockee
 * dans localStorage : elle vient du cookie jwt servi par le module User.
 */
@Injectable({ providedIn: 'root' })
export class UserContextService {
  private base = 'http://localhost:8084/api/v1/users';

  private http = inject(HttpClient);
  private auth = inject(AuthService);

  // ── Source de verite : AuthService ─────────────────────────────────────
  currentUser$ = this.auth.user$;

  getCurrentUser(): MockUser | null {
    return this.auth.current();
  }

  logout() {
    this.auth.logout().subscribe();
  }

  isPresident(): boolean    { return this.auth.isPresident(); }
  isTresorier(): boolean    { return this.auth.isTresorier(); }
  isMembre(): boolean       { return this.auth.isMembreSimple(); }
  isBureau(): boolean       { return this.auth.isBureau(); }
  canReadReports(): boolean { return this.auth.canReadReports(); }

  // ── Methodes admin (pour gestion utilisateurs cote tresorier) ─────────
  // Le cookie jwt est ajoute automatiquement par credentialsInterceptor.
  getUsers(clubId: number | string): Observable<MockUser[]> {
    return this.http.get<MockUser[]>(`${this.base}/club/${clubId}`);
  }

  createUser(email: string, firstName: string, lastName: string, role: string, clubId: number): Observable<MockUser> {
    return this.http.post<MockUser>(this.base, { email, firstName, lastName, role, clubId: String(clubId) });
  }

  /** @deprecated — la session vient maintenant du cookie jwt. */
  setCurrentUser(_user: MockUser) {
    console.warn('[UserContextService] setCurrentUser() est deprecie — utilisez AuthService.login()');
  }
}
