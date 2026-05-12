import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-problem-section',
    standalone: true,
    imports: [CommonModule],
    template: `
        <section class="py-24 bg-zinc-50 border-b border-zinc-100 overflow-hidden relative">
            <div class="absolute inset-0 opacity-[0.03] pointer-events-none chaos-grid"></div>

            <div class="max-w-7xl mx-auto px-6 relative z-10">
                <div class="max-w-3xl mx-auto text-center mb-16">
                    <div class="inline-flex items-center gap-2 bg-white px-4 py-1.5 rounded-full border border-zinc-200 text-sm text-zinc-500 mb-6">
                        <span class="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                        The old way is broken
                    </div>
                    <h2 class="text-5xl md:text-6xl font-semibold tracking-tighter text-zinc-950 mb-6">
                        Your club is running on chaos
                    </h2>
                    <p class="text-xl text-zinc-600">
                        WhatsApp groups that no one reads.<br>
                        Spreadsheets that break every election.<br>
                        Manual payments that get lost.<br>
                        <span class="text-red-600 font-medium italic">Club leaders burn out. Members disengage.</span>
                    </p>
                </div>

                <div class="grid md:grid-cols-3 gap-8 perspective-1000">
                    <div class="pain-card bg-white p-8 rounded-3xl border border-zinc-100 hover:border-red-200 transition-all duration-500 group">
                        <div class="text-4xl mb-6 group-hover:scale-110 transition-transform duration-500 group-hover:rotate-12">💬</div>
                        <h3 class="text-2xl font-semibold mb-3 group-hover:text-red-600 transition-colors">Chaotic Communication</h3>
                        <p class="text-zinc-600">Important announcements get buried in 200 unread WhatsApp messages. Members miss events. Engagement dies.</p>
                    </div>

                    <div class="pain-card bg-white p-8 rounded-3xl border border-zinc-100 hover:border-amber-200 transition-all duration-500 group">
                        <div class="text-4xl mb-6 group-hover:scale-110 transition-transform duration-500 group-hover:-rotate-12">📊</div>
                        <h3 class="text-2xl font-semibold mb-3 group-hover:text-amber-600 transition-colors">Manual Everything</h3>
                        <p class="text-zinc-600">Excel for treasury. Google Forms for elections. Paper lists for attendance. One mistake and everything collapses.</p>
                    </div>

                    <div class="pain-card bg-white p-8 rounded-3xl border border-zinc-100 hover:border-red-200 transition-all duration-500 group">
                        <div class="text-4xl mb-6 group-hover:scale-110 transition-transform duration-500 group-hover:rotate-12">😩</div>
                        <h3 class="text-2xl font-semibold mb-3 group-hover:text-red-600 transition-colors">Leader Burnout</h3>
                        <p class="text-zinc-600">Presidents spend more time on admin than actually leading. No one wants to take over next year.</p>
                    </div>
                </div>

                <div class="text-center mt-16">
                    <p class="text-zinc-400 text-sm font-mono tracking-widest uppercase animate-pulse">
                        System Overload: Transitioning to ClubHub...
                    </p>
                </div>
            </div>
        </section>
    `,
    styles: [`
        .perspective-1000 {
            perspective: 1200px;
        }

        .pain-card {
            transform-style: preserve-3d;
            cursor: pointer;
            box-shadow: 0 10px 30px -15px rgba(0,0,0,0.05);
        }

        /* The 3D Lift & Tilt Effect */
        .pain-card:hover {
            transform: translateY(-10px) rotateX(5deg) rotateY(-2deg);
            box-shadow: 0 20px 40px -20px rgba(220, 38, 38, 0.15); /* Red-tinted shadow on hover */
        }

        /* Chaotic background pattern */
        .chaos-grid {
            background-image: 
                radial-gradient(circle at 2px 2px, #000 1px, transparent 0);
            background-size: 40px 40px;
        }

        /* Animating the red text specifically on hover of the section */
        section:hover .text-red-600 {
            animation: glitch 0.3s cubic-bezier(.25,.46,.45,.94) both infinite;
            display: inline-block;
        }

        @keyframes glitch {
            0% { transform: translate(0) }
            20% { transform: translate(-2px, 2px) }
            40% { transform: translate(-2px, -2px) }
            60% { transform: translate(2px, 2px) }
            80% { transform: translate(2px, -2px) }
            100% { transform: translate(0) }
        }
    `]
})
export class ProblemSectionComponent {}