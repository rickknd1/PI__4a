import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-signup-form',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './signup-form.component.html'
})
export class SignupFormComponent {
  showPassword = false;
  isChecked = false;
  fname = '';
  lname = '';
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

  onSignUp() {
    if (!this.fname || !this.lname || !this.email || !this.password) {
      this.error = 'Veuillez remplir tous les champs';
      return;
    }
    if (!this.isChecked) {
      this.error = 'Veuillez accepter les conditions';
      return;
    }
  
    this.loading = true;
    this.error = '';
  
    const registerPayload = {
      firstName: this.fname,
      lastName: this.lname,
      phoneNumber: '00000000',
      email: this.email,
      password: this.password,
      role: 'PRESIDENT', // ← CORRIGER ICI
      clubId: '',
      profilePhoto: ''
    };
  
    this.authService.register(registerPayload).subscribe({
      next: (response: any) => {
        const pendingUser = {
          id: response.userId,
          userId: response.userId,
          firstName: this.fname,
          lastName: this.lname,
          email: response.email,
          role: 'PRESIDENT', // ← CORRIGER ICI AUSSI
          token: response.token,
          clubId: response.clubId
        };
  
        localStorage.setItem('pendingUser', JSON.stringify(pendingUser));
        if (response.token) {
          localStorage.setItem('token', response.token);
        }
        
        this.loading = false;
        this.router.navigate(['/setup-club']);
      },
      error: (err: any) => {
        this.loading = false;
        this.error = err.error || 'Erreur lors de la création du compte';
      }
    });
  }
}