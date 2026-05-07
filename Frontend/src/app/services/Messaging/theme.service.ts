import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Theme } from '../../models/theme.model';

@Injectable({ providedIn: 'root' })
export class ThemeService {
    private currentTheme = new BehaviorSubject<Theme | null>(null);
    public currentTheme$ = this.currentTheme.asObservable();

    applyTheme(theme: Theme): void {
        if (!theme) return;

        this.currentTheme.next(theme);

        const root = document.documentElement;
        root.style.setProperty('--primary-color',   theme.primaryColor);
        root.style.setProperty('--accent-color',    theme.accentColor);
        root.style.setProperty('--bubble-color',    theme.bubbleColor);
        root.style.setProperty('--chat-background', theme.backgroundColor);

        this.applyContainerBackground(theme, root, 0);
    }

    private applyContainerBackground(theme: Theme, root: HTMLElement, attempt: number): void {
        const container = document.querySelector('.chat-container') as HTMLElement;

        if (!container) {
            if (attempt < 10) {
                setTimeout(() => this.applyContainerBackground(theme, root, attempt + 1), 100);
            }
            return;
        }

        if (theme.backgroundImageUrl) {
            root.style.setProperty('--bg-image', `url('${theme.backgroundImageUrl}')`);
            container.classList.add('has-bg-image');
            container.classList.remove('gradient');
            root.style.setProperty('--gradient-end', theme.backgroundColor);
            container.style.backgroundImage = `url('${theme.backgroundImageUrl}')`;
        } else if (theme.isGradient && theme.gradientEndColor) {
            root.style.setProperty('--bg-image', 'none');
            container.classList.remove('has-bg-image');
            root.style.setProperty('--gradient-end', theme.gradientEndColor);
            container.classList.add('gradient');
        } else {
            root.style.setProperty('--bg-image', 'none');
            container.classList.remove('has-bg-image');
            root.style.setProperty('--gradient-end', theme.backgroundColor);
            container.classList.remove('gradient');
        }
    }

    setInitialTheme(theme: Theme | null): void {
        if (theme) this.applyTheme(theme);
    }
}