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
 * Bureau = membres du comité exécutif uniquement. COMMITTEE_MEMBER (membre
 * d'un comité opérationnel) et MEMBRE_SIMPLE + rôles custom tombent sur le
 * layout membre — c'est l'alignement avec la matrice RBAC de la sidebar
 * (cf. BUREAU_ROLES dans app-sidebar.component.ts).
 */
const BUREAU_ROLES = new Set([
  'PRESIDENT',
  'VICE_PRESIDENT',
  'TRESORIER',
  'SECRETAIRE_GENERALE',
  'RH',
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
