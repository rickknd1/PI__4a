import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-final-cta-section',
    standalone: true,
    imports: [RouterLink, CommonModule],
    template: `
        <section class="py-32 bg-zinc-950 text-white relative overflow-hidden perspective-2000">

            <div class="absolute inset-0 z-0 opacity-20">
                <div class="warp-grid"></div>
            </div>

            <div class="absolute inset-0 pointer-events-none">
                <div class="orb orb-1"></div>
                <div class="orb orb-2"></div>
            </div>

            <div class="max-w-4xl mx-auto px-6 relative z-10">
                <div class="cta-card group">

                    <div class="relative z-20 transition-transform duration-700 group-hover:translate-z-50">
                        <h2 class="text-6xl md:text-7xl font-bold tracking-tighter mb-8 bg-gradient-to-b from-white to-zinc-500 bg-clip-text text-transparent">
                            Ready to lead <br/> the future?
                        </h2>

                        <p class="text-xl md:text-2xl text-zinc-400 mb-12 max-w-2xl mx-auto leading-relaxed">
                            Join hundreds of student organizations already scaling with <span class="text-white font-semibold">ClubHub</span>.
                        </p>

                        <div class="flex flex-col md:flex-row items-center justify-center gap-6">
                            <a routerLink="/signup"
                               class="relative overflow-hidden group/btn inline-flex items-center justify-center bg-white text-zinc-950 px-14 py-6 rounded-[2rem] font-bold text-xl transition-all duration-300 hover:scale-110 active:scale-95 shadow-[0_0_40px_rgba(255,255,255,0.3)]">
                                <span class="relative z-10">Start your club for free</span>
                                <div class="absolute inset-0 bg-gradient-to-r from-brand-400 to-amber-400 opacity-0 group-hover/btn:opacity-20 transition-opacity"></div>
                            </a>
                        </div>

                        <div class="mt-8 text-zinc-500 font-mono text-sm tracking-widest uppercase">
                            No credit card • Unlimited members • 100% Student Focused
                        </div>
                    </div>

                    <div class="absolute inset-0 bg-white/[0.03] border border-white/[0.1] rounded-[4rem] backdrop-blur-2xl -z-10 transition-all duration-500 group-hover:bg-white/[0.05] group-hover:border-white/[0.2]"></div>
                </div>
            </div>
        </section>
    `,
    styles: [`
      .perspective-2000 { perspective: 2000px; }

      .cta-card {
        position: relative;
        padding: 80px 40px;
        transform-style: preserve-3d;
        transition: transform 0.8s cubic-bezier(0.23, 1, 0.32, 1);
      }

      /* Hover Effect: Card Tilts toward mouse (simulated) */
      .cta-card:hover {
        transform: rotateX(5deg) translateZ(20px);
      }

      .translate-z-50 {
        transform: translateZ(80px);
      }

      /* 3D Warp Grid */
      .warp-grid {
        position: absolute;
        width: 200%;
        height: 200%;
        top: -50%;
        left: -50%;
        background-image: 
          linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px);
        background-size: 50px 50px;
        transform: rotateX(60deg);
        animation: warp-move 20s linear infinite;
      }

      @keyframes warp-move {
        0% { transform: rotateX(60deg) translateY(0); }
        100% { transform: rotateX(60deg) translateY(50px); }
      }

      /* Floating Glowing Orbs */
      .orb {
        position: absolute;
        border-radius: 50%;
        filter: blur(80px);
        opacity: 0.2;
        animation: orb-float 10s infinite alternate ease-in-out;
      }

      .orb-1 {
        width: 400px; height: 400px;
        background: #6366f1;
        top: -100px; right: -100px;
      }

      .orb-2 {
        width: 300px; height: 300px;
        background: #f59e0b;
        bottom: -50px; left: -100px;
        animation-delay: -5s;
      }

      @keyframes orb-float {
        from { transform: translate(0, 0) scale(1); }
        to { transform: translate(50px, 30px) scale(1.2); }
      }
    `]
})
export class FinalCtaSectionComponent {}