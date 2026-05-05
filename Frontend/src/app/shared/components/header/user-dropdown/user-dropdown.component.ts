import { Component, OnDestroy, OnInit } from '@angular/core';
import { DropdownComponent } from '../../ui/dropdown/dropdown.component';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { DropdownItemTwoComponent } from '../../ui/dropdown/dropdown-item/dropdown-item.component-two';
import { AuthService, StoredUser } from '../../../services/auth.service';
import { NotificationService } from '../../../services/notification.service';
import { apiUrl } from '../../../../../environments/environment';

@Component({
  selector: 'app-user-dropdown',
  templateUrl: './user-dropdown.component.html',
  imports:[CommonModule,RouterModule,DropdownComponent,DropdownItemTwoComponent]
})
export class UserDropdownComponent implements OnInit, OnDestroy {
  isOpen = false;

  /** User shown in the trigger and the dropdown header. Lives in a property
   *  rather than a getter so any profile update propagated through
   *  `AuthService.userProfile$` re-renders this component automatically. */
  user: StoredUser | null = null;

  /** Fallback avatar used when the connected user hasn't uploaded a photo. */
  readonly defaultAvatar = '/images/user/owner.png';

  private profileSub?: Subscription;

  constructor(
    private authService: AuthService,
    private http: HttpClient,
    private router: Router,
    private notifService: NotificationService,
  ) {}

  ngOnInit(): void {
    // Seed with the current snapshot so the first render is correct (no
    // flicker of empty values), then subscribe to subsequent updates.
    this.user = this.authService.getCurrentUser();
    this.profileSub = this.authService.userProfile$.subscribe((u: any) => this.user = u);
  }

  ngOnDestroy(): void {
    this.profileSub?.unsubscribe();
  }

  /** Short label for the trigger button (first name only — fallback to full
   *  name then email). Avoids overflowing the header on narrow screens. */
  get displayShortName(): string {
    if (!this.user) return '';
    return this.user.firstName?.trim()
        || this.user.name?.split(' ')[0]
        || this.user.email
        || '';
  }

  /** Full name shown inside the dropdown panel. */
  get displayFullName(): string {
    if (!this.user) return '';
    return this.user.name?.trim() || this.user.email || '';
  }

  /** Resolved avatar URL with a sensible default. */
  get avatarUrl(): string {
    return this.user?.profilePhoto?.trim() || this.defaultAvatar;
  }

  /** Initiales (1 ou 2 lettres) pour l'avatar fallback sans image. */
  get initials(): string {
    if (!this.user) return '?';
    const fn = (this.user.firstName || '').trim();
    const ln = (this.user.lastName || '').trim();
    if (fn && ln) return (fn[0] + ln[0]).toUpperCase();
    if (fn) return fn.slice(0, 2).toUpperCase();
    if (this.user.name) return this.user.name.trim().slice(0, 2).toUpperCase();
    if (this.user.email) return this.user.email[0].toUpperCase();
    return '?';
  }

  toggleDropdown() {
    this.isOpen = !this.isOpen;
  }

  closeDropdown() {
    this.isOpen = false;
  }

  /**
   * Vraie déconnexion :
   * 1) POST /api/auth/logout → backend efface le cookie HttpOnly `jwt`
   * 2) authService.logout() → efface localStorage + signal côté front
   * 3) navigate vers /signin (pas un routerLink, sinon le guestGuard
   *    intercepte avant que la session soit nettoyée)
   *
   * Si le backend est injoignable, on déconnecte quand même côté front.
   */
  logout(): void {
    this.closeDropdown();

    const finishLogout = () => {
      // Stop background polling so the next user (or signin page) doesn't
      // inherit a stale notification stream.
      this.notifService.stopPolling();
      sessionStorage.removeItem('pvToastShown');
      this.authService.logout();
      this.router.navigate(['/signin']);
    };

    this.http
      .post(apiUrl('/api/auth/logout'), {}, { withCredentials: true, responseType: 'text' })
      .subscribe({
        next: () => finishLogout(),
        error: (err) => {
          console.warn('Logout backend a échoué — déconnexion locale quand même.', err);
          finishLogout();
        },
      });
  }
}
