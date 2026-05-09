import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { Toast, ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-toast-container',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="toast-stack" aria-live="polite" aria-atomic="true">
      <div *ngFor="let t of toasts; trackBy: trackById"
           class="toast"
           [attr.data-severity]="t.severity"
           role="alert"
           (click)="dismiss(t.id)">
        <span class="toast-icon">{{ icon(t.severity) }}</span>
        <span class="toast-message">{{ t.message }}</span>
        <button type="button" class="toast-close" (click)="dismiss(t.id); $event.stopPropagation()" aria-label="Fermer">×</button>
      </div>
    </div>
  `,
  styles: [`
    .toast-stack {
      position: fixed;
      top: 1rem;
      right: 1rem;
      z-index: 99999;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      pointer-events: none;
      max-width: min(420px, calc(100vw - 2rem));
    }
    .toast {
      pointer-events: auto;
      display: flex;
      align-items: flex-start;
      gap: 0.5rem;
      padding: 0.75rem 0.9rem;
      border-radius: 0.5rem;
      box-shadow: 0 6px 20px rgba(0,0,0,0.18);
      background: white;
      border-left: 4px solid #3b82f6;
      font-size: 0.875rem;
      line-height: 1.35;
      animation: toast-in 180ms ease-out;
      cursor: pointer;
    }
    @keyframes toast-in {
      from { opacity: 0; transform: translateY(-6px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .toast[data-severity="success"] { border-left-color: #10b981; background: #ecfdf5; }
    .toast[data-severity="error"]   { border-left-color: #ef4444; background: #fef2f2; }
    .toast[data-severity="warning"] { border-left-color: #f59e0b; background: #fffbeb; }
    .toast[data-severity="info"]    { border-left-color: #3b82f6; background: #eff6ff; }
    .toast-icon { flex: 0 0 auto; font-size: 1.05rem; }
    .toast-message { flex: 1 1 auto; white-space: pre-line; word-break: break-word; }
    .toast-close {
      flex: 0 0 auto;
      background: transparent;
      border: 0;
      color: inherit;
      font-size: 1.15rem;
      cursor: pointer;
      opacity: 0.55;
      padding: 0 0.25rem;
    }
    .toast-close:hover { opacity: 1; }
  `]
})
export class ToastContainerComponent implements OnInit, OnDestroy {
  toasts: Toast[] = [];
  private sub?: Subscription;

  constructor(private toast: ToastService) {}

  ngOnInit(): void {
    this.sub = this.toast.toasts$.subscribe(list => this.toasts = list);
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  dismiss(id: number): void { this.toast.dismiss(id); }

  trackById(_: number, t: Toast): number { return t.id; }

  icon(sev: string): string {
    switch (sev) {
      case 'success': return '✅';
      case 'error':   return '❌';
      case 'warning': return '⚠️';
      default:        return 'ℹ️';
    }
  }
}
