import { Component, HostListener, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService, StoredUser } from '../../services/auth.service';
import { MemberFooterComponent } from './member-footer.component';

interface NavLink {
  label: string;
  path: string;
  icon: string;
  /** When set, this link is a parent dropdown with `children` items. */
  children?: NavLink[];
}

/**
 * Layout dédié aux MEMBRE_SIMPLE.
 *
 * Pas de sidebar — top navbar inspirée de la landing page (sticky,
 * backdrop-blur, palette brand-500). Sur mobile : burger qui ouvre un
 * drawer plein écran. Profile dropdown avec logout.
 *
 * Le bureau (PRESIDENT, RH, etc.) reste sur AppLayoutComponent. Le switch
 * entre les deux est géré par RoleAwareLayoutComponent.
 */
@Component({
  selector: 'app-member-layout',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet, MemberFooterComponent],
  template: `
    <div class="min-h-screen bg-gradient-to-br from-zinc-50 via-white to-brand-50/30">
      <!-- Top navbar -->
      <nav class="border-b border-zinc-100 bg-white/85 backdrop-blur-xl sticky top-0 z-50 shadow-sm shadow-zinc-100/50">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <!-- Logo -->
          <a routerLink="/home" class="flex items-center gap-2.5 shrink-0 group">
            <div class="w-10 h-10 bg-gradient-to-br from-brand-500 to-brand-700 rounded-2xl flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-brand-500/30 transition group-hover:shadow-xl group-hover:shadow-brand-500/40">C</div>
            <span class="font-semibold tracking-tight text-xl text-zinc-900">ClubHub</span>
          </a>

          <!-- Desktop nav (md+) - 5 items max pour aerer -->
          <div class="hidden md:flex items-center gap-1">
            @for (link of navLinks; track link.label) {
              @if (!link.children) {
                <a [routerLink]="link.path" routerLinkActive="!text-brand-500 !bg-brand-50/70"
                   [routerLinkActiveOptions]="{ exact: link.path === '/home' }"
                   class="px-3.5 py-2 text-sm font-medium text-zinc-600 hover:text-zinc-900 rounded-xl transition">
                  {{ link.label }}
                </a>
              } @else {
                <div class="relative" (mouseenter)="openDropdown.set(link.label)" (mouseleave)="openDropdown.set(null)">
                  <button class="px-3.5 py-2 text-sm font-medium rounded-xl transition flex items-center gap-1"
                          [class.text-brand-500]="openDropdown() === link.label"
                          [class.bg-brand-50]="openDropdown() === link.label"
                          [class.text-zinc-600]="openDropdown() !== link.label">
                    {{ link.label }}
                    <svg class="w-3.5 h-3.5 transition-transform"
                         [class.rotate-180]="openDropdown() === link.label"
                         fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>
                    </svg>
                  </button>
                  @if (openDropdown() === link.label) {
                    <div class="absolute top-full left-0 pt-1 w-56">
                      <div class="bg-white border border-zinc-100 rounded-2xl shadow-xl shadow-zinc-300/30 py-2 overflow-hidden">
                        @for (child of link.children; track child.path) {
                          <a [routerLink]="child.path" routerLinkActive="text-brand-500 bg-brand-50"
                             class="block px-4 py-2.5 text-sm text-zinc-700 hover:text-brand-500 hover:bg-brand-50 transition">
                            {{ child.label }}
                          </a>
                        }
                      </div>
                    </div>
                  }
                </div>
              }
            }
          </div>

          <!-- Right side: profile + mobile burger -->
          <div class="flex items-center gap-2">
            <!-- Profile dropdown -->
            <div class="relative">
              <button (click)="profileOpen.set(!profileOpen())"
                      class="flex items-center gap-2 px-3 py-1.5 rounded-2xl hover:bg-zinc-100 transition">
                <div class="w-8 h-8 bg-gradient-to-br from-brand-500 to-brand-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                  {{ userInitials() }}
                </div>
                <span class="hidden md:inline text-sm font-medium text-zinc-700">{{ user()?.name || 'Membre' }}</span>
                <svg class="w-4 h-4 text-zinc-400 hidden md:inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
              </button>
              @if (profileOpen()) {
                <div class="absolute right-0 mt-2 w-56 bg-white border border-zinc-100 rounded-2xl shadow-xl shadow-zinc-200/50 py-2 z-50">
                  <div class="px-4 py-3 border-b border-zinc-100">
                    <p class="text-sm font-semibold text-zinc-900">{{ user()?.name }}</p>
                    <p class="text-xs text-zinc-500 truncate">{{ user()?.email }}</p>
                  </div>
                  <a routerLink="/profile" (click)="profileOpen.set(false)"
                     class="block px-4 py-2 text-sm text-zinc-700 hover:bg-brand-50 hover:text-brand-500 transition">
                    Mon profil
                  </a>
                  <button (click)="logout()"
                          class="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition">
                    Se déconnecter
                  </button>
                </div>
              }
            </div>

            <!-- Mobile burger (visible < md) -->
            <button (click)="mobileOpen.set(!mobileOpen())"
                    class="md:hidden p-2 rounded-xl hover:bg-zinc-100 transition"
                    aria-label="Menu">
              <svg class="w-6 h-6 text-zinc-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                @if (!mobileOpen()) {
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/>
                } @else {
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                }
              </svg>
            </button>
          </div>
        </div>

        <!-- Mobile drawer (visible < md) -->
        @if (mobileOpen()) {
          <div class="md:hidden border-t border-zinc-100 bg-white max-h-[calc(100vh-4rem)] overflow-y-auto">
            <div class="px-4 py-3 space-y-1">
              @for (link of navLinks; track link.path) {
                @if (!link.children) {
                  <a [routerLink]="link.path" (click)="mobileOpen.set(false)"
                     routerLinkActive="text-brand-500 bg-brand-50"
                     [routerLinkActiveOptions]="{ exact: link.path === '/home' }"
                     class="block px-4 py-3 rounded-xl text-sm font-medium text-zinc-700 hover:text-brand-500 hover:bg-brand-50 transition">
                    {{ link.label }}
                  </a>
                } @else {
                  <div class="space-y-1">
                    <p class="px-4 pt-2 pb-1 text-xs font-semibold uppercase tracking-wider text-zinc-400">{{ link.label }}</p>
                    @for (child of link.children; track child.path) {
                      <a [routerLink]="child.path" (click)="mobileOpen.set(false)"
                         routerLinkActive="text-brand-500 bg-brand-50"
                         class="block pl-7 pr-4 py-2 rounded-xl text-sm text-zinc-700 hover:text-brand-500 hover:bg-brand-50 transition">
                        {{ child.label }}
                      </a>
                    }
                  </div>
                }
              }
            </div>
          </div>
        }
      </nav>

      <!-- Page content -->
      <main class="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <router-outlet/>
      </main>

      <!-- Footer (charte landing) -->
      <app-member-footer/>
    </div>
  `,
})
export class MemberLayoutComponent implements OnInit {
  user = signal<StoredUser | null>(null);
  mobileOpen = signal(false);
  profileOpen = signal(false);
  openDropdown = signal<string | null>(null);

  /**
   * Items principaux (visible inline sur desktop). Maximum 5 pour rester aere.
   * Les autres options vont dans le dropdown "Plus".
   */
  navLinks: NavLink[] = [
    { label: 'Accueil',     path: '/home',     icon: 'home' },
    { label: 'Événements',  path: '/events',   icon: 'calendar' },
    {
      label: 'Boutique', path: '/products', icon: 'shop',
      children: [
        { label: 'Produits',  path: '/products', icon: '' },
        { label: 'Billets',   path: '/tickets',  icon: '' },
        { label: 'Panier',    path: '/cart',     icon: '' },
        { label: 'Commandes', path: '/orders',   icon: '' },
      ],
    },
    { label: 'Messages', path: '/messaging', icon: 'chat' },
    {
      label: 'Plus', path: '#', icon: 'more',
      children: [
        { label: 'Mes cotisations',     path: '/treasury/payer-cotisation', icon: '' },
        { label: 'Mes RSVP',            path: '/rsvp',                       icon: '' },
        { label: 'Canaux vocaux',       path: '/voice2/instant-voice',       icon: '' },
        { label: 'Événements virtuels', path: '/ameni/events',               icon: '' },
      ],
    },
  ];

  constructor(private auth: AuthService, private router: Router) {}

  ngOnInit() {
    this.user.set(this.auth.getCurrentUser());
  }

  userInitials(): string {
    const name = this.user()?.name || '';
    return name.split(' ').filter(Boolean).slice(0, 2).map(n => n[0]?.toUpperCase()).join('') || '?';
  }

  logout() {
    this.auth.logout();
    this.profileOpen.set(false);
    this.router.navigate(['/signin']);
  }

  /** Close any open dropdown when clicking outside the navbar. */
  @HostListener('document:click', ['$event'])
  onDocClick(ev: MouseEvent) {
    const target = ev.target as HTMLElement;
    if (!target.closest('button') && !target.closest('a') && !target.closest('[class*="absolute"]')) {
      this.profileOpen.set(false);
    }
  }
}
