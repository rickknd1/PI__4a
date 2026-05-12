import { Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  EventFeedbackService,
  SentimentBreakdown,
  SentimentDisabled,
  SentimentEmpty,
  SentimentItem,
} from '../../services/event-feedback.service';

/**
 * Lightweight modal that shows the custom-ML sentiment breakdown of an
 * event's feedback comments — backed by the local Logistic Regression
 * classifier (NOT the LLM). Differs from `app-ai-feedback-summary-modal`
 * in two ways:
 *   1. No prose / executive summary — just the numeric breakdown +
 *      grouped comment lists (positive / neutral / negative).
 *   2. Runs offline against an in-house scikit-learn model. No external
 *      API key, no Ollama dependency, deterministic.
 */
@Component({
  selector: 'app-feedback-sentiment-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="ms-backdrop" *ngIf="open" (click)="close.emit()">
      <div class="ms-modal" (click)="$event.stopPropagation()">
        <header class="ms-head">
          <div>
            <div class="ms-eyebrow">
              <span class="ms-spark">🧠</span> Feedback sentiment
              <span class="ms-model" *ngIf="data">custom ML</span>
            </div>
            <h3 class="ms-title">{{ eventTitle || 'Comment analysis' }}</h3>
            <p class="ms-sub" *ngIf="data">
              {{ data.count }} comment{{ data.count === 1 ? '' : 's' }} scored
            </p>
          </div>
          <button type="button" class="ms-close" (click)="close.emit()">×</button>
        </header>

        <div class="ms-body">
          <div *ngIf="loading" class="ms-loading">
            <div class="spinner"></div>
            Scoring comments…
          </div>

          <div *ngIf="disabled" class="ms-empty">
            <h4>Sentiment classifier unavailable</h4>
            <p>{{ disabledMessage }}</p>
            <p class="ms-hint">
              Start <code>ai-service/run.ps1</code> and ensure
              <code>pv_sentiment.pkl</code> exists (run
              <code>python train_sentiment.py</code> if not).
            </p>
          </div>

          <div *ngIf="emptyState" class="ms-empty">
            <h4>Nothing to score yet</h4>
            <p>{{ emptyMessage }}</p>
          </div>

          <ng-container *ngIf="ready && data as d">
            <!-- Aggregate bars -->
            <section class="ms-section">
              <div class="ms-section-title">Overall breakdown</div>
              <div class="ms-bars">
                <div class="ms-bar">
                  <div class="ms-bar-label"><span class="dot pos"></span> Positive</div>
                  <div class="ms-bar-track">
                    <div class="ms-bar-fill pos" [style.width.%]="d.percentPositive"></div>
                  </div>
                  <div class="ms-bar-val">{{ d.percentPositive }}% <span class="ms-bar-n">({{ d.positive }})</span></div>
                </div>
                <div class="ms-bar">
                  <div class="ms-bar-label"><span class="dot neu"></span> Neutral</div>
                  <div class="ms-bar-track">
                    <div class="ms-bar-fill neu" [style.width.%]="d.percentNeutral"></div>
                  </div>
                  <div class="ms-bar-val">{{ d.percentNeutral }}% <span class="ms-bar-n">({{ d.neutral }})</span></div>
                </div>
                <div class="ms-bar">
                  <div class="ms-bar-label"><span class="dot neg"></span> Negative</div>
                  <div class="ms-bar-track">
                    <div class="ms-bar-fill neg" [style.width.%]="d.percentNegative"></div>
                  </div>
                  <div class="ms-bar-val">{{ d.percentNegative }}% <span class="ms-bar-n">({{ d.negative }})</span></div>
                </div>
              </div>
            </section>

            <!-- Negative comments first — they need attention -->
            <section class="ms-section" *ngIf="negatives.length">
              <div class="ms-section-title ms-neg">👎 Needs attention ({{ negatives.length }})</div>
              <ul class="ms-comments">
                <li *ngFor="let c of negatives" class="ms-c neg">
                  <p class="ms-c-text">"{{ c.text }}"</p>
                  <span class="ms-c-conf">{{ formatConfidence(c.confidence) }}</span>
                </li>
              </ul>
            </section>

            <!-- Positives -->
            <section class="ms-section" *ngIf="positives.length">
              <div class="ms-section-title ms-pos">👍 Highlights ({{ positives.length }})</div>
              <ul class="ms-comments">
                <li *ngFor="let c of positives" class="ms-c pos">
                  <p class="ms-c-text">"{{ c.text }}"</p>
                  <span class="ms-c-conf">{{ formatConfidence(c.confidence) }}</span>
                </li>
              </ul>
            </section>

            <!-- Neutral, collapsed by default -->
            <section class="ms-section" *ngIf="neutrals.length">
              <div class="ms-section-title">
                ⚖️ Mixed / neutral ({{ neutrals.length }})
                <button type="button" class="ms-toggle" (click)="showNeutrals = !showNeutrals">
                  {{ showNeutrals ? 'hide' : 'show' }}
                </button>
              </div>
              <ul *ngIf="showNeutrals" class="ms-comments">
                <li *ngFor="let c of neutrals" class="ms-c neu">
                  <p class="ms-c-text">"{{ c.text }}"</p>
                  <span class="ms-c-conf">{{ formatConfidence(c.confidence) }}</span>
                </li>
              </ul>
            </section>

            <p class="ms-footer-note">
              Scored offline by {{ d.model }}. Confidence is the model's
              probability for the predicted class — low values mean the
              comment is borderline.
            </p>
          </ng-container>

          <div *ngIf="errorMessage" class="ms-error">
            <p>⚠️ {{ errorMessage }}</p>
            <button type="button" class="ms-retry" (click)="reload()">Retry</button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .ms-backdrop {
      position: fixed; inset: 0; background: rgba(15,23,42,.65);
      backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center;
      z-index: 1450; padding: 20px;
    }
    .ms-modal {
      background: white; border-radius: 18px; box-shadow: 0 25px 60px rgba(0,0,0,.3);
      width: 100%; max-width: 680px; max-height: 92vh; overflow: hidden;
      display: flex; flex-direction: column;
    }
    .ms-head {
      padding: 18px 22px; border-bottom: 1px solid #f1f5f9;
      display: flex; gap: 12px; background: linear-gradient(135deg, #ecfeff, #f0fdf4);
    }
    .ms-eyebrow {
      font-size: .68rem; font-weight: 700; text-transform: uppercase; letter-spacing: .06em;
      color: #0e7490; display: flex; align-items: center; gap: 6px;
    }
    .ms-model {
      background: white; border: 1px solid #a5f3fc;
      padding: 1px 6px; border-radius: 999px; font-size: .6rem;
      color: #0e7490; text-transform: lowercase;
    }
    .ms-title { font-size: 1.18rem; font-weight: 700; margin: 4px 0 2px; color: #0f172a; }
    .ms-sub { font-size: .76rem; color: #64748b; margin: 0; }
    .ms-close {
      margin-left: auto; align-self: flex-start;
      width: 32px; height: 32px; border-radius: 50%; border: 1px solid #e2e8f0;
      background: white; color: #94a3b8; font-size: 1.4rem; cursor: pointer;
      display: flex; align-items: center; justify-content: center; line-height: 1;
    }
    .ms-close:hover { background: #fee2e2; color: #dc2626; }

    .ms-body { padding: 18px 22px; overflow-y: auto; }

    .ms-loading {
      display: flex; align-items: center; gap: 10px;
      color: #64748b; font-size: .85rem; padding: 30px 0; justify-content: center;
    }
    .spinner {
      width: 20px; height: 20px; border-radius: 50%;
      border: 2px solid #e2e8f0; border-top-color: #0e7490;
      animation: spin .9s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    .ms-empty { text-align: center; padding: 40px 20px; color: #64748b; }
    .ms-empty h4 { font-size: 1rem; color: #334155; margin: 0 0 6px; }
    .ms-empty p { margin: 4px 0; font-size: .85rem; }
    .ms-hint { font-size: .76rem; color: #94a3b8; margin-top: 12px; }
    .ms-hint code { background: #f1f5f9; padding: 1px 5px; border-radius: 4px; font-size: .72rem; }

    .ms-section { padding: 12px 0; border-bottom: 1px solid #f1f5f9; }
    .ms-section:last-of-type { border-bottom: none; }
    .ms-section-title {
      font-size: .72rem; font-weight: 700; text-transform: uppercase;
      letter-spacing: .04em; color: #475569; margin-bottom: 10px;
      display: flex; align-items: center; gap: 6px;
    }
    .ms-neg { color: #991b1b; }
    .ms-pos { color: #065f46; }

    .ms-bars { display: flex; flex-direction: column; gap: 8px; }
    .ms-bar { display: grid; grid-template-columns: 110px 1fr 90px; gap: 10px; align-items: center; }
    .ms-bar-label { font-size: .8rem; color: #334155; display: flex; align-items: center; gap: 6px; font-weight: 500; }
    .dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
    .dot.pos { background: #10b981; }
    .dot.neu { background: #f59e0b; }
    .dot.neg { background: #ef4444; }
    .ms-bar-track { height: 10px; background: #f1f5f9; border-radius: 5px; overflow: hidden; }
    .ms-bar-fill { height: 100%; transition: width .4s; border-radius: 5px; }
    .ms-bar-fill.pos { background: linear-gradient(90deg, #34d399, #10b981); }
    .ms-bar-fill.neu { background: linear-gradient(90deg, #fbbf24, #f59e0b); }
    .ms-bar-fill.neg { background: linear-gradient(90deg, #f87171, #ef4444); }
    .ms-bar-val { font-size: .8rem; color: #1e293b; font-weight: 600; text-align: right; }
    .ms-bar-n { color: #94a3b8; font-weight: 400; font-size: .72rem; }

    .ms-comments { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 6px; }
    .ms-c {
      padding: 8px 10px; border-radius: 8px; border-left: 3px solid;
      display: flex; gap: 8px; align-items: flex-start;
    }
    .ms-c.pos { background: #f0fdf4; border-color: #34d399; }
    .ms-c.neg { background: #fef2f2; border-color: #f87171; }
    .ms-c.neu { background: #fffbeb; border-color: #fbbf24; }
    .ms-c-text { font-size: .85rem; line-height: 1.45; color: #1e293b; margin: 0; flex: 1; font-style: italic; }
    .ms-c-conf {
      font-size: .68rem; color: #64748b; background: white; padding: 2px 6px;
      border-radius: 999px; border: 1px solid #e2e8f0; white-space: nowrap;
    }

    .ms-toggle {
      margin-left: auto; background: transparent; border: 1px solid #cbd5e1;
      color: #475569; padding: 1px 8px; border-radius: 999px; font-size: .68rem;
      cursor: pointer; font-weight: 500;
    }
    .ms-toggle:hover { background: #f1f5f9; }

    .ms-footer-note {
      font-size: .68rem; color: #94a3b8; text-align: center; margin: 12px 0 0;
      font-style: italic;
    }
    .ms-error { text-align: center; padding: 20px; color: #b91c1c; font-size: .85rem; }
    .ms-retry {
      margin-top: 8px; background: #ef4444; color: white; border: none;
      padding: 6px 14px; border-radius: 8px; cursor: pointer; font-size: .76rem; font-weight: 600;
    }
    .ms-retry:hover { background: #dc2626; }
  `]
})
export class FeedbackSentimentModalComponent implements OnChanges {
  @Input() open = false;
  @Input() eventId!: string;
  @Input() eventTitle?: string;
  @Output() close = new EventEmitter<void>();

  loading = false;
  data: SentimentBreakdown | null = null;
  disabled = false;
  disabledMessage = '';
  emptyState = false;
  emptyMessage = '';
  errorMessage = '';
  showNeutrals = false;

  constructor(private feedbackService: EventFeedbackService) {}

  get ready(): boolean { return !this.loading && !this.disabled && !this.emptyState && !!this.data; }
  get positives(): SentimentItem[] { return this.data?.items.filter(i => i.label === 'positive') ?? []; }
  get neutrals(): SentimentItem[] { return this.data?.items.filter(i => i.label === 'neutral') ?? []; }
  get negatives(): SentimentItem[] { return this.data?.items.filter(i => i.label === 'negative') ?? []; }

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
    this.showNeutrals = false;

    this.feedbackService.sentiment(this.eventId).subscribe({
      next: (res: any) => {
        this.loading = false;
        if (res && res.enabled === false) {
          this.disabled = true;
          this.disabledMessage = res.message || 'Sentiment classifier is not available.';
        } else if (res && (res.feedbackCount === 0 || res.commentCount === 0)) {
          this.emptyState = true;
          this.emptyMessage = res.message || 'No comments to analyse yet.';
        } else if (res && Array.isArray(res.items)) {
          this.data = res as SentimentBreakdown;
        } else {
          this.errorMessage = 'Unexpected response from the server.';
        }
      },
      error: (err) => {
        this.loading = false;
        if (err?.status === 404) {
          this.emptyState = true;
          this.emptyMessage = err?.error?.message || 'No comments to analyse yet.';
        } else if (err?.status === 503) {
          this.disabled = true;
          this.disabledMessage = err?.error?.message || 'Sentiment classifier unavailable.';
        } else {
          this.errorMessage = err?.error?.error || 'Sentiment analysis failed — please retry.';
        }
      }
    });
  }

  formatConfidence(c: number): string {
    return `${Math.round(c * 100)}%`;
  }
}
