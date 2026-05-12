import { Component, OnInit } from '@angular/core';
import { SidebarService } from '../../services/sidebar.service';
import { CommonModule } from '@angular/common';
import { AppSidebarComponent } from '../app-sidebar/app-sidebar.component';
import { Router, RouterModule } from '@angular/router';
import { AppHeaderComponent } from '../app-header/app-header.component';
import { AuthService } from '../../../shared/services/auth.service';
import { MeetingPvService } from '../../services/meeting-pv.service';
import { AiChatbotComponent } from '../../../components/moi/ai-chatbot/ai-chatbot.component';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    AppHeaderComponent,
    AppSidebarComponent,
    AiChatbotComponent,
  ],
  templateUrl: './app-layout.component.html',
})

export class AppLayoutComponent implements OnInit {
  readonly isExpanded$;
  readonly isHovered$;
  readonly isMobileOpen$;

  /** PV reminder shown once per session for the SECRETAIRE_GENERALE. */
  pvToast: { count: number; visible: boolean } = { count: 0, visible: false };

  constructor(
    public sidebarService: SidebarService,
    private authService: AuthService,
    private pvService: MeetingPvService,
    private router: Router
  ) {
    this.isExpanded$ = this.sidebarService.isExpanded$;
    this.isHovered$ = this.sidebarService.isHovered$;
    this.isMobileOpen$ = this.sidebarService.isMobileOpen$;
  }

  ngOnInit(): void {
    // Only the secretary general gets this nudge, and only ONCE per browser
    // session — we use sessionStorage as a guard so navigating between pages
    // doesn't keep popping the toast.
    const user = this.authService.getCurrentUser();
    if (user?.role !== 'SECRETAIRE_GENERALE') return;
    if (sessionStorage.getItem('pvToastShown') === '1') return;

    this.pvService.getPending().subscribe({
      next: list => {
        if (list && list.length > 0) {
          this.pvToast = { count: list.length, visible: true };
          sessionStorage.setItem('pvToastShown', '1');
          // Auto-dismiss after 12s so it never gets in the user's way.
          setTimeout(() => this.pvToast.visible = false, 12000);
        }
      },
      error: () => { /* silent — this is a courtesy, not blocking */ }
    });
  }

  goToPv(): void {
    this.pvToast.visible = false;
    this.router.navigate(['/pv']);
  }

  dismissToast(): void {
    this.pvToast.visible = false;
  }

  get containerClasses() {
    return [
      'flex-1',
      'transition-all',
      'duration-300',
      'ease-in-out',
      (this.isExpanded$ || this.isHovered$) ? 'xl:ml-[290px]' : 'xl:ml-[90px]',
      this.isMobileOpen$ ? 'ml-0' : ''
    ];
  }
}
