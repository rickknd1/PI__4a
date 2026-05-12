import {CommonModule} from "@angular/common";
import {Component} from "@angular/core";
import {RouterLink} from "@angular/router";
import {LandingNavbarComponent} from "./landing-navbar.component";
import {ProblemSectionComponent} from "./sections/problem-section.component";
import {FinalCtaSectionComponent} from "./sections/final-cta-section.component";
import {PricingSectionComponent} from "./sections/pricing-section.component";
import {HowItWorksSectionComponent} from "./sections/how-it-works-section.component";
import {FeaturesSectionComponent} from "./sections/features-section.component";
import {TestimonialsSectionComponent} from "./sections/testimonials-section.component";
import {FaqSectionComponent} from "./sections/faq-section.component";
import {LandingFooterComponent} from "./landing-footer.component";
@Component({
    selector: 'app-landing-page',
    standalone: true,
    imports: [
        CommonModule,
        RouterLink,
        LandingNavbarComponent,
        ProblemSectionComponent,
        FeaturesSectionComponent,
        HowItWorksSectionComponent,
        TestimonialsSectionComponent,
        PricingSectionComponent,
        FaqSectionComponent,
        FinalCtaSectionComponent,
        LandingFooterComponent,
    ],
    template: `
        <div class="min-h-screen bg-white">
            <app-landing-navbar />

            <main>
                <section class="bg-brand-950 text-white py-28 relative overflow-hidden">

                    <div class="absolute inset-0 z-0 pointer-events-none perspective-container">
                        <div class="scene-3d">
                            <div class="cube cube-1"></div>
                            <div class="cube cube-2"></div>
                            <div class="cube cube-3"></div>
                            <div class="grid-plane"></div>
                        </div>
                    </div>

                    <div class="max-w-7xl mx-auto px-6 text-center relative z-10">
                        <div class="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md px-5 py-2 rounded-full text-sm mb-8 border border-white/20">
                            The Operating System for Student Life
                        </div>

                        <h1 class="text-6xl md:text-7xl font-semibold tracking-tighter leading-none mb-8">
                            Your club deserves more<br>than a WhatsApp group.
                        </h1>

                        <p class="max-w-2xl mx-auto text-xl text-zinc-400 mb-12">
                            Events, elections, treasury, members, and communication — all in one professional platform.
                        </p>

                        <div class="flex flex-col sm:flex-row gap-4 justify-center">
                            <a routerLink="/signup"
                               class="inline-flex items-center justify-center bg-brand-500 hover:bg-brand-600 transition-colors text-white px-10 py-4 rounded-2xl font-semibold text-lg shadow-xl shadow-brand-500/20">
                                Start your club for free
                            </a>
                            <a href="#pricing"
                               class="inline-flex items-center justify-center border border-white/30 hover:border-white/60 transition-colors text-white px-10 py-4 rounded-2xl font-semibold text-lg">
                                View pricing
                            </a>
                        </div>
                    </div>
                </section>

                <app-problem-section />
                <app-features-section />
                <app-how-it-works-section />
                <app-testimonials-section />
                <app-pricing-section />
                <app-faq-section />
                <app-final-cta-section />
            </main>

            <app-landing-footer />
        </div>
    `,
    styles: [`
        .perspective-container {
            perspective: 1000px;
            display: flex;
            justify-content: center;
            align-items: center;
        }

        .scene-3d {
            width: 100%;
            height: 100%;
            position: relative;
            transform-style: preserve-3d;
            animation: sceneRotate 30s linear infinite;
        }

        /* 3D Floating Cubes (Glassmorphism style) */
        .cube {
            position: absolute;
            width: 100px;
            height: 100px;
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(5px);
            transform-style: preserve-3d;
            animation: float 10s ease-in-out infinite alternate;
        }

        .cube-1 { top: 10%; left: 15%; transform: rotateX(45deg) rotateY(45deg); }
        .cube-2 { bottom: 15%; right: 10%; transform: rotateX(-20deg) rotateY(30deg); animation-delay: -2s; width: 150px; height: 150px; }
        .cube-3 { top: 40%; right: 20%; transform: rotateZ(15deg); animation-delay: -5s; width: 60px; height: 60px; }

        /* Animated 3D Grid Plane */
        .grid-plane {
            position: absolute;
            width: 200%;
            height: 200%;
            background-image:
                    linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px),
                    linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px);
            background-size: 50px 50px;
            transform: rotateX(70deg) translateZ(-200px);
            top: 0;
            left: -50%;
            mask-image: radial-gradient(ellipse at center, black, transparent 70%);
        }

        @keyframes sceneRotate {
            0% { transform: rotateY(0deg); }
            100% { transform: rotateY(360deg); }
        }

        @keyframes float {
            0% { transform: translateZ(0px) rotateX(45deg) rotateY(45deg); }
            100% { transform: translateZ(100px) rotateX(60deg) rotateY(20deg); }
        }

        /* Responsive Fix: Slow down or hide on small screens if too busy */
        @media (max-width: 768px) {
            .scene-3d { animation-play-state: paused; opacity: 0.5; }
        }
    `]
})
export class LandingPageComponent {}