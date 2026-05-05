import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

export interface RegisterPayload {
  firstName: string;
  lastName: string;
  phoneNumber: string;
  email: string;
  password: string;
  role: string;
  clubId: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface AuthResponse {
  token?: string;
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  clubId: string;
  phoneNumber?: string;
  profilePhoto?: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {

  private api      = 'http://localhost:8080/api/auth';
  private usersApi = 'http://localhost:8080/api/users';

  constructor(private http: HttpClient) {}

  register(payload: RegisterPayload): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.api}/register`, payload, {
      withCredentials: true
    }).pipe(tap(res => this.saveUser(res)));
  }

  login(payload: LoginPayload): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.api}/login`, payload, {
      withCredentials: true
    }).pipe(tap(res => this.saveUser(res)));
  }

  logout(): Observable<any> {
    return this.http.post(`${this.api}/logout`, {}, {
      withCredentials: true
    }).pipe(tap(() => {
      localStorage.removeItem('user');
      localStorage.removeItem('sessionExpiry');
    }));
  }

  checkSession(): Observable<any> {
    return this.http.get(`${this.api}/check`, {
      withCredentials: true
    });
  }

  // ── Récupère le user depuis MongoDB par son ID ──────────────────
  getMe(): Observable<any> {
    const session = this.getCurrentUser();
    const userId = session?.userId;
    if (!userId) {
      return new Observable(obs => obs.complete());
    }
    return this.http.get(`${this.usersApi}/${userId}`, {
      withCredentials: true
    });
  }

  // ── Met à jour la photo dans MongoDB ────────────────────────────
  updateProfilePhoto(userId: string, photoUrl: string): Observable<any> {
    return this.http.put(
      `${this.usersApi}/${userId}/photo`,
      { photoUrl },
      { withCredentials: true }
    );
  }

  // ── Récupère les membres simples ─────────────────────────────────
  getSimpleMembers(): Observable<any[]> {
    return this.http.get<any[]>(`${this.usersApi}/members`, {
      withCredentials: true
    });
  }

  // ── Assigne un poste à un membre simple ──────────────────────────
  assignPost(userId: string, post: string): Observable<any> {
    return this.http.put(
      `${this.usersApi}/${userId}/post`,
      { post },
      { withCredentials: true }
    );
  }

  // ── Vide le post de tous les membres avec ce postName ────────────
  clearPostByName(postName: string): Observable<any> {
    return this.http.delete(
      `${this.usersApi}/by-post/${encodeURIComponent(postName)}`,
      { withCredentials: true }
    );
  }

  private static readonly SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24h

  isLoggedIn(): boolean {
    const user = localStorage.getItem('user');
    if (!user) return false;
    const expiry = localStorage.getItem('sessionExpiry');
    if (!expiry || Date.now() > parseInt(expiry, 10)) {
      localStorage.removeItem('user');
      localStorage.removeItem('sessionExpiry');
      return false;
    }
    return true;
  }

  getCurrentUser(): AuthResponse | null {
    if (!this.isLoggedIn()) return null;
    const u = localStorage.getItem('user');
    return u ? JSON.parse(u) : null;
  }

  private saveUser(res: AuthResponse): void {
    localStorage.setItem('user', JSON.stringify(res));
    localStorage.setItem('sessionExpiry', String(Date.now() + AuthService.SESSION_DURATION_MS));
  }
}