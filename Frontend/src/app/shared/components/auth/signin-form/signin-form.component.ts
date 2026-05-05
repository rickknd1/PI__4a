import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../../../services/auth.service';

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

        if (response.clubId) {
          this.router.navigate(['/clubs', response.clubId]);
        } else if (response.role === 'PRESIDENT') {
          this.router.navigate(['/setup-club']);
        } else {
          // Membre sans clubId dans la réponse — essayer via getMe()
          this.authService.getMe().subscribe({
            next: (me: any) => {
              if (me.clubId) {
                this.router.navigate(['/clubs', me.clubId]);
              } else {
                this.router.navigate(['/']);
              }
            },
            error: () => this.router.navigate(['/'])
          });
        }
      },
      error: (err: any) => {
        this.loading = false;
        this.error = err.error || 'Email ou mot de passe incorrect';
      }
    });
  }
}