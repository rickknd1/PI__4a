import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
    selector: 'app-pricing-section',
    standalone: true,
    imports: [CommonModule, RouterLink],
    template: `
        <section class="py-24 bg-zinc-50 relative overflow-hidden">
            <div class="absolute top-0 left-1/4 w-64 h-64 bg-brand-500/5 rounded-full blur-3xl"></div>
            <div class="absolute bottom-0 right-1/4 w-96 h-96 bg-amber-400/5 rounded-full blur-3xl"></div>

            <div class="max-w-7xl mx-auto px-6 relative z-10">
                <div class="text-center mb-20">
                    <h2 class="text-6xl font-bold tracking-tighter text-zinc-950">Simple, transparent pricing</h2>
                    <p class="mt-4 text-xl text-zinc-600">Start free. Grow when you're ready.</p>
                </div>

                <div class="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto perspective-2000">

                    <div class="pricing-card group relative bg-white rounded-[2.5rem] p-10 border border-zinc-200 transition-all duration-500 hover:shadow-2xl">
                        <div class="text-sm uppercase tracking-[0.2em] text-zinc-400 font-bold mb-6">Starter</div>
                        <div class="text-6xl font-bold mb-1 tracking-tight text-zinc-950">Free</div>
                        <div class="text-zinc-400 font-medium mb-8">Forever</div>

                        <ul class="space-y-5 mb-12">
                            <li class="flex items-center gap-3 text-zinc-600">
                                <span class="w-5 h-5 flex items-center justify-center rounded-full bg-zinc-100 text-zinc-900 text-xs">✓</span>
                                Member management (50)
                            </li>
                            <li class="flex items-center gap-3 text-zinc-600">
                                <span class="w-5 h-5 flex items-center justify-center rounded-full bg-zinc-100 text-zinc-900 text-xs">✓</span>
                                Events & Announcements
                            </li>
                            <li class="flex items-center gap-3 text-zinc-600">
                                <span class="w-5 h-5 flex items-center justify-center rounded-full bg-zinc-100 text-zinc-900 text-xs">✓</span>
                                Basic elections
                            </li>
                        </ul>

                        <a routerLink="/signup"
                           class="block w-full text-center py-4 border-2 border-zinc-900 rounded-2xl font-bold text-zinc-900 hover:bg-zinc-900 hover:text-white transition-all duration-300">
                            Get started free
                        </a>
                    </div>

                    <div class="pricing-card pro-featured group relative bg-zinc-950 rounded-[2.5rem] p-10 border-2 border-brand-500 shadow-2xl shadow-brand-500/20 transform md:scale-105 z-20">
                        <div class="absolute -top-5 left-1/2 -translate-x-1/2 bg-brand-500 text-white text-xs font-bold uppercase tracking-widest px-6 py-2 rounded-full shadow-lg">
                            Most popular
                        </div>

                        <div class="text-sm uppercase tracking-[0.2em] text-brand-400 font-bold mb-6">Pro</div>
                        <div class="flex items-baseline gap-2 mb-1">
                            <span class="text-6xl font-bold text-white tracking-tight">29</span>
                            <span class="text-zinc-400 font-bold text-xl">DT / month</span>
                        </div>
                        <div class="text-brand-500/80 font-medium mb-8">Full management suite</div>

                        <ul class="space-y-5 mb-12">
                            <li class="flex items-center gap-3 text-zinc-300">
                                <span class="w-5 h-5 flex items-center justify-center rounded-full bg-brand-500 text-white text-xs">✓</span>
                                Unlimited members
                            </li>
                            <li class="flex items-center gap-3 text-zinc-300">
                                <span class="w-5 h-5 flex items-center justify-center rounded-full bg-brand-500 text-white text-xs">✓</span>
                                Treasury & Advanced Analytics
                            </li>
                            <li class="flex items-center gap-3 text-zinc-300">
                                <span class="w-5 h-5 flex items-center justify-center rounded-full bg-brand-500 text-white text-xs">✓</span>
                                AI Smart Summaries
                            </li>
                        </ul>

                        <button class="block w-full bg-brand-500 hover:bg-brand-400 text-white py-4 rounded-2xl font-bold transition-all duration-300 shadow-lg shadow-brand-500/30">
                            Start 14-day Pro trial
                        </button>
                    </div>

                    <div class="pricing-card group relative bg-white rounded-[2.5rem] p-10 border border-zinc-200 transition-all duration-500 hover:shadow-2xl">
                        <div class="text-sm uppercase tracking-[0.2em] text-zinc-400 font-bold mb-6">Institution</div>
                        <div class="text-4xl font-bold mb-8 tracking-tight text-zinc-950">Custom</div>
                        <p class="text-zinc-500 leading-relaxed mb-12">For universities and student unions wanting centralized governance and compliance.</p>

                        <a href="#"
                           class="block w-full text-center py-4 border-2 border-zinc-900 rounded-2xl font-bold text-zinc-900 hover:bg-zinc-900 hover:text-white transition-all duration-300">
                            Book a Demo
                        </a>
                    </div>

                </div>
            </div>
        </section>
    `,
    styles: [`
        .perspective-2000 {
            perspective: 2000px;
        }

        .pricing-card {
            transform-style: preserve-3d;
            transition: transform 0.6s cubic-bezier(0.23, 1, 0.32, 1), box-shadow 0.6s ease;
        }

        /* Initial staggered tilt */
        .pricing-card:nth-child(1) { transform: rotateY(5deg) rotateX(2deg); }
        .pricing-card:nth-child(2) { transform: translateZ(20px); }
        .pricing-card:nth-child(3) { transform: rotateY(-5deg) rotateX(2deg); }

        /* Hover: Straighten and Pop out */
        .pricing-card:hover {
            transform: translateZ(60px) rotateY(0deg) rotateX(0deg) !important;
            z-index: 50;
        }

        /* Pro Card Breathing Glow */
        .pro-featured {
            animation: glow-pulse 4s infinite ease-in-out;
        }

        @keyframes glow-pulse {
            0%, 100% { box-shadow: 0 0 20px rgba(99, 102, 241, 0.1); }
            50% { box-shadow: 0 0 40px rgba(99, 102, 241, 0.3); }
        }

        /* Internal Parallax */
        .pricing-card:hover ul {
            transform: translateZ(30px);
            transition: transform 0.6s ease-out;
        }
        
        .pricing-card:hover .text-6xl {
            transform: translateZ(50px);
            transition: transform 0.6s ease-out;
        }
    `]
})
export class PricingSectionComponent {}