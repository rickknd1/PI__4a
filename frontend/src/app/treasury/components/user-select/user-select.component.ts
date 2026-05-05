import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { MockUser } from '../../models/treasury.models';

@Component({
  selector: 'app-user-select',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-6">
      <div class="w-full max-w-md space-y-6">

        <div class="text-center">
          <h1 class="text-3xl font-bold text-gray-900 dark:text-white">ClubHub Treasury</h1>
          <p class="text-gray-500 mt-2">Connectez-vous pour acceder a votre espace</p>
        </div>

        <div class="bg-white dark:bg-gray-800 rounded-2xl border p-6 space-y-4">

          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Email</label>
            <input [(ngModel)]="email" type="email" autocomplete="email"
                   class="w-full px-3 py-2 border rounded-lg text-sm dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500"
                   placeholder="votre.email&#64;esprit.tn"
                   (keydown.enter)="onLogin()">
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Mot de passe</label>
            <input [(ngModel)]="password" type="password" autocomplete="current-password"
                   class="w-full px-3 py-2 border rounded-lg text-sm dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500"
                   placeholder="••••••••"
                   (keydown.enter)="onLogin()">
          </div>

          <div *ngIf="error" class="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
            {{ error }}
          </div>

          <div *ngIf="success" class="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">
            {{ success }}
          </div>

          <button (click)="onLogin()"
                  class="w-full py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition"
                  [class.opacity-50]="loading">
            {{ loading ? 'Connexion en cours...' : 'Se connecter' }}
          </button>

          <p class="text-xs text-center text-gray-400">
            Module User sur port 8081
          </p>
        </div>
      </div>
    </div>
  `,
})
export class UserSelectComponent implements OnInit {
  email = '';
  password = '';
  loading = false;
  error = '';
  success = '';

  private auth = inject(AuthService);
  private router = inject(Router);

  ngOnInit() {
    this.auth.refreshFromServer().subscribe((u) => {
      if (u) this.routeByRole(u);
    });
  }

  onLogin() {
    this.error = '';
    this.success = '';

    if (!this.email || !this.password) {
      this.error = 'Remplissez email et mot de passe.';
      return;
    }

    this.loading = true;
    this.success = 'Connexion en cours...';

    this.auth.login(this.email, this.password).subscribe({
      next: (user) => {
        this.loading = false;
        if (user) {
          this.success = 'Connecte en tant que ' + user.firstName + ' (' + user.role + '). Redirection...';
          setTimeout(() => this.routeByRole(user), 500);
        } else {
          this.error = 'Email ou mot de passe incorrect.';
          this.success = '';
        }
      },
      error: (e) => {
        this.loading = false;
        this.error = 'Module User indisponible (port 8081). Erreur: ' + (e?.message || e?.status || 'inconnue');
        this.success = '';
      },
    });
  }

  private routeByRole(user: MockUser) {
    if (user.role === 'MEMBRE_SIMPLE') {
      this.router.navigateByUrl('/treasury/espace-membre');
    } else {
      this.router.navigateByUrl('/treasury');
    }
  }
}
