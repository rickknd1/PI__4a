import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
    selector: 'app-landing-navbar',
    standalone: true,
    imports: [RouterLink],
    template: `
    <nav class="border-b border-zinc-100 bg-white/80 backdrop-blur-lg sticky top-0 z-50">
      <div class="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 bg-brand-500 rounded-2xl flex items-center justify-center text-white font-bold text-xl">C</div>
          <span class="font-semibold tracking-tight text-2xl">ClubHub</span>
        </div>

        <div class="hidden md:flex items-center gap-10 text-sm font-medium">
          <a href="#features" class="hover:text-brand-500 transition">Features</a>
          <a href="#pricing" class="hover:text-brand-500 transition">Pricing</a>
          <a href="#how" class="hover:text-brand-500 transition">How it works</a>
        </div>

        <div class="flex items-center gap-4">
          <a routerLink="/signin" class="text-sm font-medium px-6 py-2.5 hover:text-brand-500 transition">Log in</a>
          <a routerLink="/signup"
             class="bg-brand-500 text-white px-6 py-2.5 rounded-2xl font-semibold text-sm hover:bg-brand-600 transition">
            Get started free
          </a>
        </div>
      </div>
    </nav>
  `,
})
export class LandingNavbarComponent {}