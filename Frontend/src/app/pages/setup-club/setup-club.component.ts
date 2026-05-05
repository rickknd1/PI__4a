import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService, StoredUser } from '../../shared/services/auth.service';
import { apiUrl } from '../../../environments/environment';

/**
 * Page de création de club après inscription.
 *
 * Accessible :
 *   - juste après le SIGNUP (le sign-up component aura stocké `pendingUser`),
 *   - juste après un SIGNIN d'un compte existant qui n'a pas encore de club.
 *
 * Dans les deux cas on récupère l'utilisateur courant via AuthService
 * (qui le lit depuis le localStorage / cookie de session JWT).
 */
@Component({
  selector: 'app-setup-club',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './setup-club.component.html',
})
export class SetupClubComponent implements OnInit {
  clubName = '';
  description = '';
  category = 'Culture';
  logoUrl = '';
  colorPalette = '#3B82F6';
  loading = false;
  error = '';

  categories = ['Culture', 'Sport', 'Technologie', 'Science', 'Art', 'Musique'];

  /** Utilisateur actuellement connecté (signin ou signup). */
  private currentUser: StoredUser | null = null;
  private userId = '';
  private firstName = '';
  private lastName = '';
  private email = '';

  constructor(
    private router: Router,
    private http: HttpClient,
    private authService: AuthService,
  ) {}

  ngOnInit(): void {
    // 1. Source principale : utilisateur déjà loggé (signin ou signup)
    this.currentUser = this.authService.getCurrentUser();

    // 2. Fallback : ancienne logique signup qui posait `pendingUser` dans le localStorage
    const pending = JSON.parse(localStorage.getItem('pendingUser') || 'null');

    if (this.currentUser?.userId) {
      this.userId = this.currentUser.userId;
      this.firstName = this.currentUser.firstName || pending?.firstName || '';
      this.lastName = this.currentUser.lastName || pending?.lastName || '';
      this.email = this.currentUser.email || pending?.email || '';
    } else if (pending?.id) {
      this.userId = pending.id;
      this.firstName = pending.firstName || '';
      this.lastName = pending.lastName || '';
      this.email = pending.email || '';
    } else {
      // Ni session active, ni pendingUser → on renvoie vers signin
      console.warn('setup-club: aucun utilisateur actif, redirection vers /signin');
      this.router.navigate(['/signin']);
      return;
    }

    // Si l'utilisateur a déjà un club, inutile de rester ici
    if (this.currentUser?.clubId) {
      this.router.navigate(['/clubs', this.currentUser.clubId]);
    }
  }

  createClub(): void {
    if (!this.clubName.trim() || !this.userId) {
      this.error = 'Veuillez saisir un nom de club.';
      return;
    }

    this.loading = true;
    this.error = '';

    const clubData = {
      name: this.clubName.trim(),
      description: this.description,
      category: this.category,
      logoUrl: this.logoUrl,
      colorPalette: this.colorPalette,
      visibility: 'PUBLIC',
      createdBy: this.userId,
      members: [
        {
          userId: this.userId,
          email: this.email,
          name: `${this.firstName} ${this.lastName}`.trim(),
          role: 'PRESIDENT',
          status: 'APPROVED',
        },
      ],
    };

    this.http
      .post<any>(apiUrl('/api/clubs'), clubData, { withCredentials: true })
      .subscribe({
        next: (createdClub) => {
          // Lier le club au user dans le user-service
          this.http
            .put<any>(
              apiUrl(`/api/users/${this.userId}/club`),
              { clubId: createdClub.id },
              { withCredentials: true },
            )
            .subscribe({
              next: () => {
                // ✅ Met à jour la session via AuthService → propage dans toute l'app (sidebar, header, …)
                this.authService.updateLocalProfile({
                  clubId: createdClub.id,
                  clubName: createdClub.name,
                  role: 'PRESIDENT',
                });

                localStorage.removeItem('pendingUser');
                this.loading = false;
                this.router.navigate(['/clubs', createdClub.id]);
              },
              error: (err) => {
                console.error('Erreur association club:', err);
                this.loading = false;
                this.error = 'Erreur lors de la mise à jour du compte.';
              },
            });
        },
        error: (err) => {
          console.error('Erreur création club:', err);
          this.loading = false;
          this.error = err?.error?.message || 'Erreur lors de la création du club.';
        },
      });
  }
}
