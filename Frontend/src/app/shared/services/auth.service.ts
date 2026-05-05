// src/app/shared/services/auth.service.ts
import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { apiUrl } from '../../../environments/environment';

export type UserRole = string; // 'PRESIDENT' | 'RH' | 'SECRETAIRE_GENERALE' | 'TRESORIER' | 'MEMBRE_SIMPLE' | ...

/** Utilisateur stocké en session côté front. */
export interface StoredUser {
  id: string;
  userId: string;          // alias legacy de `id`
  name: string;            // "firstName lastName"
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber?: string;
  role: UserRole;
  avatar?: string;
  profilePhoto?: string;
  clubId?: string;
  clubName?: string;
  token?: string;
}

// Conservé pour rétro-compatibilité
export type CurrentUser = StoredUser;

/** Représentation d'un utilisateur côté user-service (CRUD admin). */
export interface LegacyUser {
  id?: string;
  userId?: string;
  name?: string;
  firstName: string;
  lastName: string;
  email: string;
  password?: string;
  phoneNumber?: string;
  role: string;
  clubId?: string;
  clubName?: string;
  active?: boolean;
  profilePhoto?: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phoneNumber?: string;
  role: string;
  clubId?: string;
  profilePhoto?: string;
}

export interface AuthResponse {
  userId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: string;
  clubId?: string;
  clubName?: string;
  phoneNumber?: string;
  profilePhoto?: string;
  token: string;
}

const STORAGE_KEY = 'currentUser';

@Injectable({ providedIn: 'root' })
export class AuthService {

  private readonly authUrl = apiUrl('/api/auth');
  private readonly usersUrl = apiUrl('/api/users');

  private currentUserSignal = signal<StoredUser | null>(this.readSession());

  private userProfileSubject = new BehaviorSubject<StoredUser | null>(this.currentUserSignal());
  public userProfile$: Observable<StoredUser | null> = this.userProfileSubject.asObservable();

  constructor(private http: HttpClient) {}

  // ============================================================
  //  Session helpers
  // ============================================================
  private readSession(): StoredUser | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as StoredUser) : null;
    } catch {
      return null;
    }
  }

  private writeSession(user: StoredUser | null): void {
    if (user) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
    this.currentUserSignal.set(user);
    this.userProfileSubject.next(user);
  }

  private toStoredUser(res: AuthResponse): StoredUser {
    const firstName = res.firstName ?? '';
    const lastName  = res.lastName ?? '';
    return {
      id: res.userId,
      userId: res.userId,
      name: `${firstName} ${lastName}`.trim() || res.email,
      firstName,
      lastName,
      email: res.email,
      phoneNumber: res.phoneNumber,
      role: res.role,
      profilePhoto: res.profilePhoto,
      clubId: res.clubId,
      clubName: res.clubName,
      token: res.token
    };
  }

  // ============================================================
  //  Lecture
  // ============================================================
  /**
   * Re-synchronise le signal avec localStorage si necessaire.
   * Garantit que header (BehaviorSubject) et pages (lecture localStorage)
   * affichent toujours le MEME utilisateur, meme si une autre route a
   * mis a jour le localStorage sans passer par writeSession.
   */
  private syncFromStorage(): StoredUser | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const fresh = raw ? (JSON.parse(raw) as StoredUser) : null;
      const cached = this.currentUserSignal();
      const changed = (fresh?.id !== cached?.id) || (fresh?.email !== cached?.email);
      if (changed) {
        this.currentUserSignal.set(fresh);
        this.userProfileSubject.next(fresh);
      }
      return fresh;
    } catch {
      return this.currentUserSignal();
    }
  }

  getUser(): StoredUser | null {
    return this.syncFromStorage();
  }

  getCurrentUser(): StoredUser | null {
    return this.syncFromStorage();
  }

  getRole(): UserRole {
    return this.syncFromStorage()?.role ?? '';
  }

  getCurrentRole(): UserRole {
    return this.getRole();
  }

  getCurrentClubId(): string | null {
    return this.currentUserSignal()?.clubId ?? null;
  }

  isLoggedIn(): boolean {
    // A user without a JWT cannot talk to session-aware backend endpoints
    // (RSVP, event creation, feedback…). Treat them as logged-out so the
    // AuthGuard redirects them to /signin instead of letting them land on
    // a page that will fail with 401 on the first action.
    const u = this.currentUserSignal();
    return !!u && !!u.token;
  }

  /**
   * Token JWT en mémoire — utile pour les endpoints qui exigent un header
   * `Authorization: Bearer …`. L'auth principale passe par un cookie HttpOnly
   * géré automatiquement par le navigateur (cf. JwtInterceptor + withCredentials).
   */
  getToken(): string | null {
    return this.currentUserSignal()?.token ?? localStorage.getItem('token');
  }

  isBureau(): boolean {
    const role = this.getRole()?.toUpperCase() || '';
    return ['BUREAU', 'SUPER_ADMIN', 'PRESIDENT', 'VICE_PRESIDENT', 'RH', 'SECRETAIRE_GENERALE', 'SECRETAIRE_GENERAL', 'TRESORIER', 'TREASURER']
      .includes(role);
  }

  isMember(): boolean {
    return !this.isBureau() && !this.isStaff();
  }

  isStaff(): boolean {
    return this.getRole() === 'staff';
  }

  // ============================================================
  //  Auth (login / register / me)
  // ============================================================
  login(payload: LoginPayload): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.authUrl}/login`, payload).pipe(
      tap(res => this.writeSession(this.toStoredUser(res)))
    );
  }

  register(payload: RegisterPayload): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.authUrl}/register`, payload).pipe(
      tap(res => this.writeSession(this.toStoredUser(res)))
    );
  }

  getMe(): Observable<AuthResponse> {
    return this.http.get<AuthResponse>(`${this.authUrl}/me`).pipe(
      tap(res => this.writeSession(this.toStoredUser(res)))
    );
  }

  logout(): void {
    this.writeSession(null);
  }

  // ============================================================
  //  Profil local — propage à toute l'app
  // ============================================================
  /**
   * Met à jour la session locale + diffuse les changements dans `userProfile$`
   * sans toucher au backend.
   */
  updateLocalProfile(partial: Partial<StoredUser>): void {
    const current = this.currentUserSignal();
    if (!current) return;

    const merged: StoredUser = {
      ...current,
      ...partial,
      name:
        partial.firstName !== undefined || partial.lastName !== undefined
          ? `${partial.firstName ?? current.firstName} ${partial.lastName ?? current.lastName}`.trim()
          : current.name
    };
    this.writeSession(merged);
  }

  /**
   * Upload d'une nouvelle photo de profil. Met aussi à jour la session locale.
   */
  updateProfilePhoto(userId: string, base64: string): Observable<any> {
    return this.http
      .put<any>(`${this.usersUrl}/${userId}/photo`, { profilePhoto: base64 })
      .pipe(tap(() => this.updateLocalProfile({ profilePhoto: base64 })));
  }

  // ============================================================
  //  CRUD Users (admin / club)
  // ============================================================
  getUsersByClub(): Observable<LegacyUser[]> {
    const clubId = this.getCurrentClubId();
    return this.http.get<LegacyUser[]>(`${this.usersUrl}/club/${clubId}`);
  }

  createUser(user: LegacyUser): Observable<LegacyUser> {
    return this.http.post<LegacyUser>(this.usersUrl, user);
  }

  updateUser(userId: string, data: Partial<LegacyUser>): Observable<LegacyUser> {
    return this.http.put<LegacyUser>(`${this.usersUrl}/${userId}`, data);
  }

  deleteUser(userId: string): Observable<void> {
    return this.http.delete<void>(`${this.usersUrl}/${userId}`);
  }

  /**
   * Compat Voice2: liste des membres simples depuis user-service.
   * Endpoint utilisé par l'intégration Instant Voice.
   */
  getSimpleMembers(): Observable<any[]> {
    return this.http.get<any[]>(`${this.usersUrl}/members`);
  }

  /**
   * Compat Voice2: assigne un poste/committee à un membre.
   */
  assignPost(userId: string, post: string): Observable<any> {
    return this.http.put<any>(`${this.usersUrl}/${userId}/post`, { post });
  }

  /**
   * Compat Voice2: supprime un poste pour tous les membres concernés.
   */
  clearPostByName(postName: string): Observable<any> {
    return this.http.delete<any>(`${this.usersUrl}/by-post/${encodeURIComponent(postName)}`);
  }
}
