import { Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AiFeedbackSummary,
  AiSummaryDisabled,
  AiSummaryEmpty,
  EventFeedbackService,
} from '../../services/event-feedback.service';

/**
 * Modal that asks the backend (which calls Gemini) for an executive summary
 * of all the feedback rows on a given event.
 *
 * Three rendering states:
 *   - "loading"    while the request is in flight
 *   - "disabled"   if the backend has no API key (graceful degradation)
 *   - "empty"      if the event has no feedbacks yet
 *   - "ready"      regular case — show the structured summary
 *
 * The component never tries to "interpret" the LLM output: every field is
 * either rendered verbatim or hidden if missing. This keeps it robust to
 * minor schema drift from the model.
 */
@Component({
  selector: 'app-ai-feedback-summary-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="ai-backdrop" *ngIf="open" (click)="close.emit()">
      <div class="ai-modal" (click)="$event.stopPropagation()">
        <header class="ai-head">
          <div>
            <div class="ai-eyebrow">
              <span class="ai-spark">✨</span> AI feedback summary
              <span class="ai-model" *ngIf="data?.source === 'llm'">{{ data!.model }}</span>
            </div>
            <h3 class="ai-title">{{ eventTitle || 'Event feedback' }}</h3>
            <p class="ai-sub" *ngIf="data?.feedbackCount">
              based on {{ data!.feedbackCount }} attendee response{{ data!.feedbackCount === 1 ? '' : 's' }}
            </p>
          </div>
          <button type="button" class="ai-close" (click)="close.emit()">×</button>
        </header>

        <div class="ai-body">
          <div *ngIf="loading" class="ai-loading">
            <div class="spinner"></div>
            Asking the model… this usually takes a few seconds.
          </div>

          <div *ngIf="disabled" class="ai-empty">
            <h4>AI summary not configured</h4>
            <p>{{ disabledMessage }}</p>
            <p class="ai-hint">
              Get a free key on <a href="https://aistudio.google.com/apikey" target="_blank">Google AI Studio</a>
              and set <code>gemini.api-key</code> in the backend.
            </p>
          </div>

          <div *ngIf="emptyState" class="ai-empty">
            <h4>No feedback yet</h4>
            <p>{{ emptyMessage }}</p>
          </div>

          <ng-container *ngIf="ready && summary as s">
            <!-- Executive summary -->
            <section class="ai-section ai-hero">
              <div class="ai-section-title">Executive summary</div>
              <p class="ai-exec">{{ s.executive_summary }}</p>

              <div class="ai-sentiment" *ngIf="s.sentiment as st">
                <span class="ai-sent-label" [class]="'sent-' + st.label">{{ st.label }}</span>
                <div class="ai-sent-bar">
                  <div class="ai-sent-fill" [class]="'fill-' + st.label" [style.width.%]="st.score"></div>
                </div>
                <span class="ai-sent-score">{{ st.score }}/100</span>
              </div>

              <p class="ai-repeat" *ngIf="s.would_repeat_signal">
                🔁 {{ s.would_repeat_signal }}
              </p>
            </section>

            <!-- Dimension highlights -->
            <section class="ai-section" *ngIf="s.dimension_highlights?.length">
              <div class="ai-section-title">Dimension highlights</div>
              <div class="ai-dims">
                <div class="ai-dim" *ngFor="let d of s.dimension_highlights">
                  <div class="ai-dim-head">
                    <span class="ai-dim-name">{{ d.dimension }}</span>
                    <span class="ai-dim-avg" [class]="dimClass(d.average)">{{ d.average }}/5</span>
                  </div>
                  <p class="ai-dim-cmt">{{ d.comment }}</p>
                </div>
              </div>
            </section>

            <!-- Recurring themes -->
            <section class="ai-section" *ngIf="s.recurring_themes?.length">
              <div class="ai-section-title">Recurring themes</div>
              <ul class="ai-themes">
                <li *ngFor="let t of s.recurring_themes" [class]="'theme-' + t.polarity">
                  <div class="ai-theme-head">
                    <span class="ai-theme-name">{{ t.theme }}</span>
                    <span class="ai-theme-mentions">{{ t.mentions }}× mentions</span>
                  </div>
                  <blockquote *ngIf="t.sample_quote">"{{ t.sample_quote }}"</blockquote>
                </li>
              </ul>
            </section>

            <!-- Praise / Pain points -->
            <div class="ai-twocol">
              <section class="ai-section ai-praise" *ngIf="s.praise?.length">
                <div class="ai-section-title">👍 What worked</div>
                <ul><li *ngFor="let p of s.praise">{{ p }}</li></ul>
              </section>
              <section class="ai-section ai-pain" *ngIf="s.pain_points?.length">
                <div class="ai-section-title">👎 Pain points</div>
                <ul><li *ngFor="let p of s.pain_points">{{ p }}</li></ul>
              </section>
            </div>

            <!-- Action items -->
            <section class="ai-section ai-actions" *ngIf="s.action_items?.length">
              <div class="ai-section-title">🎯 Recommended actions</div>
              <ol>
                <li *ngFor="let a of s.action_items">{{ a }}</li>
              </ol>
            </section>

            <p class="ai-footer-note">
              Generated by {{ data!.model }} · grounded in {{ data!.feedbackCount }} feedback entries.
              The model can occasionally over-generalise — cross-check key findings.
            </p>
          </ng-container>

          <div *ngIf="errorMessage" class="ai-error">
            <p>⚠️ {{ errorMessage }}</p>
            <button type="button" class="ai-retry" (click)="reload()">Retry</button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .ai-backdrop {
      position: fixed; inset: 0; background: rgba(15,23,42,.65);
      backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center;
      z-index: 1450; padding: 20px;
    }
    .ai-modal {
      background: white; border-radius: 18px; box-shadow: 0 25px 60px rgba(0,0,0,.3);
      width: 100%; max-width: 720px; max-height: 92vh; overflow: hidden;
      display: flex; flex-direction: column;
    }
    .ai-head {
      padding: 18px 22px; border-bottom: 1px solid #f1f5f9;
      display: flex; gap: 12px; background: linear-gradient(135deg, #f5f3ff, #eff6ff);
    }
    .ai-eyebrow {
      font-size: .68rem; font-weight: 700; text-transform: uppercase; letter-spacing: .06em;
      color: #6366f1; display: flex; align-items: center; gap: 6px;
    }
    .ai-model {
      background: white; border: 1px solid #c7d2fe;
      padding: 1px 6px; border-radius: 999px; font-size: .6rem;
      color: #4338ca; text-transform: lowercase;
    }
    .ai-title { font-size: 1.18rem; font-weight: 700; margin: 4px 0 2px; color: #0f172a; }
    .ai-sub { font-size: .76rem; color: #64748b; margin: 0; }
    .ai-close {
      margin-left: auto; align-self: flex-start;
      width: 32px; height: 32px; border-radius: 50%; border: 1px solid #e2e8f0;
      background: white; color: #94a3b8; font-size: 1.4rem; cursor: pointer;
      display: flex; align-items: center; justify-content: center; line-height: 1;
    }
    .ai-close:hover { background: #fee2e2; color: #dc2626; }

    .ai-body { padding: 18px 22px; overflow-y: auto; }

    .ai-loading {
      display: flex; align-items: center; gap: 10px;
      color: #64748b; font-size: .85rem; padding: 30px 0; justify-content: center;
    }
    .spinner {
      width: 20px; height: 20px; border-radius: 50%;
      border: 2px solid #e2e8f0; border-top-color: #6366f1;
      animation: spin .9s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    .ai-empty {
      text-align: center; padding: 40px 20px; color: #64748b;
    }
    .ai-empty h4 { font-size: 1rem; color: #334155; margin: 0 0 6px; }
    .ai-empty p { margin: 4px 0; font-size: .85rem; }
    .ai-hint { font-size: .76rem; color: #94a3b8; margin-top: 12px; }
    .ai-hint code { background: #f1f5f9; padding: 1px 5px; border-radius: 4px; font-size: .72rem; }

    .ai-section {
      padding: 12px 0; border-bottom: 1px solid #f1f5f9;
    }
    .ai-section:last-of-type { border-bottom: none; }
    .ai-section-title {
      font-size: .72rem; font-weight: 700; text-transform: uppercase;
      letter-spacing: .04em; color: #475569; margin-bottom: 8px;
    }

    .ai-hero { background: linear-gradient(135deg, #fafaff, #f0f9ff); padding: 14px 16px; border-radius: 12px; border-bottom: none; margin-bottom: 6px; }
    .ai-exec { font-size: .92rem; line-height: 1.55; color: #1e293b; margin: 0 0 12px; }

    .ai-sentiment { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
    .ai-sent-label {
      font-size: .68rem; text-transform: uppercase; font-weight: 700; padding: 3px 10px;
      border-radius: 999px; letter-spacing: .04em;
    }
    .sent-positive { background: #d1fae5; color: #065f46; }
    .sent-mixed    { background: #fef9c3; color: #854d0e; }
    .sent-negative { background: #fee2e2; color: #991b1b; }
    .ai-sent-bar { flex: 1; height: 6px; background: #e2e8f0; border-radius: 3px; overflow: hidden; }
    .ai-sent-fill { height: 100%; transition: width .4s; }
    .fill-positive { background: linear-gradient(90deg, #34d399, #10b981); }
    .fill-mixed    { background: linear-gradient(90deg, #fbbf24, #f59e0b); }
    .fill-negative { background: linear-gradient(90deg, #f87171, #ef4444); }
    .ai-sent-score { font-size: .76rem; color: #475569; font-weight: 600; min-width: 50px; text-align: right; }

    .ai-repeat {
      background: white; border-left: 3px solid #818cf8; padding: 6px 10px;
      font-size: .82rem; color: #334155; margin: 0; border-radius: 4px;
    }

    .ai-dims { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 8px; }
    .ai-dim { background: #f8fafc; border-radius: 8px; padding: 8px 10px; }
    .ai-dim-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
    .ai-dim-name { font-weight: 600; font-size: .82rem; color: #1e293b; text-transform: capitalize; }
    .ai-dim-avg { font-size: .76rem; font-weight: 700; padding: 1px 7px; border-radius: 6px; }
    .dim-good { background: #d1fae5; color: #065f46; }
    .dim-mid  { background: #fef3c7; color: #92400e; }
    .dim-low  { background: #fee2e2; color: #991b1b; }
    .ai-dim-cmt { font-size: .72rem; color: #64748b; margin: 0; line-height: 1.35; }

    .ai-themes { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px; }
    .ai-themes li { padding: 8px 10px; border-radius: 8px; border: 1px solid; }
    .theme-positive { background: #ecfdf5; border-color: #6ee7b7; }
    .theme-negative { background: #fef2f2; border-color: #fca5a5; }
    .ai-theme-head { display: flex; justify-content: space-between; align-items: center; }
    .ai-theme-name { font-weight: 600; font-size: .85rem; color: #1e293b; text-transform: capitalize; }
    .ai-theme-mentions { font-size: .68rem; color: #64748b; }
    .ai-themes blockquote {
      margin: 4px 0 0; padding-left: 8px; border-left: 2px solid #94a3b8;
      font-style: italic; font-size: .76rem; color: #475569;
    }

    .ai-twocol { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    @media (max-width: 580px) { .ai-twocol { grid-template-columns: 1fr; } }
    .ai-praise ul, .ai-pain ul, .ai-actions ol {
      margin: 0; padding-left: 18px;
      display: flex; flex-direction: column; gap: 4px;
    }
    .ai-praise li, .ai-pain li, .ai-actions li {
      font-size: .82rem; line-height: 1.4;
    }
    .ai-praise li { color: #065f46; }
    .ai-pain li { color: #991b1b; }
    .ai-actions { background: #eff6ff; border-radius: 10px; padding: 12px 16px; margin-top: 6px; border-bottom: none; }
    .ai-actions li { color: #1e3a8a; font-weight: 500; }

    .ai-footer-note {
      font-size: .68rem; color: #94a3b8; text-align: center; margin: 12px 0 0;
      font-style: italic;
    }

    .ai-error {
      text-align: center; padding: 20px; color: #b91c1c; font-size: .85rem;
    }
    .ai-retry {
      margin-top: 8px; background: #ef4444; color: white; border: none;
      padding: 6px 14px; border-radius: 8px; cursor: pointer; font-size: .76rem; font-weight: 600;
    }
    .ai-retry:hover { background: #dc2626; }
  `]
})
export class AiFeedbackSummaryModalComponent implements OnChanges {
  @Input() open = false;
  @Input() eventId!: string;
  @Input() eventTitle?: string;
  @Output() close = new EventEmitter<void>();

  loading = false;
  data: AiFeedbackSummary | null = null;
  disabled = false;
  disabledMessage = '';
  emptyState = false;
  emptyMessage = '';
  errorMessage = '';

  constructor(private feedbackService: EventFeedbackService) {}

  get ready(): boolean { return !this.loading && !this.disabled && !this.emptyState && !!this.data; }
  get summary() { return this.data?.summary; }

  ngOnChanges(): void {
    if (this.open && this.eventId) {
      this.reload();
    }
  }

  reload(): void {
    this.loading = true;
    this.data = null;
    this.disabled = false;
    this.emptyState = false;
    this.errorMessage = '';

    this.feedbackService.aiSummary(this.eventId).subscribe({
      next: (res: any) => {
        this.loading = false;
        if (res && res.enabled === false) {
          this.disabled = true;
          this.disabledMessage = res.message || 'AI summary is not configured.';
        } else if (res && res.feedbackCount === 0) {
          this.emptyState = true;
          this.emptyMessage = res.message || 'No feedback yet for this event.';
        } else if (res && res.summary) {
          this.data = res as AiFeedbackSummary;
        } else {
          this.errorMessage = 'Unexpected response from the server.';
        }
      },
      error: (err) => {
        this.loading = false;
        if (err?.status === 404) {
          this.emptyState = true;
          this.emptyMessage = 'No feedback yet for this event.';
        } else if (err?.status === 503) {
          this.disabled = true;
          this.disabledMessage = err?.error?.message || 'AI summary is not configured.';
        } else {
          this.errorMessage = err?.error?.error || 'AI summary unavailable right now.';
        }
      }
    });
  }

  dimClass(avg: number): string {
    if (avg >= 4) return 'dim-good';
    if (avg >= 3) return 'dim-mid';
    return 'dim-low';
  }
}
