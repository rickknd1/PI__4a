import { Component } from '@angular/core';

@Component({
    selector: 'app-landing-footer',
    standalone: true,
    template: `
    <footer class="bg-zinc-950 text-zinc-400 py-16">
      <div class="max-w-7xl mx-auto px-6 text-center">
        <p class="text-sm">© 2026 ClubHub. Built for student leaders in Tunisia and beyond.</p>
      </div>
    </footer>
  `,
})
export class LandingFooterComponent {}