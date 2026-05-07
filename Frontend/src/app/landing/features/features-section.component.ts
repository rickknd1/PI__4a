// src/app/landing/sections/features-section.component.ts

import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { getAllFeatures } from '../features/features.metadata';

@Component({
    selector: 'app-features-section',
    standalone: true,
    imports: [CommonModule, RouterLink],
    template: `
        <section class="py-24 bg-white overflow-hidden">
            <div class="max-w-7xl mx-auto px-6">
                <div class="text-center mb-16">
                    <span class="text-brand-500 font-medium">Powerful by design</span>
                    <h2 class="text-5xl font-semibold tracking-tighter mt-3">Everything your club actually needs</h2>
                </div>

                <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-12 perspective-2000">
                    <div *ngFor="let feature of features; let i = index"
                         class="flip-card group"
                         [style.animation-delay]="(i * 0.1) + 's'">
                        <div class="flip-card-inner">

                            <!-- Front Side -->
                            <div class="flip-card-front bg-white border border-zinc-100 rounded-3xl p-10 flex flex-col justify-center items-center text-center shadow-sm">
                                <div class="text-6xl mb-6 transform group-hover:scale-110 transition-transform">{{ feature.icon }}</div>
                                <h3 class="text-2xl font-semibold mb-3">{{ feature.title }}</h3>
                                <p class="text-zinc-400 text-sm italic">Hover to explore</p>
                            </div>

                            <!-- Back Side -->
                            <div class="flip-card-back bg-brand-950 text-white rounded-3xl p-10 flex flex-col justify-center border border-brand-500/30">
                                <div class="text-3xl mb-4 opacity-50">{{ feature.icon }}</div>
                                <h3 class="text-2xl font-semibold mb-4 text-brand-400">{{ feature.title }}</h3>
                                <p class="text-zinc-300 leading-relaxed mb-8">{{ feature.shortDesc }}</p>

                                <!-- Learn More Button - Dynamic Route -->
                                <div class="mt-auto">
                                    <a [routerLink]="['/features', feature.id]"
                                       class="inline-flex items-center gap-2 text-brand-400 hover:text-white font-medium transition-colors group/link">
                                        Learn more
                                        <span class="text-lg transform group-hover/link:translate-x-1 transition-transform">→</span>
                                    </a>
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

        .flip-card {
            background-color: transparent;
            height: 380px;
            cursor: pointer;
        }

        .flip-card-inner {
            position: relative;
            width: 100%;
            height: 100%;
            text-align: center;
            transition: transform 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            transform-style: preserve-3d;
        }

        .flip-card:hover .flip-card-inner {
            transform: rotateY(180deg);
        }

        .flip-card-front, .flip-card-back {
            position: absolute;
            width: 100%;
            height: 100%;
            -webkit-backface-visibility: hidden;
            backface-visibility: hidden;
            display: flex;
            flex-direction: column;
            box-shadow: 0 10px 30px -10px rgba(0,0,0,0.05);
        }

        .flip-card-front { z-index: 2; }
        .flip-card-back {
            transform: rotateY(180deg);
            z-index: 1;
        }

        .flip-card:hover .flip-card-back {
            box-shadow: 0 0 40px -10px rgba(99, 102, 241, 0.3);
        }

        /* Stagger animation on load */
        .flip-card {
            animation: fadeInUp 0.6s ease-out forwards;
            animation-fill-mode: both;
        }

        @keyframes fadeInUp {
            from {
                opacity: 0;
                transform: translateY(20px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        /* Smooth hover scale */
        .flip-card {
            transition: transform 0.3s ease-out;
        }

        .flip-card:hover {
            transform: translateY(-4px);
        }
    `]
})
export class FeaturesSectionComponent {
    features = getAllFeatures();
}