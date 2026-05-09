import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { RETURN_URL_KEY } from '../../../../guards/auth.guard';

@Component({
  selector: 'app-signin-form',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './signin-form.component.html',
  styles: ``
})
export class SigninFormComponent {
  showPassword = false;
  isChecked = false;
  email = '';
  password = '';
  loading = false;
  error = '';

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  onSignIn() {
    if (!this.email || !this.password) {
      this.error = 'Veuillez remplir tous les champs';
      return;
    }
    this.loading = true;
    this.error = '';

    this.authService.login({ email: this.email, password: this.password }).subscribe({
      next: (response: any) => {
        this.loading = false;
        console.log('✅ Login réussi:', response);

        // Deep link preservation : si l'authGuard a memorise une URL avant de
        // rediriger vers /signin (cas typique : QR code scan vers
        // /elections/scan/:token), on y revient apres login. Sinon, /home par
        // defaut (le PRESIDENT sans club va d'abord creer son club).
        let returnUrl: string | null = null;
        try { returnUrl = sessionStorage.getItem(RETURN_URL_KEY); } catch { /* noop */ }
        try { sessionStorage.removeItem(RETURN_URL_KEY); } catch { /* noop */ }

        if (returnUrl) {
          this.router.navigateByUrl(returnUrl);
        } else if (!response.clubId && response.role === 'PRESIDENT') {
          this.router.navigate(['/setup-club']);
        } else {
          this.router.navigate(['/home']);
        }
      },
      error: (err: any) => {
        this.loading = false;
        this.error = err.error || 'Email ou mot de passe incorrect';
      }
    });
  }
}