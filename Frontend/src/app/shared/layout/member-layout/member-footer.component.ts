import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * Footer pour le layout membre (front-office). Charte landing : fond zinc-950,
 * accents brand-500 sur hover, layout en colonnes, copyright en bas.
 */
@Component({
  selector: 'app-member-footer',
  standalone: true,
  imports: [RouterLink],
  template: `
    <footer class="mt-16 bg-zinc-950 text-zinc-400">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <!-- Top : logo + colonnes -->
        <div class="grid grid-cols-1 gap-8 md:grid-cols-4 md:gap-10">
          <!-- Brand -->
          <div class="md:col-span-1">
            <a routerLink="/home" class="flex items-center gap-2.5 group">
              <div class="w-10 h-10 bg-gradient-to-br from-brand-500 to-brand-700 rounded-2xl flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-brand-500/30 transition group-hover:shadow-xl">C</div>
              <span class="font-semibold tracking-tight text-xl text-white">ClubHub</span>
            </a>
            <p class="mt-4 text-sm text-zinc-500 leading-relaxed">
              The operating system for student organizations. Events, treasury,
              members &amp; communication — in one place.
            </p>
          </div>

          <!-- Espace membre -->
          <div>
            <h3 class="text-xs font-semibold uppercase tracking-wider text-white mb-4">Espace membre</h3>
            <ul class="space-y-2.5 text-sm">
              <li><a routerLink="/home" class="hover:text-brand-400 transition">Accueil</a></li>
              <li><a routerLink="/events" class="hover:text-brand-400 transition">Événements</a></li>
              <li><a routerLink="/rsvp" class="hover:text-brand-400 transition">Mes RSVP</a></li>
              <li><a routerLink="/treasury/payer-cotisation" class="hover:text-brand-400 transition">Mes cotisations</a></li>
              <li><a routerLink="/messaging" class="hover:text-brand-400 transition">Messages</a></li>
            </ul>
          </div>

          <!-- Clubstore -->
          <div>
            <h3 class="text-xs font-semibold uppercase tracking-wider text-white mb-4">Clubstore</h3>
            <ul class="space-y-2.5 text-sm">
              <li><a routerLink="/products" class="hover:text-brand-400 transition">Produits</a></li>
              <li><a routerLink="/tickets" class="hover:text-brand-400 transition">Billets</a></li>
              <li><a routerLink="/cart" class="hover:text-brand-400 transition">Panier</a></li>
              <li><a routerLink="/orders" class="hover:text-brand-400 transition">Mes commandes</a></li>
            </ul>
          </div>

          <!-- Compte -->
          <div>
            <h3 class="text-xs font-semibold uppercase tracking-wider text-white mb-4">Compte</h3>
            <ul class="space-y-2.5 text-sm">
              <li><a routerLink="/profile" class="hover:text-brand-400 transition">Mon profil</a></li>
              <li><a routerLink="/voice2/instant-voice" class="hover:text-brand-400 transition">Canaux vocaux</a></li>
              <li><a routerLink="/ameni/events" class="hover:text-brand-400 transition">Événements virtuels</a></li>
              <li>
                <a href="mailto:support@clubhub.tn" class="hover:text-brand-400 transition">Contact support</a>
              </li>
            </ul>
          </div>
        </div>

        <!-- Bottom : copyright + version -->
        <div class="mt-12 pt-8 border-t border-zinc-800 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p class="text-xs text-zinc-500">
            © 2026 ClubHub. Built for student leaders in Tunisia and beyond.
          </p>
          <div class="flex items-center gap-4 text-xs text-zinc-500">
            <span>v1.0.0</span>
            <span class="w-1 h-1 rounded-full bg-zinc-700"></span>
            <span class="inline-flex items-center gap-1.5">
              <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              All systems operational
            </span>
          </div>
        </div>
      </div>
    </footer>
  `,
})
export class MemberFooterComponent {}
