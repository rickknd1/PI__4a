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

  private responsableStatusSubject = new BehaviorSubject<ResponsableStatus | null>(null);
  public responsableStatus$ = this.responsableStatusSubject.asObservable();

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {
    this.loadResponsableStatus();
    this.authService.userProfile$.subscribe((user: StoredUser | null) => {
      if (user) {
        this.loadResponsableStatus();
      } else {
        this.responsableStatusSubject.next(null);
      }
    });
  }

  loadResponsableStatus(): void {
    const user = this.authService.getCurrentUser();
    const clubId = user?.clubId;
    const userId = user?.userId;

    if (!clubId || !userId) {
      this.responsableStatusSubject.next({ isResponsable: false });
      return;
    }

    this.http
      .get<ResponsableStatus>(`${this.baseUrl}/${clubId}/is-responsable/${userId}`)
      .subscribe({
        next: (status) => this.responsableStatusSubject.next(status),
        error: () => this.responsableStatusSubject.next({ isResponsable: false }),
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
