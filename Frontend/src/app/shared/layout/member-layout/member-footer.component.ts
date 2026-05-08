import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * Footer for member layout (front-office). Landing charte: zinc-950 bg,
 * brand-500 hover accents, link columns, bottom copyright + status.
 */
@Component({
  selector: 'app-member-footer',
  standalone: true,
  imports: [RouterLink],
  template: `
    <footer class="mt-16 bg-zinc-950 text-zinc-400">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <!-- Top: brand + columns -->
        <div class="grid grid-cols-1 gap-8 md:grid-cols-4 md:gap-10">
          <!-- Brand -->
          <div class="md:col-span-1">
            <a routerLink="/home" class="inline-flex items-center group">
              <img src="/images/logo/logo.png" alt="ClubHub"
                   class="h-12 w-auto brightness-0 invert opacity-90 transition group-hover:opacity-100" />
            </a>
            <p class="mt-4 text-sm text-zinc-500 leading-relaxed">
              The operating system for student organizations. Events, treasury,
              members &amp; communication — in one place.
            </p>
          </div>

          <!-- Member -->
          <div>
            <h3 class="text-xs font-semibold uppercase tracking-wider text-white mb-4">Member Area</h3>
            <ul class="space-y-2.5 text-sm">
              <li><a routerLink="/home" class="hover:text-brand-400 transition">Home</a></li>
              <li><a routerLink="/events" class="hover:text-brand-400 transition">Events</a></li>
              <li><a routerLink="/rsvp" class="hover:text-brand-400 transition">My RSVPs</a></li>
              <li><a routerLink="/treasury/payer-cotisation" class="hover:text-brand-400 transition">My Dues</a></li>
              <li><a routerLink="/messaging" class="hover:text-brand-400 transition">Messages</a></li>
            </ul>
          </div>

          <!-- Store -->
          <div>
            <h3 class="text-xs font-semibold uppercase tracking-wider text-white mb-4">Store</h3>
            <ul class="space-y-2.5 text-sm">
              <li><a routerLink="/products" class="hover:text-brand-400 transition">Products</a></li>
              <li><a routerLink="/tickets" class="hover:text-brand-400 transition">Tickets</a></li>
              <li><a routerLink="/cart" class="hover:text-brand-400 transition">Cart</a></li>
              <li><a routerLink="/orders" class="hover:text-brand-400 transition">My Orders</a></li>
            </ul>
          </div>

          <!-- Account -->
          <div>
            <h3 class="text-xs font-semibold uppercase tracking-wider text-white mb-4">Account</h3>
            <ul class="space-y-2.5 text-sm">
              <li><a routerLink="/profile" class="hover:text-brand-400 transition">My Profile</a></li>
              <li><a routerLink="/voice2/instant-voice" class="hover:text-brand-400 transition">Voice Channels</a></li>
              <li><a routerLink="/ameni/events" class="hover:text-brand-400 transition">Virtual Events</a></li>
              <li>
                <a href="mailto:support@clubhub.tn" class="hover:text-brand-400 transition">Contact Support</a>
              </li>
            </ul>
          </div>
        </div>

        <!-- Bottom: copyright + version + status -->
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
