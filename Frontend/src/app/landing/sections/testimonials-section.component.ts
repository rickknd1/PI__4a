import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-testimonials-section',
    standalone: true,
    imports: [CommonModule],
    template: `
        <section class="py-24 bg-white relative overflow-hidden">
            <div class="absolute inset-0 z-0 opacity-40 mesh-bg"></div>

            <div class="max-w-7xl mx-auto px-6 relative z-10">
                <div class="text-center mb-20">
                    <h2 class="text-6xl font-bold tracking-tighter text-zinc-950">Trusted by leaders.</h2>
                </div>

                <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-8 perspective-2000">
                    <div *ngFor="let t of testimonials"
                         class="testimonial-card group relative">

                        <div class="relative bg-white border border-zinc-200 rounded-[2.5rem] p-10 h-full flex flex-col transition-all duration-500 hover:border-zinc-950 group-hover:-translate-y-4 group-hover:shadow-[0_40px_80px_-20px_rgba(0,0,0,0.15)]">

                            <div class="flex gap-1.5 mb-8">
                                <span *ngFor="let s of [1,2,3,4,5]" class="text-[#FFD700] text-lg">★</span>
                            </div>

                            <p class="text-2xl font-medium leading-[1.4] text-zinc-900 mb-10 flex-grow tracking-tight">
                                "{{ t.quote }}"
                            </p>

                            <div class="w-12 h-1 bg-zinc-100 mb-8 transition-all group-hover:w-full group-hover:bg-zinc-950 duration-500"></div>

                            <div class="flex items-center gap-5">
                                <div class="relative">
                                    <img [src]="t.avatar" class="w-14 h-14 rounded-2xl object-cover grayscale group-hover:grayscale-0 transition-all duration-500 shadow-sm">
                                    <div class="absolute -top-2 -right-2 bg-brand-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                                        <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
                                    </div>
                                </div>
                                <div>
                                    <div class="font-bold text-zinc-950 text-lg">{{ t.name }}</div>
                                    <div class="text-xs font-bold uppercase tracking-widest text-zinc-400 group-hover:text-brand-500 transition-colors">
                                        {{ t.role }} • {{ t.club }}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    `,
    styles: [`
        .perspective-2000 { perspective: 2000px; }

        .testimonial-card {
            transform-style: preserve-3d;
            transition: transform 0.5s cubic-bezier(0.23, 1, 0.32, 1);
        }

        /* Ambient Mesh Background */
        .mesh-bg {
            background-color: #ffffff;
            background-image:
                    radial-gradient(at 0% 0%, hsla(253,16%,7%,0.03) 0, transparent 50%),
                    radial-gradient(at 50% 0%, hsla(225,39%,30%,0.03) 0, transparent 50%),
                    radial-gradient(at 100% 0%, hsla(339,49%,30%,0.03) 0, transparent 50%);
        }

        /* Card Hover Depth */
        .testimonial-card:hover {
            transform: rotateX(5deg) rotateY(-2deg);
        }

        /* Subtle inner glow on hover */
        .testimonial-card:hover .relative {
            background: linear-gradient(135deg, #ffffff 0%, #fafafa 100%);
        }
    `]
})
export class TestimonialsSectionComponent {
    testimonials = [
        {
            quote: "We went from 3 missed events per semester to zero. Elections are now painless.",
            name: "Sarah Ben Ali",
            role: "President",
            club: "AIESEC Tunisia",
            avatar: 'https://picsum.photos/id/64/128/128'
        },
        {
            quote: "Treasury used to be a nightmare. Now everything is transparent and automatic.",
            name: "Youssef Karray",
            role: "Treasurer",
            club: "IEEE Student Branch",
            avatar: 'https://picsum.photos/id/91/128/128'
        },
        {
            quote: "Our members actually read announcements now. The platform feels premium.",
            name: "Leila Mansouri",
            role: "Vice President",
            club: "Debate Club ESSAT",
            avatar: 'https://picsum.photos/id/1005/128/128'
        },
    ];
}