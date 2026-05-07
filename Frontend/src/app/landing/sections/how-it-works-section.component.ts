import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-how-it-works-section',
    standalone: true,
    imports: [CommonModule],
    template: `
        <section class="py-24 bg-zinc-950 text-white relative overflow-hidden">

            <div class="absolute inset-0 z-0 pointer-events-none">
                <div class="bubble b-1"></div>
                <div class="bubble b-2"></div>
                <div class="bubble b-3"></div>
                <div class="bubble b-4"></div>
                <div class="bubble b-5"></div>
                <div class="bubble b-6"></div>
                <div class="bubble b-7"></div>
                <div class="bubble b-8"></div>
                <div class="bubble b-9"></div>
                <div class="bubble b-10"></div>
                <div class="bubble b-11"></div>
                <div class="bubble b-12"></div>
            </div>

            <div class="max-w-7xl mx-auto px-6 relative z-10">
                <div class="text-center mb-16">
                    <span class="text-brand-400 font-medium">3 steps. 10 minutes.</span>
                    <h2 class="text-5xl font-semibold tracking-tighter mt-3">From chaos to clarity</h2>
                </div>

                <div class="grid md:grid-cols-3 gap-10 max-w-5xl mx-auto">
                    <div class="relative group">
                        <div class="text-brand-500 text-7xl font-bold mb-6 transition-transform group-hover:-translate-y-2">01</div>
                        <h3 class="text-3xl font-semibold mb-4">Create your club</h3>
                        <p class="text-zinc-400 leading-relaxed">Sign up, name your club, and invite your board in under 5 minutes.</p>
                        <div class="absolute -bottom-6 left-8 w-px h-24 bg-gradient-to-b from-transparent via-zinc-700 to-transparent md:block hidden"></div>
                    </div>

                    <div class="relative group">
                        <div class="text-brand-500 text-7xl font-bold mb-6 transition-transform group-hover:-translate-y-2">02</div>
                        <h3 class="text-3xl font-semibold mb-4">Import & organize</h3>
                        <p class="text-zinc-400 leading-relaxed">Bring members from WhatsApp or Sheets. Set roles and start your first event or election.</p>
                        <div class="absolute -bottom-6 left-8 w-px h-24 bg-gradient-to-b from-transparent via-zinc-700 to-transparent md:block hidden"></div>
                    </div>

                    <div class="group">
                        <div class="text-brand-500 text-7xl font-bold mb-6 transition-transform group-hover:-translate-y-2">03</div>
                        <h3 class="text-3xl font-semibold mb-4">Lead with confidence</h3>
                        <p class="text-zinc-400 leading-relaxed">Run treasury, elections, and communication on one beautiful platform. Watch engagement soar.</p>
                    </div>
                </div>

                <div class="text-center mt-20">
                    <a routerLink="/signup"
                       class="inline-flex items-center justify-center bg-brand-500 hover:bg-brand-600 text-white px-10 py-4 rounded-2xl font-semibold text-lg transition-all hover:scale-105 shadow-xl shadow-brand-500/20">
                        Start for free
                    </a>
                </div>
            </div>
        </section>
    `,
    styles: [`
        .bubble {
            position: absolute;
            border-radius: 50%;
            filter: blur(2px);
            opacity: 0.3;
            border: 1px solid rgba(255,255,255,0.1);
            animation: float 20s infinite alternate ease-in-out, hue-shift 10s infinite linear;
            box-shadow: inset 0 0 20px rgba(255,255,255,0.1);
        }

        /* Color Shifting Animation */
        @keyframes hue-shift {
            0% { filter: hue-rotate(0deg) blur(2px); }
            100% { filter: hue-rotate(360deg) blur(2px); }
        }

        @keyframes float {
            0% { transform: translateY(0) translateX(0) scale(1); }
            100% { transform: translateY(-60px) translateX(30px) scale(1.1); }
        }

        /* Individual Bubble Settings */
        .b-1 { width: 80px; height: 80px; top: 10%; left: 5%; background: rgba(99, 102, 241, 0.4); animation-delay: 0s; }
        .b-2 { width: 120px; height: 120px; top: 60%; left: 15%; background: rgba(168, 85, 247, 0.4); animation-delay: -2s; }
        .b-3 { width: 60px; height: 60px; top: 40%; left: 45%; background: rgba(59, 130, 246, 0.4); animation-delay: -5s; }
        .b-4 { width: 100px; height: 100px; top: 15%; right: 10%; background: rgba(244, 63, 94, 0.4); animation-delay: -1s; }
        .b-5 { width: 150px; height: 150px; bottom: 5%; right: 20%; background: rgba(20, 184, 166, 0.4); animation-delay: -7s; }
        .b-6 { width: 70px; height: 70px; top: 80%; left: 40%; background: rgba(99, 102, 241, 0.4); animation-delay: -3s; }
        .b-7 { width: 90px; height: 90px; top: 25%; left: 25%; background: rgba(168, 85, 247, 0.4); animation-delay: -4s; }
        .b-8 { width: 130px; height: 130px; bottom: 20%; left: 2%; background: rgba(59, 130, 246, 0.4); animation-delay: -8s; }
        .b-9 { width: 50px; height: 50px; top: 50%; right: 40%; background: rgba(244, 63, 94, 0.4); animation-delay: -6s; }
        .b-10 { width: 110px; height: 110px; top: 5%; left: 50%; background: rgba(20, 184, 166, 0.4); animation-delay: -2.5s; }
        .b-11 { width: 85px; height: 85px; top: 75%; right: 5%; background: rgba(99, 102, 241, 0.4); animation-delay: -1.5s; }
        .b-12 { width: 140px; height: 140px; bottom: 40%; right: 25%; background: rgba(168, 85, 247, 0.4); animation-delay: -9s; }
    `]
})
export class HowItWorksSectionComponent {}