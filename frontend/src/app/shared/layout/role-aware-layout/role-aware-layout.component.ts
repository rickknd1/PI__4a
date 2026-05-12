import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { Subscription } from 'rxjs';
import { AppLayoutComponent } from '../app-layout/app-layout.component';
import { MemberLayoutComponent } from '../member-layout/member-layout.component';
import { AuthService } from '../../services/auth.service';
import { CommitteeResponsableService } from '../../services/committee-responsable.service';

/**
 * Layout switcher : choisit le layout selon le ROLE GLOBAL et l'APPARTENANCE
 * AUX COMITES.
 *
 *   - Bureau executif (PRESIDENT/VP/TRESORIER/SECGEN/RH)  -> AppLayout (sidebar)
 *   - Responsable d'un comite (any subgroup)              -> AppLayout (sidebar)
 *   - Tout le reste (MEMBRE_SIMPLE, COMMITTEE_MEMBER non
 *     responsable, roles custom)                          -> MemberLayout (navbar)
 *
 * AVANT : seul le bureau executif arrivait sur AppLayout. Un user promu
 * "Responsable Events" gardait le role User=COMMITTEE_MEMBER et tombait sur
 * MemberLayout — il ne voyait pas la gestion d'evenements alors qu'il en a
 * la responsabilite. La verite "etre responsable" vient de
 * subGroup.responsableId / memberRoles[userId]=='RESPONSABLE' cote backend
 * et est servie par CommitteeResponsableService.
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
    @if (showBackOffice()) {
      <app-layout/>
    } @else {
      <app-member-layout/>
    }
  `,
})
export class RoleAwareLayoutComponent implements OnInit, OnDestroy {
  private role = signal<string>('');
  private isResponsable = signal<boolean>(false);

  /** True si bureau executif OU responsable d'un comite. */
  showBackOffice = computed(() =>
    BUREAU_ROLES.has(this.role().toUpperCase()) || this.isResponsable()
  );

  private sub?: Subscription;

  constructor(
    private auth: AuthService,
    private respService: CommitteeResponsableService,
  ) {}

  ngOnInit() {
    const u = this.auth.getCurrentUser();
    this.role.set(u?.role || '');
    console.log('[RoleAwareLayout] init role=', u?.role, 'showBackOffice=', this.showBackOffice());

    this.sub = this.respService.responsableStatus$.subscribe(status => {
      const before = this.isResponsable();
      this.isResponsable.set(status?.isResponsable === true);
      console.log('[RoleAwareLayout] responsableStatus=', status, 'isResponsable changed', before, '->', this.isResponsable(), 'showBackOffice=', this.showBackOffice());
    });

    this.auth.getMe?.().subscribe?.({
      next: (me: any) => {
        if (me?.role && me.role !== this.role()) {
          console.log('[RoleAwareLayout] getMe role updated', this.role(), '->', me.role);
          this.role.set(me.role);
          console.log('[RoleAwareLayout] showBackOffice after getMe=', this.showBackOffice());
        }
      },
      error: (err) => { console.error('[RoleAwareLayout] getMe failed', err); },
    });
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
  }
}
