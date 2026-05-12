import { Injectable, NgZone } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class SessionGuardService {

  private intervalId: any;

  constructor(
    private authService: AuthService,
    private router: Router,
    private ngZone: NgZone
  ) {}

  startWatching(): void {
    // Check every 5 minutes using only the local expiry timestamp — no server call
    this.intervalId = setInterval(() => {
      if (!this.authService.isLoggedIn()) {
        this.ngZone.run(() => {
          clearInterval(this.intervalId);
          alert('⚠️ Session expirée ! Veuillez vous reconnecter.');
          this.router.navigate(['/signin']);
        });
      }
    }, 5 * 60 * 1000);
  }

  stopWatching(): void {
    if (this.intervalId) clearInterval(this.intervalId);
  }
}