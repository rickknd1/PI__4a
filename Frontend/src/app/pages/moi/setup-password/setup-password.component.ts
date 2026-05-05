import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, AbstractControl, ValidationErrors } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { InvitationService } from '../../../services/invitation.service';

@Component({
  selector: 'app-setup-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './setup-password.component.html',
  styleUrls: ['./setup-password.component.css']
})
export class SetupPasswordComponent implements OnInit {
  setupForm: FormGroup;
  token: string = '';
  loading = false;
  validating = true;
  invitation: any = null;
  error = '';
  showPassword = false;
  showConfirmPassword = false;

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private invitationService: InvitationService
  ) {
    this.setupForm = this.fb.group({
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', Validators.required]
    }, { validators: this.passwordMatchValidator });
  }

  ngOnInit() {
    this.token = this.route.snapshot.queryParams['token'];
    if (!this.token) {
      this.error = 'Token manquant dans l\'URL';
      this.validating = false;
      return;
    }

    this.invitationService.validateToken(this.token).subscribe({
      next: (response: any) => {
        if (response.valid) {
          this.invitation = response.invitation;
          this.validating = false;
        } else {
          this.error = response.message || 'Token invalide';
          this.validating = false;
        }
      },
      error: (error: any) => {
        this.error = error.error?.message || 'Token invalide ou expiré';
        this.validating = false;
      }
    });
  }

  passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
    const password = control.get('password')?.value;
    const confirmPassword = control.get('confirmPassword')?.value;
    return password === confirmPassword ? null : { passwordMismatch: true };
  }

  togglePasswordVisibility() { this.showPassword = !this.showPassword; }
  toggleConfirmPasswordVisibility() { this.showConfirmPassword = !this.showConfirmPassword; }

  onSubmit() {
    if (this.setupForm.valid) {
      this.loading = true;
      this.invitationService.setupPassword(this.token, this.setupForm.value.password).subscribe({
        next: () => {
          alert('✅ Compte créé avec succès ! Vous pouvez maintenant vous connecter.');
          this.router.navigate(['/signin']);
        },
        error: (error: any) => {
          this.error = error.error?.message || 'Erreur lors de la création du compte';
          this.loading = false;
        }
      });
    }
  }
}
