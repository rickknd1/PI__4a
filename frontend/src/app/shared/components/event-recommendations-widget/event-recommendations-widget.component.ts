import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import {
  EventRecommendationService,
  EventRecommendations,
  FormatRecommendation,
  StaffRecommendation,
  SuggestedTiming,
} from '../../services/event-recommendation.service';
import { apiUrl } from '../../../../environments/environment';

/**
 * Compact AI panel that surfaces past-event analytics:
 *   - Best-performing event format (with confidence)
 *   - Top staff members (sortable by attendance + feedback)
 *   - Plain-language insights (1–3 short sentences)
 *
 * Designed to slot above an "Add event" form: clicking a suggested format
 * or staff member emits an event the parent can react to (e.g. prefill the
 * form). When there isn't enough past data the widget shows a friendly
 * empty state explaining how to unlock recommendations.
 */
@Component({
  selector: 'app-event-recommendations-widget',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="rec-widget rec-loading" *ngIf="loading">
      <span class="rec-spark">✨</span>
      Loading smart suggestions…
    </section>

    <section class="rec-widget rec-error" *ngIf="!loading && errorMsg">
      <header class="rec-head">
        <div class="rec-title">
          <span class="rec-spark">⚠️</span>
          <strong>Smart suggestions unavailable</strong>
        </div>
        <button type="button" class="rec-toggle" (click)="refresh()">Retry</button>
      </header>
      <p class="rec-err-msg">{{ errorMsg }}</p>
      <p class="rec-err-hint">
        Make sure the backend is running and the <code>/api/recommendations/events</code> endpoint is reachable.
      </p>
    </section>

    <section class="rec-widget" *ngIf="!loading && !errorMsg && recos">
      <header class="rec-head">
        <div class="rec-title">
          <span class="rec-spark">✨</span>
          <strong>Smart suggestions</strong>
          <span class="rec-badge" [class.badge-llm]="recos.source === 'llm'" [class.badge-stats]="recos.source !== 'llm'">
            {{ recos.source === 'llm' ? 'AI' : 'stats' }}
          </span>
          <span class="rec-sub" *ngIf="recos.totalPastEvents > 0">
            based on {{ recos.totalPastEvents }} past event{{ recos.totalPastEvents === 1 ? '' : 's' }}
          </span>
        </div>
        <button type="button" class="rec-toggle" (click)="collapsed = !collapsed">
          {{ collapsed ? 'Show' : 'Hide' }}
        </button>
      </header>

      <div class="rec-body" *ngIf="!collapsed">
        <div class="rec-empty" *ngIf="recos.emptyState">
          <p>{{ recos.emptyState }}</p>
          <p class="rec-seed-tip">
            💡 Quick demo data:
            <code>curl -X POST http://localhost:8084/api/seed/demo?count=6</code>
          </p>
        </div>

        <!-- Thin-data warning: shown when we have past events but barely
             any signal — typical right after the user creates 1-2 events.
             Tells them how to populate the demo dataset in one command. -->
        <div class="rec-thin" *ngIf="!recos.emptyState && (recos.totalPastEvents != null ? recos.totalPastEvents : 0) < 4">
          <strong>⚠️ Thin signal:</strong>
          only {{ recos.totalPastEvents }} past event{{ recos.totalPastEvents === 1 ? '' : 's' }}
          — the recommender needs ≥ 4 to be reliable. Seed demo data:
          <code>POST /api/seed/demo?count=6</code>
          <button type="button" class="rec-seed-btn" (click)="seedDemo()" [disabled]="seedingDemo">
            {{ seedingDemo ? 'Seeding…' : '✨ Seed now' }}
          </button>
        </div>

        <ng-container *ngIf="!recos.emptyState">
          <!-- Suggested format hero -->
          <div class="rec-hero" *ngIf="recos.suggestedFormat">
            <div class="rec-hero-label">Recommended format for your next event</div>
            <button type="button" class="rec-hero-pill" (click)="applyFormat.emit(recos.suggestedFormat!)">
              {{ formatLabel(recos.suggestedFormat) }}
              <span class="rec-hero-cta">Use this →</span>
            </button>
          </div>

          <!-- Suggested TIMING (day + slot + concrete next date) -->
          <div class="rec-hero rec-hero-time" *ngIf="recos.suggestedTiming as t">
            <div class="rec-hero-label">Recommended date / time slot</div>
            <button type="button" class="rec-hero-pill rec-hero-pill-time"
                    (click)="applyTiming.emit(t)">
              <span>
                {{ t.dayOfWeek }} · {{ t.timeOfDay }}
                <span class="rec-hero-sub">({{ formatPickerDate(t.suggestedDate) }} — {{ pad(t.typicalHour) }}:00)</span>
              </span>
              <span class="rec-hero-cta">Use this →</span>
            </button>
            <div class="rec-rationale" *ngIf="t.rationale">↳ {{ t.rationale }}</div>
          </div>

          <!-- Top alternative timings -->
          <div *ngIf="recos.topTiming?.length" class="rec-block">
            <div class="rec-block-title">Best days from past events</div>
            <ul class="rec-list">
              <li *ngFor="let t of limitedTopTiming" class="rec-row">
                <div class="rec-row-main rec-row-main-static">
                  <span class="rec-name">{{ t.label }}<span *ngIf="t.slot"> — {{ t.slot }}</span></span>
                  <span class="rec-meta">
                    {{ t.totalEvents }} event{{ t.totalEvents === 1 ? '' : 's' }} ·
                    {{ asPct(t.avgAttendanceRate) }}% attendance ·
                    typical hour {{ pad(t.avgHour) }}:00
                  </span>
                </div>
                <span class="rec-score" [class]="scoreClass(t.score)">{{ t.score }}</span>
                <span class="rec-conf" [class]="'conf-' + t.confidence">{{ t.confidence }}</span>
              </li>
            </ul>
          </div>

          <!-- Top formats -->
          <div *ngIf="recos.topFormats?.length" class="rec-block">
            <div class="rec-block-title">Top formats by performance</div>
            <ul class="rec-list">
              <li *ngFor="let f of limitedTopFormats" class="rec-row">
                <button type="button" class="rec-row-main" (click)="applyFormat.emit(f.format)">
                  <span class="rec-name">{{ formatLabel(f.format) }}</span>
                  <span class="rec-meta">
                    {{ f.totalEvents }} event{{ f.totalEvents === 1 ? '' : 's' }} ·
                    {{ asPct(f.avgAttendanceRate) }}% attendance
                    <ng-container *ngIf="f.avgFeedback != null">
                      · {{ f.avgFeedback }}/5 feedback
                    </ng-container>
                  </span>
                  <span class="rec-rationale" *ngIf="f.rationale">↳ {{ f.rationale }}</span>
                </button>
                <span class="rec-score" [class]="scoreClass(f.score)">{{ f.score }}</span>
                <span class="rec-conf" [class]="'conf-' + f.confidence">{{ f.confidence }}</span>
              </li>
            </ul>
          </div>

          <!-- Top staff -->
          <div *ngIf="recos.topStaff?.length" class="rec-block">
            <div class="rec-block-title">Suggested staff to invite</div>
            <ul class="rec-list">
              <li *ngFor="let s of limitedTopStaff" class="rec-row">
                <button type="button" class="rec-row-main" (click)="applyStaff.emit(s)">
                  <span class="rec-name">{{ s.name }}<span *ngIf="s.role"> — {{ s.role }}</span></span>
                  <span class="rec-meta">
                    {{ s.totalEvents }} event{{ s.totalEvents === 1 ? '' : 's' }} ·
                    {{ asPct(s.avgAttendanceRate) }}% attendance
                    <ng-container *ngIf="s.avgFeedback != null">
                      · {{ s.avgFeedback }}/5 rating
                    </ng-container>
                  </span>
                  <span class="rec-rationale" *ngIf="s.rationale">↳ {{ s.rationale }}</span>
                </button>
                <span class="rec-score" [class]="scoreClass(s.score)">{{ s.score }}</span>
                <span class="rec-conf" [class]="'conf-' + s.confidence">{{ s.confidence }}</span>
              </li>
            </ul>
          </div>

          <!-- Insights -->
          <div *ngIf="recos.insights?.length" class="rec-block rec-insights">
            <div class="rec-block-title">Insights</div>
            <ul>
              <li *ngFor="let i of recos.insights">💡 {{ i }}</li>
            </ul>
          </div>

          <!-- Next actions (LLM only) -->
          <div *ngIf="recos.nextActions?.length" class="rec-block rec-actions">
            <div class="rec-block-title">Next actions to try</div>
            <ul>
              <li *ngFor="let a of recos.nextActions">▸ {{ a }}</li>
            </ul>
          </div>

          <!-- Caveats -->
          <div *ngIf="recos.caveats?.length" class="rec-block rec-caveats">
            <div class="rec-block-title">Caveats</div>
            <ul>
              <li *ngFor="let c of recos.caveats">⚠️ {{ c }}</li>
            </ul>
          </div>
        </ng-container>
      </div>
    </section>

  `,
  styles: [`
    .rec-widget {
      border: 1px solid #e5e7eb;
      border-radius: 14px;
      background: linear-gradient(135deg, #f5f3ff 0%, #eef2ff 100%);
      padding: 14px 16px;
      margin-bottom: 14px;
      font-size: 0.85rem;
      color: #1f2937;
    }
    .rec-loading {
      font-style: italic; color: #6b7280; padding: 10px 14px;
      display: flex; align-items: center; gap: 6px;
    }
    .rec-error {
      background: linear-gradient(135deg, #fef3c7 0%, #fee2e2 100%);
      border-color: #fca5a5;
    }
    .rec-err-msg {
      margin: 6px 0 4px; font-size: 0.78rem; color: #991b1b; font-weight: 500;
    }
    .rec-err-hint {
      margin: 0; font-size: 0.72rem; color: #7c2d12;
    }
    .rec-err-hint code {
      background: rgba(0,0,0,0.06); padding: 1px 4px; border-radius: 4px;
      font-size: 0.7rem;
    }
    .rec-head {
      display: flex; align-items: center; justify-content: space-between;
      margin-bottom: 10px;
    }
    .rec-title { display: flex; align-items: center; gap: 6px; }
    .rec-spark { font-size: 1rem; }
    .rec-sub { color: #6b7280; font-size: 0.74rem; margin-left: 4px; }
    .rec-toggle {
      background: transparent; border: 1px solid #c7d2fe; color: #4f46e5;
      border-radius: 999px; padding: 2px 10px; font-size: 0.72rem; cursor: pointer;
    }
    .rec-toggle:hover { background: #e0e7ff; }
    .rec-empty p { margin: 4px 0; color: #6b7280; }

    .rec-hero {
      background: white; border-radius: 10px; padding: 10px 12px; margin-bottom: 10px;
      border: 1px dashed #c7d2fe;
    }
    .rec-hero-label { font-size: 0.72rem; color: #4338ca; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 6px; }
    .rec-hero-pill {
      display: flex; align-items: center; justify-content: space-between; width: 100%;
      background: #4f46e5; color: white; border: none; border-radius: 8px;
      padding: 8px 12px; font-weight: 600; font-size: 0.92rem; cursor: pointer;
      text-transform: capitalize;
    }
    .rec-hero-pill:hover { background: #4338ca; }
    .rec-hero-cta { font-size: 0.74rem; opacity: 0.9; }
    .rec-hero-time { margin-top: 8px; }
    .rec-hero-pill-time { background: #0d9488; }
    .rec-hero-pill-time:hover { background: #0f766e; }
    .rec-hero-sub { display: block; font-size: 0.7rem; opacity: 0.85; font-weight: 400; margin-top: 2px; text-transform: none; }
    .rec-row-main-static { cursor: default; }

    .rec-block { margin-top: 10px; }
    .rec-block-title { font-size: 0.72rem; font-weight: 700; color: #4b5563; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 6px; }
    .rec-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 4px; }
    .rec-row {
      display: flex; align-items: center; gap: 8px;
      background: white; border: 1px solid #e5e7eb;
      border-radius: 8px; padding: 6px 8px;
    }
    .rec-row-main {
      flex: 1; text-align: left; background: transparent; border: none;
      cursor: pointer; padding: 2px 4px; display: flex; flex-direction: column; gap: 2px;
    }
    .rec-row-main:hover .rec-name { color: #4338ca; }
    .rec-name { font-weight: 600; font-size: 0.84rem; text-transform: capitalize; }
    .rec-meta { font-size: 0.72rem; color: #6b7280; }
    .rec-score {
      font-weight: 700; font-size: 0.78rem; min-width: 30px; text-align: center;
      border-radius: 6px; padding: 2px 6px;
    }
    .score-good { background: #d1fae5; color: #065f46; }
    .score-mid  { background: #fef3c7; color: #92400e; }
    .score-low  { background: #fee2e2; color: #991b1b; }
    .rec-conf {
      font-size: 0.66rem; text-transform: uppercase; font-weight: 700;
      padding: 2px 6px; border-radius: 999px;
    }
    .conf-high   { background: #dcfce7; color: #166534; }
    .conf-medium { background: #fef9c3; color: #854d0e; }
    .conf-low    { background: #f3f4f6; color: #6b7280; }

    .rec-insights ul, .rec-actions ul, .rec-caveats ul {
      margin: 0; padding-left: 0; list-style: none;
      display: flex; flex-direction: column; gap: 4px;
    }
    .rec-insights li, .rec-actions li, .rec-caveats li {
      font-size: 0.78rem; line-height: 1.35;
    }
    .rec-insights li { color: #374151; }
    .rec-actions li  { color: #1e3a8a; font-weight: 500; }
    .rec-caveats li  { color: #92400e; }

    .rec-rationale {
      display: block; font-size: 0.7rem; color: #6366f1;
      font-style: italic; margin-top: 2px; line-height: 1.3;
    }
    .rec-badge {
      font-size: 0.62rem; font-weight: 700; text-transform: uppercase;
      padding: 1px 6px; border-radius: 999px; letter-spacing: 0.04em;
      margin-left: 4px;
    }
    .badge-llm   { background: linear-gradient(90deg, #818cf8, #c084fc); color: white; }
    .badge-stats { background: #e5e7eb; color: #4b5563; }

    .rec-thin {
      background: #fffbeb; border: 1px dashed #f59e0b;
      border-radius: 8px; padding: 8px 10px; margin-bottom: 10px;
      font-size: 0.74rem; color: #92400e; line-height: 1.45;
    }
    .rec-thin code, .rec-seed-tip code {
      display: inline-block; background: rgba(0,0,0,.06); padding: 1px 5px;
      border-radius: 4px; font-size: 0.7rem; margin: 2px 0;
    }
    .rec-seed-btn {
      margin-left: 8px; background: #f59e0b; color: white; border: none;
      border-radius: 6px; padding: 3px 9px; font-size: 0.72rem; font-weight: 600;
      cursor: pointer; vertical-align: middle;
    }
    .rec-seed-btn:hover:not([disabled]) { background: #d97706; }
    .rec-seed-btn[disabled] { opacity: 0.6; cursor: wait; }
    .rec-seed-tip { margin-top: 6px; font-size: 0.72rem; color: #78350f; }
  `]
})
export class EventRecommendationsWidgetComponent implements OnInit {
  /** Keep modal compact: show only top-N items per recommendation list. */
  private readonly maxRecommendationItems = 4;
  /** Notify parent the user clicked a suggested format chip. */
  @Output() applyFormat = new EventEmitter<string>();
  /** Notify parent the user wants to add this staff member to the form. */
  @Output() applyStaff = new EventEmitter<StaffRecommendation>();
  /** Notify parent the user wants to apply the recommended timing slot. */
  @Output() applyTiming = new EventEmitter<SuggestedTiming>();

  /** When true the widget loads recommendations on init. */
  @Input() autoload = true;

  recos: EventRecommendations | null = null;
  loading = false;
  collapsed = false;
  errorMsg: string | null = null;
  /** True while the demo seeder is running (one-click button). */
  seedingDemo = false;

  constructor(
    private recoService: EventRecommendationService,
    private http: HttpClient,
  ) {}

  ngOnInit(): void {
    if (this.autoload) this.refresh();
  }

  refresh(): void {
    this.loading = true;
    this.errorMsg = null;
    this.recoService.getRecommendations().subscribe({
      next: (r) => {
        this.recos = r;
        this.loading = false;
      },
      error: (err) => {
        // Surface the failure in the UI rather than disappearing silently —
        // this is what made the widget look "missing" before.
        const status = err?.status ?? 0;
        const detail = err?.error?.message ?? err?.message ?? '';
        if (status === 0) {
          this.errorMsg = 'Backend unreachable. Is the API Gateway running on :8084?';
        } else if (status === 404) {
          this.errorMsg = 'Endpoint /api/recommendations/events not found. Restart the backend after the AI changes.';
        } else if (status === 401 || status === 403) {
          this.errorMsg = 'Not authorised to load recommendations. Try signing in again.';
        } else {
          this.errorMsg = `Failed to load recommendations (HTTP ${status}). ${detail}`;
        }
        // Keep a console trace so power users can debug from devtools.
        console.warn('[EventRecommendationsWidget] failed:', err);
        this.recos = null;
        this.loading = false;
      }
    });
  }

  asPct(rate: number): number {
    return Math.round((rate ?? 0) * 100);
  }

  scoreClass(s: number): string {
    if (s >= 70) return 'score-good';
    if (s >= 45) return 'score-mid';
    return 'score-low';
  }

  /**
   * One-click demo seeder: posts to /api/seed/demo?count=6 and refreshes
   * the widget. Lets the user populate fake events without leaving the
   * "Add Event" modal — used by the prof during the live demo.
   */
  seedDemo(): void {
    if (this.seedingDemo) return;
    this.seedingDemo = true;
    this.http.post(apiUrl('/api/seed/demo?count=6'), {}).subscribe({
      next: () => {
        this.seedingDemo = false;
        this.refresh();
      },
      error: (err) => {
        this.seedingDemo = false;
        const status = err?.status ?? 0;
        if (status === 404) {
          this.errorMsg = 'Seed endpoint not found — restart the Gateway (route /api/seed/** must be loaded).';
        } else {
          this.errorMsg = `Seeding failed (HTTP ${status}). Try the curl command manually.`;
        }
        console.warn('[EventRecommendationsWidget] seed failed:', err);
      }
    });
  }

  pad(n: number | null | undefined): string {
    const v = Math.max(0, Math.min(23, n ?? 18));
    return v < 10 ? '0' + v : '' + v;
  }

  /** Pretty short date "Sat 26 Apr" for the timing pill. */
  formatPickerDate(iso: string | null | undefined): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(undefined, { weekday: 'short', day: '2-digit', month: 'short' });
  }

  formatLabel(fmt: string | null | undefined): string {
    if (!fmt) return 'Other';
    const map: Record<string, string> = {
      workshop: 'Workshop',
      conference: 'Conference',
      training: 'Training',
      competition: 'Competition',
      networking: 'Networking',
      trip_outing: 'Trip / outing',
      unspecified: 'Unspecified',
    };
    return map[fmt] ?? fmt.replace(/_/g, ' ');
  }

  get limitedTopFormats(): FormatRecommendation[] {
    return (this.recos?.topFormats ?? []).slice(0, this.maxRecommendationItems);
  }

  get limitedTopStaff(): StaffRecommendation[] {
    return (this.recos?.topStaff ?? []).slice(0, this.maxRecommendationItems);
  }

  get limitedTopTiming(): NonNullable<EventRecommendations['topTiming']> {
    return (this.recos?.topTiming ?? []).slice(0, this.maxRecommendationItems);
  }
}

export type { FormatRecommendation, StaffRecommendation };
