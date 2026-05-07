import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { getFeature, getRelatedFeatures, FeatureData } from './features.metadata';

@Component({
    selector: 'app-feature-detail',
    standalone: true,
    imports: [CommonModule, RouterLink],
    template: `
        <div class="min-h-screen bg-white">
            <!-- Back Navigation -->
            <nav class="sticky top-0 z-50 bg-white/90 backdrop-blur-lg border-b border-zinc-100">
                <div class="max-w-7xl mx-auto px-6 py-5 flex items-center gap-4">
                    <button (click)="goBack()"
                            class="inline-flex items-center gap-2 text-zinc-600 hover:text-zinc-900 font-medium transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
                        </svg>
                        Back
                    </button>
                    <div class="flex-1"></div>
                    <a routerLink="/landing" class="text-zinc-600 hover:text-zinc-900 font-medium transition-colors">
                        All Features
                    </a>
                </div>
            </nav>

            <main *ngIf="feature; else notFound">
                <!-- Hero -->
                <section [ngClass]="getHeroClasses()" class="py-28 text-white relative overflow-hidden">
                    <div class="absolute inset-0 pointer-events-none">
                        <div [ngClass]="getAccentClasses()" class="absolute -top-20 -left-20 w-96 h-96 rounded-full blur-3xl opacity-30"></div>
                        <div [ngClass]="getAccentClassesLight()" class="absolute -bottom-20 -right-20 w-[500px] h-[500px] rounded-full blur-3xl opacity-20"></div>
                    </div>

                    <div class="max-w-5xl mx-auto px-6 relative z-10 text-center">
                        <div class="inline-flex items-center gap-3 bg-white/10 backdrop-blur-md px-6 py-2 rounded-full text-sm mb-8 border border-white/20">
                            {{ feature.badge }}
                        </div>

                        <h1 class="text-6xl md:text-7xl font-semibold tracking-tighter leading-none mb-8">
                            {{ feature.heroHeading }}
                        </h1>

                        <p class="text-xl md:text-2xl text-zinc-200 max-w-3xl mx-auto mb-12">
                            {{ feature.heroSubheading }}
                        </p>

                        <a [routerLink]="['/signup']"
                           class="inline-block px-12 py-5 rounded-3xl font-semibold text-lg transition-all hover:scale-105 active:scale-95"
                           [ngClass]="getCTAClasses()">
                            {{ feature.ctaText }}
                        </a>
                    </div>
                </section>

                <!-- Benefits -->
                <section class="py-24 bg-white">
                    <div class="max-w-7xl mx-auto px-6">
                        <h2 class="text-4xl font-semibold text-center tracking-tight mb-16">Why Clubs Love This Feature</h2>

                        <div class="grid md:grid-cols-2 gap-x-16 gap-y-14">
                            <div *ngFor="let benefit of feature.benefits" class="flex gap-7">
                                <div class="flex-shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center text-4xl"
                                     [ngClass]="getIconBgColor()">
                                    {{ benefit.icon }}
                                </div>
                                <div>
                                    <h3 class="text-2xl font-semibold mb-3">{{ benefit.title }}</h3>
                                    <p class="text-zinc-600 leading-relaxed">{{ benefit.desc }}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <!-- AI Features (Treasury only for now) -->
                <section *ngIf="feature.aiFeatures?.length" class="py-24 bg-zinc-950 text-white">
                    <div class="max-w-7xl mx-auto px-6">
                        <div class="text-center mb-16">
                            <h2 class="text-4xl font-semibold tracking-tighter mb-4">Built with Intelligent AI</h2>
                            <p class="text-zinc-400 max-w-xl mx-auto">Smart tools that make financial management effortless and secure.</p>
                        </div>

                        <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                            <div *ngFor="let ai of feature.aiFeatures"
                                 class="bg-white/5 border border-white/10 rounded-3xl p-8 hover:bg-white/10 transition-all">
                                <div class="text-5xl mb-6">{{ ai.icon }}</div>
                                <h3 class="text-2xl font-semibold mb-3">{{ ai.title }}</h3>
                                <p class="text-zinc-400 mb-6">{{ ai.desc }}</p>
                                <div *ngIf="ai.tech"
                                     class="text-xs font-mono bg-white/10 px-4 py-2 rounded-2xl inline-block">
                                    {{ ai.tech }}
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <!-- Workflow -->
                <section class="py-24 bg-zinc-50">
                    <div class="max-w-5xl mx-auto px-6">
                        <h2 class="text-4xl font-semibold text-center tracking-tight mb-16">{{ feature.workflowTitle }}</h2>

                        <div class="grid md:grid-cols-3 gap-10">
                            <div *ngFor="let step of feature.workflowSteps" class="text-center">
                                <div class="mx-auto w-20 h-20 rounded-3xl flex items-center justify-center text-4xl font-bold mb-6 shadow-inner"
                                     [ngClass]="getStepCounterClasses()">
                                    {{ step.number }}
                                </div>
                                <h3 class="font-semibold text-2xl mb-4">{{ step.title }}</h3>
                                <p class="text-zinc-600">{{ step.desc }}</p>
                            </div>
                        </div>
                    </div>
                </section>

                <!-- Related Features -->
                <section *ngIf="relatedFeatures.length" class="py-24 bg-white">
                    <div class="max-w-7xl mx-auto px-6">
                        <h2 class="text-center text-3xl font-semibold mb-4">Explore More Features</h2>
                        <p class="text-center text-zinc-500 mb-12">Powerful tools to run your entire club</p>

                        <div class="grid md:grid-cols-2 gap-8">
                            <a *ngFor="let related of relatedFeatures"
                               [routerLink]="['/features', related.id]"
                               class="group p-10 bg-white border border-zinc-100 rounded-3xl hover:border-brand-200 hover:shadow-xl transition-all">
                                <div class="text-5xl mb-6">{{ related.icon }}</div>
                                <h3 class="text-2xl font-semibold mb-3 group-hover:text-brand-500">{{ related.title }}</h3>
                                <p class="text-zinc-600 line-clamp-3">{{ related.shortDesc }}</p>
                                <div class="mt-6 text-brand-500 font-medium inline-flex items-center gap-2 group-hover:gap-3 transition-all">
                                    Learn more <span class="text-xl">→</span>
                                </div>
                            </a>
                        </div>
                    </div>
                </section>

                <!-- Final CTA -->
                <section class="py-28 text-center bg-zinc-950 text-white">
                    <div class="max-w-2xl mx-auto px-6">
                        <h2 class="text-5xl font-semibold tracking-tighter mb-6">Ready to run your club like a pro?</h2>
                        <a routerLink="/signup"
                           class="inline-block bg-white text-zinc-950 px-12 py-5 rounded-3xl font-semibold text-lg hover:bg-zinc-100 transition-all">
                            Start for free today
                        </a>
                    </div>
                </section>
            </main>

            <!-- Not Found -->
            <ng-template #notFound>
                <div class="min-h-[70vh] flex items-center justify-center text-center px-6">
                    <div>
                        <h2 class="text-4xl font-semibold mb-4">Feature not found</h2>
                        <a routerLink="/landing" class="text-brand-500 hover:underline text-lg">Return to all features</a>
                    </div>
                </div>
            </ng-template>
        </div>
    `
})
export class FeatureDetailComponent implements OnInit {
    feature?: FeatureData;
    relatedFeatures: FeatureData[] = [];

    constructor(
        private route: ActivatedRoute,
        private router: Router
    ) {}

    ngOnInit(): void {
        this.route.paramMap.subscribe(params => {
            const id = params.get('featureId');
            if (!id) {
                this.router.navigate(['/landing']);
                return;
            }

            this.feature = getFeature(id);

            if (!this.feature) {
                this.router.navigate(['/landing']);
                return;
            }

            this.relatedFeatures = getRelatedFeatures(id, 2);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    goBack(): void {
        window.history.back();
    }

    // Dynamic styling helpers
    getHeroClasses(): string {
        const map: Record<string, string> = {
            voice: 'bg-gradient-to-br from-brand-950 to-zinc-950',
            treasury: 'bg-gradient-to-br from-amber-950 to-amber-900',
            elections: 'bg-gradient-to-br from-purple-950 to-purple-900',
            events: 'bg-gradient-to-br from-blue-950 to-blue-900',
            comms: 'bg-gradient-to-br from-cyan-950 to-cyan-900',
            members: 'bg-gradient-to-br from-emerald-950 to-emerald-900'
        };
        return map[this.feature?.id || 'voice'] || 'bg-brand-950';
    }

    getAccentClasses(): string {
        const map: Record<string, string> = {
            voice: 'bg-brand-400',
            treasury: 'bg-amber-400',
            elections: 'bg-purple-400',
            events: 'bg-blue-400',
            comms: 'bg-cyan-400',
            members: 'bg-emerald-400'
        };
        return map[this.feature?.id || 'voice'] || 'bg-brand-400';
    }

    getAccentClassesLight(): string {
        const map: Record<string, string> = {
            voice: 'bg-brand-500/20',
            treasury: 'bg-amber-500/20',
            elections: 'bg-purple-500/20',
            events: 'bg-blue-500/20',
            comms: 'bg-cyan-500/20',
            members: 'bg-emerald-500/20'
        };
        return map[this.feature?.id || 'voice'] || 'bg-brand-500/20';
    }

    getCTAClasses(): string {
        const map: Record<string, string> = {
            voice: 'bg-brand-500 hover:bg-brand-600',
            treasury: 'bg-amber-500 hover:bg-amber-600',
            elections: 'bg-purple-500 hover:bg-purple-600',
            events: 'bg-blue-500 hover:bg-blue-600',
            comms: 'bg-cyan-500 hover:bg-cyan-600',
            members: 'bg-emerald-500 hover:bg-emerald-600'
        };
        return map[this.feature?.id || 'voice'] || 'bg-brand-500 hover:bg-brand-600';
    }

    getIconBgColor(): string {
        const map: Record<string, string> = {
            voice: 'bg-brand-100 text-brand-600',
            treasury: 'bg-amber-100 text-amber-600',
            elections: 'bg-purple-100 text-purple-600',
            events: 'bg-blue-100 text-blue-600',
            comms: 'bg-cyan-100 text-cyan-600',
            members: 'bg-emerald-100 text-emerald-600'
        };
        return map[this.feature?.id || 'voice'] || 'bg-brand-100 text-brand-600';
    }

    getStepCounterClasses(): string {
        const map: Record<string, string> = {
            voice: 'bg-brand-600 text-white',
            treasury: 'bg-amber-600 text-white',
            elections: 'bg-purple-600 text-white',
            events: 'bg-blue-600 text-white',
            comms: 'bg-cyan-600 text-white',
            members: 'bg-emerald-600 text-white'
        };
        return map[this.feature?.id || 'voice'] || 'bg-brand-600 text-white';
    }
}