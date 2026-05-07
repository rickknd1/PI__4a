import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { AppLayoutComponent } from '../app-layout/app-layout.component';
import { MemberLayoutComponent } from '../member-layout/member-layout.component';
import { AuthService } from '../../services/auth.service';

/**
 * Layout switcher : selon le rôle de l'utilisateur connecté, rend soit
 * AppLayoutComponent (sidebar TailAdmin) pour le bureau, soit
 * MemberLayoutComponent (top navbar landing-style) pour les membres simples.
 *
 * Les rôles sans privilège (MEMBRE_SIMPLE + tout rôle custom hors bureau)
 * tombent sur le layout membre. Les rôles bureau (PRESIDENT, VP, TRESORIER,
 * SECRETAIRE_GENERALE, RH, COMMITTEE_MEMBER) gardent la sidebar admin.
 */
const BUREAU_ROLES = new Set([
  'PRESIDENT',
  'VICE_PRESIDENT',
  'TRESORIER',
  'SECRETAIRE_GENERALE',
  'RH',
  'COMMITTEE_MEMBER',
]);

@Component({
  selector: 'app-role-aware-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, AppLayoutComponent, MemberLayoutComponent],
  template: `
    @if (isBureau()) {
      <app-layout/>
    } @else {
      <app-member-layout/>
    }
  `,
})
export class RoleAwareLayoutComponent implements OnInit {
  private role = signal<string>('');
  isBureau = computed(() => BUREAU_ROLES.has(this.role().toUpperCase()));

  constructor(private auth: AuthService) {}

  ngOnInit() {
    const u = this.auth.getCurrentUser();
    this.role.set(u?.role || '');
  }
}
