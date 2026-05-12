import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject } from 'rxjs';
import { AuthService, StoredUser } from './auth.service';
import { apiUrl } from '../../../environments/environment';

export interface ResponsableStatus {
  isResponsable: boolean;
  subGroupId?: string;
  subGroupName?: string;
}

@Injectable({
  providedIn: 'root',
})
export class CommitteeResponsableService {
  private baseUrl = apiUrl('/api/clubs');

  /**
   * Cle sessionStorage. Persiste le statut responsable entre les navigations
   * pour que les layouts/permissions soient evaluables SYNCHRONEMENT au mount.
   * AVANT, RoleAwareLayoutComponent affichait MemberLayout par defaut puis
   * switchait sur AppLayout apres le fetch async -> flicker visible chaque
   * fois qu'on changeait de page racine.
   */
  private static readonly CACHE_KEY = 'clubhub.responsableStatus';

  private responsableStatusSubject: BehaviorSubject<ResponsableStatus | null>;
  public responsableStatus$;

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {
    this.responsableStatusSubject = new BehaviorSubject<ResponsableStatus | null>(this.readCache());
    this.responsableStatus$ = this.responsableStatusSubject.asObservable();

    this.loadResponsableStatus();
    this.authService.userProfile$.subscribe((user: StoredUser | null) => {
      if (user) {
        this.loadResponsableStatus();
      } else {
        this.clearCache();
        this.responsableStatusSubject.next(null);
      }
    });
  }

  private readCache(): ResponsableStatus | null {
    try {
      const raw = sessionStorage.getItem(CommitteeResponsableService.CACHE_KEY);
      return raw ? JSON.parse(raw) as ResponsableStatus : null;
    } catch { return null; }
  }
  private writeCache(s: ResponsableStatus): void {
    try { sessionStorage.setItem(CommitteeResponsableService.CACHE_KEY, JSON.stringify(s)); } catch { /* noop */ }
  }
  private clearCache(): void {
    try { sessionStorage.removeItem(CommitteeResponsableService.CACHE_KEY); } catch { /* noop */ }
  }

  loadResponsableStatus(): void {
    const user = this.authService.getCurrentUser();
    const clubId = user?.clubId;
    const userId = user?.userId;

    if (!clubId || !userId) {
      // Ne PAS emettre false ici : pendant la phase de login, userProfile$ peut
      // emettre un user partiel sans clubId/userId. Si on emettait false, on
      // ecraserait un statut "true" deja calcule par un fetch precedent et le
      // layout flipperait de AppLayout vers MemberLayout. On garde la derniere
      // valeur du subject. Quand l'auth sera complete, un nouveau call viendra.
      return;
    }

    this.http
      .get<ResponsableStatus>(`${this.baseUrl}/${clubId}/is-responsable/${userId}`)
      .subscribe({
        next: (status) => {
          this.responsableStatusSubject.next(status);
          this.writeCache(status);
        },
        error: () => {
          const fallback: ResponsableStatus = { isResponsable: false };
          this.responsableStatusSubject.next(fallback);
          this.writeCache(fallback);
        },
      });
  }

  isResponsable(): boolean {
    return this.responsableStatusSubject.value?.isResponsable ?? false;
  }

  getMySubGroupId(): string | null {
    return this.responsableStatusSubject.value?.subGroupId ?? null;
  }

  getMySubGroupName(): string | null {
    return this.responsableStatusSubject.value?.subGroupName ?? null;
  }

  getDisplayRole(): string {
    const status = this.responsableStatusSubject.value;
    if (status?.isResponsable && status.subGroupName) {
      return `Responsable ${status.subGroupName}`;
    }
    return this.authService.getCurrentRole();
  }
}
