import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export type ToastSeverity = 'info' | 'success' | 'error' | 'warning';

export interface Toast {
  id: number;
  message: string;
  severity: ToastSeverity;
}

/**
 * Toast in-app — remplace les alert() natifs.
 *
 * Usage direct: inject(ToastService).success('Membre ajoute').
 * Usage indirect: window.alert(...) est override dans AppComponent et tombe ici.
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private subject = new BehaviorSubject<Toast[]>([]);
  private nextId = 1;
  readonly DEFAULT_DURATION_MS = 4000;

  toasts$: Observable<Toast[]> = this.subject.asObservable();

  show(message: string, severity: ToastSeverity = 'info', durationMs = this.DEFAULT_DURATION_MS): void {
    const id = this.nextId++;
    const toast: Toast = { id, message, severity };
    this.subject.next([...this.subject.value, toast]);
    if (durationMs > 0) {
      setTimeout(() => this.dismiss(id), durationMs);
    }
  }

  success(msg: string, durationMs?: number): void { this.show(msg, 'success', durationMs); }
  error(msg: string, durationMs?: number): void   { this.show(msg, 'error',   durationMs ?? 6000); }
  warning(msg: string, durationMs?: number): void { this.show(msg, 'warning', durationMs); }
  info(msg: string, durationMs?: number): void    { this.show(msg, 'info',    durationMs); }

  dismiss(id: number): void {
    this.subject.next(this.subject.value.filter(t => t.id !== id));
  }

  /**
   * Detecte la severite a partir du contenu du message.
   * Utilise par l'override de window.alert : la base de code utilise des
   * conventions emoji "❌"=erreur, "✅"=succes, "⚠️"=warning.
   */
  guessSeverity(message: string): ToastSeverity {
    if (!message) return 'info';
    const m = message.trim();
    if (m.includes('❌') || /\bErreur\b/i.test(m)) return 'error';
    if (m.includes('✅') || m.includes('🎉')) return 'success';
    if (m.includes('⚠️') || /\battention\b/i.test(m)) return 'warning';
    return 'info';
  }
}
