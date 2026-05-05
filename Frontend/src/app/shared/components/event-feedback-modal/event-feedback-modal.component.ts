import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  EventFeedback,
  EventFeedbackService,
} from '../../services/event-feedback.service';

interface DimensionDef {
  key: keyof Pick<
    EventFeedback,
    'organizationScore' | 'contentScore' | 'animationScore' | 'venueScore' | 'scheduleScore'
  >;
  label: string;
  hint: string;
  emoji: string;
}

interface TagDef {
  id: string;
  label: string;
  /** Polarity drives colour and the recommender's downstream interpretation. */
  polarity: 'positive' | 'negative';
}

/**
 * Smart feedback modal — built for high-quality signal, not 5-star vanity.
 *
 * Why multi-dimensional?
 *   A single score can't tell us "the venue was bad but the speaker was great"
 *   — and that distinction is exactly what the recommender needs to suggest
 *   the right format/staff next time. Five 1–5 dimensions keep cognitive
 *   load low (~10 seconds to fill) while giving us per-aspect signal.
 *
 * Why tags?
 *   Ratings tell us "how much"; tags tell us "what about it". They're
 *   pre-defined and split positive/negative so we can compute net sentiment
 *   without any NLP, and surface "recurring praise / pain points" insights
 *   in the recommendations widget.
 *
 * Why NPS?
 *   "Would you come again?" is a behavioural intent question — strongly
 *   correlated with repeat attendance. We use it to weight the recommender
 *   without inflating the model's complexity.
 */
@Component({
  selector: 'app-event-feedback-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="fb-backdrop" *ngIf="open" (click)="cancel()">
      <div class="fb-modal" (click)="$event.stopPropagation()">
        <header class="fb-head">
          <div>
            <div class="fb-eyebrow">Smart feedback</div>
            <h3 class="fb-title">{{ eventTitle || 'How was the event?' }}</h3>
            <p class="fb-sub">Your input shapes future events — we use it to suggest better formats and staff.</p>
          </div>
          <button type="button" class="fb-close" (click)="cancel()" aria-label="Close">×</button>
        </header>

        <section class="fb-section">
          <div class="fb-section-title">Rate by dimension <span class="fb-optional">(skip what doesn't apply)</span></div>
          <div *ngFor="let d of dimensions" class="fb-dim">
            <div class="fb-dim-label">
              <span class="fb-dim-emoji">{{ d.emoji }}</span>
              <div>
                <div class="fb-dim-name">{{ d.label }}</div>
                <div class="fb-dim-hint">{{ d.hint }}</div>
              </div>
            </div>
            <div class="fb-stars" role="radiogroup" [attr.aria-label]="d.label">
              <button
                *ngFor="let v of [1,2,3,4,5]"
                type="button"
                class="fb-star"
                [class.active]="(model[d.key] ?? 0) >= v"
                (click)="setDim(d.key, v)"
                [attr.aria-label]="d.label + ': ' + v + ' / 5'">
                ★
              </button>
              <button
                type="button"
                class="fb-skip"
                *ngIf="model[d.key] != null"
                (click)="setDim(d.key, null)"
                aria-label="Clear rating">
                clear
              </button>
            </div>
          </div>
        </section>

        <section class="fb-section">
          <div class="fb-section-title">Tags <span class="fb-optional">(pick all that apply)</span></div>
          <div class="fb-tag-grid">
            <button
              *ngFor="let t of tags"
              type="button"
              class="fb-tag"
              [class.tag-pos]="t.polarity === 'positive'"
              [class.tag-neg]="t.polarity === 'negative'"
              [class.active]="isTagSelected(t.id)"
              (click)="toggleTag(t.id)">
              {{ t.label }}
            </button>
          </div>
        </section>

        <section class="fb-section" *ngIf="staffOptions.length">
          <div class="fb-section-title">Rate staff <span class="fb-optional">(optional)</span></div>
          <div *ngFor="let s of staffOptions" class="fb-staff-row">
            <div class="fb-staff-name">{{ s.name }}<span *ngIf="s.role"> · {{ s.role }}</span></div>
            <div class="fb-stars">
              <button
                *ngFor="let v of [1,2,3,4,5]"
                type="button"
                class="fb-star fb-star-sm"
                [class.active]="(staffRatings[staffKey(s)] ?? 0) >= v"
                (click)="setStaffRating(s, v)">
                ★
              </button>
            </div>
          </div>
        </section>

        <section class="fb-section">
          <div class="fb-section-title">Would you attend a similar event again?</div>
          <div class="fb-nps">
            <button
              *ngFor="let v of npsScale"
              type="button"
              class="fb-nps-btn"
              [class.active]="model.npsLikelihood === v"
              [class.nps-low]="v <= 6"
              [class.nps-mid]="v >= 7 && v <= 8"
              [class.nps-high]="v >= 9"
              (click)="model.npsLikelihood = v">
              {{ v }}
            </button>
          </div>
          <div class="fb-nps-axis">
            <span>Not really</span>
            <span>Definitely</span>
          </div>
        </section>

        <section class="fb-section">
          <div class="fb-section-title">Anything else? <span class="fb-optional">(optional)</span></div>
          <textarea
            [(ngModel)]="model.comment"
            rows="3"
            maxlength="500"
            placeholder="One thing we should keep doing, one thing to change…"
            class="fb-textarea"></textarea>
          <div class="fb-charcount">{{ (model.comment || '').length }} / 500</div>
        </section>

        <footer class="fb-foot">
          <div class="fb-summary">
            <span *ngIf="dimensionsAnswered() === 0" class="fb-warn">⚠️ At least one rating helps</span>
            <span *ngIf="dimensionsAnswered() > 0" class="fb-ok">
              {{ dimensionsAnswered() }} dimension{{ dimensionsAnswered() === 1 ? '' : 's' }} rated · composite
              <strong>{{ composite() != null ? composite() + '/5' : '—' }}</strong>
            </span>
          </div>
          <div class="fb-actions">
            <button type="button" class="fb-btn fb-btn-ghost" (click)="cancel()">Cancel</button>
            <button
              type="button"
              class="fb-btn fb-btn-primary"
              (click)="submit()"
              [disabled]="!canSubmit() || saving">
              {{ saving ? 'Saving…' : (existingId ? 'Update feedback' : 'Submit feedback') }}
            </button>
          </div>
        </footer>
      </div>
    </div>
  `,
  styles: [`
    .fb-backdrop {
      position: fixed; inset: 0; background: rgba(15,23,42,.6);
      backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center;
      z-index: 1400; padding: 20px;
    }
    .fb-modal {
      background: white; border-radius: 18px; box-shadow: 0 20px 50px rgba(0,0,0,.25);
      width: 100%; max-width: 580px; max-height: 92vh; overflow-y: auto;
      display: flex; flex-direction: column;
    }
    .fb-head {
      display: flex; gap: 12px; padding: 20px 24px 12px; border-bottom: 1px solid #f1f5f9;
    }
    .fb-eyebrow { font-size: .68rem; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: #6366f1; }
    .fb-title { font-size: 1.2rem; font-weight: 700; margin: 4px 0 4px; color: #0f172a; }
    .fb-sub { font-size: .8rem; color: #64748b; margin: 0; }
    .fb-close {
      margin-left: auto; align-self: flex-start;
      width: 32px; height: 32px; border-radius: 50%; border: 1px solid #e2e8f0;
      background: white; color: #94a3b8; font-size: 1.4rem; cursor: pointer;
      display: flex; align-items: center; justify-content: center; line-height: 1;
    }
    .fb-close:hover { background: #fee2e2; color: #dc2626; border-color: #fecaca; }

    .fb-section { padding: 14px 24px; border-bottom: 1px solid #f8fafc; }
    .fb-section:last-of-type { border-bottom: none; }
    .fb-section-title { font-size: .76rem; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: #475569; margin-bottom: 10px; }
    .fb-optional { font-weight: 500; color: #94a3b8; text-transform: none; letter-spacing: 0; }

    .fb-dim { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 6px 0; }
    .fb-dim-label { display: flex; gap: 10px; align-items: center; }
    .fb-dim-emoji { font-size: 1.2rem; }
    .fb-dim-name { font-weight: 600; font-size: .9rem; color: #1e293b; }
    .fb-dim-hint { font-size: .72rem; color: #94a3b8; }
    .fb-stars { display: flex; align-items: center; gap: 2px; }
    .fb-star {
      background: transparent; border: none; cursor: pointer;
      font-size: 1.4rem; color: #cbd5e1; padding: 0 2px; transition: transform .08s;
    }
    .fb-star.active { color: #f59e0b; }
    .fb-star:hover { transform: scale(1.15); }
    .fb-star-sm { font-size: 1.05rem; }
    .fb-skip { background: none; border: none; color: #94a3b8; font-size: .68rem; cursor: pointer; margin-left: 4px; }
    .fb-skip:hover { color: #ef4444; }

    .fb-tag-grid { display: flex; flex-wrap: wrap; gap: 6px; }
    .fb-tag {
      background: #f8fafc; border: 1px solid #e2e8f0; color: #475569;
      padding: 5px 12px; border-radius: 999px; font-size: .76rem; font-weight: 500;
      cursor: pointer; transition: all .15s;
    }
    .fb-tag.tag-pos.active { background: #d1fae5; border-color: #34d399; color: #065f46; }
    .fb-tag.tag-neg.active { background: #fee2e2; border-color: #f87171; color: #991b1b; }
    .fb-tag:hover:not(.active) { border-color: #94a3b8; color: #1e293b; }

    .fb-staff-row { display: flex; justify-content: space-between; align-items: center; padding: 4px 0; }
    .fb-staff-name { font-size: .82rem; color: #334155; }

    .fb-nps { display: flex; gap: 4px; flex-wrap: wrap; }
    .fb-nps-btn {
      width: 36px; height: 36px; border-radius: 8px; border: 1px solid #e2e8f0;
      background: white; cursor: pointer; font-weight: 600; font-size: .82rem; color: #64748b;
      transition: all .12s;
    }
    .fb-nps-btn.active.nps-low  { background: #ef4444; color: white; border-color: #ef4444; }
    .fb-nps-btn.active.nps-mid  { background: #f59e0b; color: white; border-color: #f59e0b; }
    .fb-nps-btn.active.nps-high { background: #10b981; color: white; border-color: #10b981; }
    .fb-nps-axis { display: flex; justify-content: space-between; font-size: .68rem; color: #94a3b8; margin-top: 5px; }

    .fb-textarea {
      width: 100%; border: 1px solid #e2e8f0; border-radius: 10px;
      padding: 10px 12px; font-size: .85rem; resize: vertical; font-family: inherit;
    }
    .fb-textarea:focus { border-color: #818cf8; outline: 2px solid #c7d2fe; }
    .fb-charcount { font-size: .68rem; color: #94a3b8; text-align: right; margin-top: 4px; }

    .fb-foot { padding: 14px 24px; background: #f8fafc; display: flex; align-items: center; justify-content: space-between; gap: 10px; }
    .fb-summary { font-size: .76rem; color: #475569; }
    .fb-warn { color: #b45309; }
    .fb-ok strong { color: #4338ca; }
    .fb-actions { display: flex; gap: 8px; }
    .fb-btn { padding: 8px 16px; border-radius: 8px; font-size: .82rem; font-weight: 600; cursor: pointer; border: 1px solid transparent; }
    .fb-btn-ghost { background: white; color: #475569; border-color: #e2e8f0; }
    .fb-btn-ghost:hover { background: #f1f5f9; }
    .fb-btn-primary { background: #4f46e5; color: white; }
    .fb-btn-primary:hover:not(:disabled) { background: #4338ca; }
    .fb-btn-primary:disabled { opacity: .5; cursor: not-allowed; }
  `]
})
export class EventFeedbackModalComponent implements OnInit {
  @Input() open = false;
  @Input() eventId!: string;
  @Input() eventTitle?: string;
  @Input() clubId?: string;
  @Input() userId!: string;
  @Input() userName?: string;
  /** Optional list of staff to display per-person rating rows. */
  @Input() staffOptions: { name: string; role?: string }[] = [];

  @Output() close = new EventEmitter<void>();
  @Output() submitted = new EventEmitter<EventFeedback>();

  saving = false;
  existingId: string | undefined;

  model: EventFeedback = this.empty();
  /** Staff key → 1..5 score. Undefined when the user hasn't rated this staff yet. */
  staffRatings: { [key: string]: number | undefined } = {};

  npsScale = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  readonly dimensions: DimensionDef[] = [
    { key: 'organizationScore', label: 'Organization', hint: 'Logistics, timing, comms', emoji: '🗂️' },
    { key: 'contentScore',      label: 'Content',      hint: 'Was the topic relevant & well-prepared?', emoji: '📚' },
    { key: 'animationScore',    label: 'Animation',    hint: 'Speakers / hosts / engagement', emoji: '🎙️' },
    { key: 'venueScore',        label: 'Venue',        hint: 'Comfort, location, setup', emoji: '📍' },
    { key: 'scheduleScore',     label: 'Schedule',     hint: 'Day, time, duration', emoji: '🕒' },
  ];

  readonly tags: TagDef[] = [
    { id: 'well-organized',     label: '👍 Well organized',     polarity: 'positive' },
    { id: 'engaging-speaker',   label: '🎤 Engaging speaker',   polarity: 'positive' },
    { id: 'good-networking',    label: '🤝 Good networking',    polarity: 'positive' },
    { id: 'great-venue',        label: '🏛️ Great venue',        polarity: 'positive' },
    { id: 'good-value',         label: '💎 Worth my time',      polarity: 'positive' },
    { id: 'right-duration',     label: '⏱️ Right duration',     polarity: 'positive' },
    { id: 'too-long',           label: '⏳ Too long',           polarity: 'negative' },
    { id: 'too-short',          label: '⌛ Too short',          polarity: 'negative' },
    { id: 'venue-too-small',    label: '🏚️ Venue too small',    polarity: 'negative' },
    { id: 'boring',             label: '😴 Boring',             polarity: 'negative' },
    { id: 'disorganized',       label: '🌀 Disorganized',       polarity: 'negative' },
    { id: 'started-late',       label: '🕓 Started late',       polarity: 'negative' },
    { id: 'low-engagement',     label: '🪑 Low engagement',     polarity: 'negative' },
  ];

  constructor(private feedbackService: EventFeedbackService) {}

  ngOnInit(): void {
    this.loadExisting();
  }

  ngOnChanges(): void {
    // When the parent reopens the modal with a different event, reload state
    if (this.open && this.eventId && this.userId) {
      this.loadExisting();
    }
  }

  private loadExisting(): void {
    if (!this.eventId || !this.userId) return;
    this.feedbackService.myFeedback(this.eventId, this.userId).subscribe({
      next: (r) => {
        if (r && (r as any).id) {
          const ex = r as EventFeedback;
          this.existingId = ex.id;
          this.model = { ...this.empty(), ...ex };
          this.staffRatings = ex.staffRatings ?? {};
        } else {
          this.existingId = undefined;
          this.model = this.empty();
          this.staffRatings = {};
        }
      },
      error: () => { /* keep empty defaults */ }
    });
  }

  empty(): EventFeedback {
    return {
      eventId: this.eventId,
      userId: this.userId,
      organizationScore: null,
      contentScore: null,
      animationScore: null,
      venueScore: null,
      scheduleScore: null,
      npsLikelihood: null,
      tags: [],
      staffRatings: {},
      comment: '',
    };
  }

  setDim(key: DimensionDef['key'], value: number | null): void {
    (this.model as any)[key] = value;
  }

  isTagSelected(id: string): boolean {
    return (this.model.tags ?? []).includes(id);
  }
  toggleTag(id: string): void {
    const list = new Set(this.model.tags ?? []);
    list.has(id) ? list.delete(id) : list.add(id);
    this.model.tags = Array.from(list);
  }

  staffKey(s: { name: string; role?: string }): string {
    return `${s.name}|${s.role ?? ''}`;
  }
  setStaffRating(s: { name: string; role?: string }, v: number): void {
    const k = this.staffKey(s);
    if (this.staffRatings[k] === v) {
      delete this.staffRatings[k];
    } else {
      this.staffRatings[k] = v;
    }
  }

  dimensionsAnswered(): number {
    return this.dimensions.filter(d => this.model[d.key] != null).length;
  }
  composite(): number | null {
    const vals = this.dimensions
      .map(d => this.model[d.key])
      .filter((v): v is number => v != null);
    if (!vals.length) return null;
    return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
  }

  canSubmit(): boolean {
    return this.dimensionsAnswered() > 0
        || (this.model.tags?.length ?? 0) > 0
        || this.model.npsLikelihood != null
        || (this.model.comment ?? '').trim().length > 0;
  }

  cancel(): void { this.close.emit(); }

  submit(): void {
    if (!this.canSubmit() || this.saving) return;
    this.saving = true;
    const payload: EventFeedback = {
      ...this.model,
      eventId: this.eventId,
      userId: this.userId,
      userName: this.userName,
      clubId: this.clubId,
      staffRatings: this.staffRatings,
    };
    this.feedbackService.submit(payload).subscribe({
      next: (saved) => {
        this.saving = false;
        this.submitted.emit(saved);
      },
      error: () => { this.saving = false; }
    });
  }
}
