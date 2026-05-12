import { Component } from '@angular/core';

@Component({
    selector: 'app-faq-section',
    standalone: true,
    template: `
    <section id="faq" class="py-24 bg-white">
      <div class="max-w-3xl mx-auto px-6">
        <h2 class="text-4xl font-semibold tracking-tighter text-center mb-12">Frequently asked questions</h2>
        <!-- Add accordion later or simple list -->
        <p class="text-center text-zinc-500">FAQ content coming in next iteration...</p>
      </div>
    </section>
  `,
})
export class FaqSectionComponent {}