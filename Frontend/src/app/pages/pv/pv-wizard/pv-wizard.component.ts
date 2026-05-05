import { Component, EventEmitter, Input, Output, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import {
  MeetingPv,
  MeetingPvService,
  PendingPvEvent,
  PvEventContext,
  PvQaPair,
  PvQuestion
} from '../../../shared/services/meeting-pv.service';

/**
 * 3-step wizard for the SECRETAIRE_GENERALE:
 *   Step 1 — pick the completed event to document
 *   Step 2 — review the REAL event data (auto-loaded), then answer
 *            mostly Yes/No questions + a few free-text fields
 *   Step 3 — review the AI-generated PV in an editable textarea, save
 *
 * Why this structure?
 *   The secretary doesn't have to retype things the system already knows
 *   (attendance, tasks, feedback…). Instead they confirm/deny what
 *   happened (Y/N) and the LLM weaves the real numbers + their answers
 *   into a professional PV.
 */
@Component({
  selector: 'app-pv-wizard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './pv-wizard.component.html',
  styleUrl: './pv-wizard.component.css'
})
export class PvWizardComponent implements OnInit {
  /** When supplied (e.g. from the "pending" list) the wizard starts at step 2. */
  @Input() preselectedEvent: PendingPvEvent | null = null;
  @Output() completed = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();

  step: 1 | 2 | 3 | 4 = 1;
  loading = false;
  loadingContext = false;
  error: string | null = null;

  /** Saved PV returned by the backend (used by step 4 to show the PDF preview). */
  savedPv: MeetingPv | null = null;
  /** Sanitized PDF URL ready to be injected in an <iframe>. */
  pdfPreviewUrl: SafeResourceUrl | null = null;

  pendingEvents: PendingPvEvent[] = [];
  selectedEvent: PendingPvEvent | null = null;
  eventContext: PvEventContext | null = null;

  questions: PvQuestion[] = [];
  qaPairs: PvQaPair[] = [];
  additionalNotes = '';
  sourceLanguage: 'fr' | 'en' | 'ar' | 'tn' | 'mixed' = 'fr';

  generatedContent = '';

  /** Hard-coded fallback so the wizard is usable if the backend is briefly down. */
  private readonly FALLBACK_QUESTIONS: PvQuestion[] = [
    { section: 'préambule', id: 'started_on_time',         label: "L'événement a-t-il démarré à l'heure prévue ?",                  type: 'yesno' },
    { section: 'préambule', id: 'venue_ok',                label: 'Le lieu initialement prévu a-t-il été utilisé ?',                type: 'yesno' },
    { section: 'préambule', id: 'staff_complete',          label: "Toute l'équipe encadrante prévue était-elle présente ?",         type: 'yesno' },
    { section: 'déroulement', id: 'agenda_respected',      label: 'Le programme/ordre du jour a-t-il été respecté ?',               type: 'yesno' },
    { section: 'déroulement', id: 'attendance_satisfactory', label: 'Le taux de présence a-t-il été conforme aux attentes ?',       type: 'yesno' },
    { section: 'déroulement', id: 'atmosphere_positive',   label: "L'ambiance générale a-t-elle été positive ?",                    type: 'yesno' },
    { section: 'déroulement', id: 'incidents',             label: 'Incidents, retards ou points de blocage à signaler',             type: 'text'  },
    { section: 'décisions',   id: 'decisions_taken',       label: 'Des décisions formelles ont-elles été prises ?',                 type: 'yesno' },
    { section: 'décisions',   id: 'decisions_detail',      label: 'Si oui, listez les décisions actées (une par ligne)',            type: 'text'  },
    { section: "plan d'action", id: 'tasks_completed',     label: 'Toutes les tâches prévues ont-elles été menées à bien ?',        type: 'yesno' },
    { section: "plan d'action", id: 'follow_up',           label: 'Actions de suivi à mener et responsables (une par ligne)',       type: 'text'  },
    { section: 'clôture',     id: 'budget_respected',      label: 'Le budget prévisionnel a-t-il été respecté ?',                   type: 'yesno' },
    { section: 'clôture',     id: 'borrowed_returned',     label: 'Le matériel emprunté a-t-il été restitué intact ?',              type: 'yesno' },
    { section: 'clôture',     id: 'will_repeat',           label: 'Recommandez-vous de reconduire ce type d\'événement ?',          type: 'yesno' },
    { section: 'clôture',     id: 'free_remarks',          label: 'Autres remarques que vous souhaitez voir apparaître dans le PV', type: 'text'  }
  ];

  /** Display order of sections in the wizard step 2 and the editor step 3. */
  readonly SECTION_ORDER = ['préambule', 'déroulement', 'décisions', "plan d'action", 'clôture'] as const;
  readonly SECTION_TITLES: Record<string, string> = {
    'préambule':       'Préambule',
    'déroulement':     'Déroulement',
    'décisions':       'Décisions',
    "plan d'action":   "Plan d'action",
    'clôture':         'Clôture'
  };
  readonly SECTION_HINTS: Record<string, string> = {
    'préambule':       'Logistique de départ : démarrage à l\'heure, lieu utilisé, équipe présente.',
    'déroulement':     'Ce qui s\'est réellement passé pendant l\'événement.',
    'décisions':       'Décisions actées pendant la réunion / l\'événement.',
    "plan d'action":   'Tâches accomplies et actions de suivi à mener.',
    'clôture':         'Bilan synthétique : budget, matériel, recommandation de reconduite.'
  };

  /** Sections of the AI draft, parsed from the generated content (step 3). */
  draftSections: { title: string; key: string; body: string }[] = [];

  constructor(
    private pvService: MeetingPvService,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit(): void {
    this.pvService.getDefaultQuestions().subscribe({
      next: (res) => {
        const list = (res.structured && res.structured.length > 0)
          ? res.structured
          : this.FALLBACK_QUESTIONS;
        this.questions = list;
        this.qaPairs = list.map(q => this.toQaPair(q));
      },
      error: () => {
        this.questions = this.FALLBACK_QUESTIONS;
        this.qaPairs = this.FALLBACK_QUESTIONS.map(q => this.toQaPair(q));
      }
    });

    if (this.preselectedEvent) {
      this.selectedEvent = this.preselectedEvent;
      this.loadEventContext(this.preselectedEvent.eventId);
      this.step = 2;
    } else {
      this.loadPending();
    }
  }

  loadPending(): void {
    this.loading = true;
    this.pvService.getPending().subscribe({
      next: (list) => { this.pendingEvents = list; this.loading = false; },
      error: () => { this.loading = false; this.error = 'Impossible de charger les événements en attente.'; }
    });
  }

  pick(ev: PendingPvEvent): void {
    this.selectedEvent = ev;
    this.loadEventContext(ev.eventId);
    this.step = 2;
    this.error = null;
  }

  private loadEventContext(eventId: string): void {
    this.loadingContext = true;
    this.eventContext = null;
    this.pvService.getEventContext(eventId).subscribe({
      next: (ctx) => { this.eventContext = ctx; this.loadingContext = false; },
      error: () => { this.loadingContext = false; }
    });
  }

  /** Convenience used by the template: how many people actually showed up. */
  get attendanceLine(): string {
    const a = this.eventContext?.attendance;
    if (!a) return '—';
    return `${a.checkedIn} présents / ${a.confirmed} inscrits (${a.attendanceRatePct} %)`;
  }

  /** Trigger Gemini and move to step 3 (editable preview). */
  generate(): void {
    if (!this.selectedEvent) return;

    // Soft check — the LLM can still produce a PV from the real event data
    // alone, but a totally blank Q&A means we just regurgitate stats.
    const hasAnswer = this.qaPairs.some(p => (p.answer || '').trim().length > 0)
                   || this.additionalNotes.trim().length > 0;
    if (!hasAnswer) {
      this.error = 'Renseignez au moins une réponse Oui/Non ou une note avant de générer le PV.';
      return;
    }

    this.loading = true;
    this.error = null;
    this.pvService.generateDraft({
      eventId: this.selectedEvent.eventId,
      qaPairs: this.qaPairs,
      additionalNotes: this.additionalNotes,
      sourceLanguage: this.sourceLanguage
    }).subscribe({
      next: (res) => {
        this.generatedContent = res.generatedContent;
        this.draftSections = this.parseDraftSections(res.generatedContent);
        this.step = 3;
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.error = 'Échec de la génération IA : ' + (err?.error?.error || 'erreur inconnue');
      }
    });
  }

  /**
   * Persist the (possibly edited) PV and move to step 4 (PDF preview).
   * The parent {@code completed} event is emitted only when the user
   * explicitly closes the wizard from step 4 — this lets them download
   * the PDF first.
   */
  save(): void {
    if (!this.selectedEvent) return;
    // Recompose the draft from the per-section editors so any inline edit
    // the secretary did in step 3 lands in the saved content.
    if (this.draftSections.length > 0) {
      this.generatedContent = this.composeDraft(this.draftSections);
    }
    if (!this.generatedContent || this.generatedContent.trim().length === 0) {
      this.error = 'Le PV est vide.';
      return;
    }
    this.loading = true;
    this.error = null;
    this.pvService.save({
      eventId: this.selectedEvent.eventId,
      qaPairs: this.qaPairs,
      additionalNotes: this.additionalNotes,
      generatedContent: this.generatedContent,
      sourceLanguage: this.sourceLanguage
    }).subscribe({
      next: (saved) => {
        this.savedPv = saved;
        this.pdfPreviewUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
          this.pvService.pdfUrl(saved.id) + '#toolbar=1&view=FitH'
        );
        this.loading = false;
        this.step = 4;
      },
      error: (err) => {
        this.loading = false;
        this.error = 'Échec de la sauvegarde : ' + (err?.error?.error || 'erreur inconnue');
      }
    });
  }

  /** Open the rendered PDF in a new tab (download). */
  downloadPdf(): void {
    if (!this.savedPv) return;
    window.open(this.pvService.pdfUrl(this.savedPv.id), '_blank');
  }

  /** "Done" — notify the parent so it can refresh history / close the modal. */
  finish(): void {
    this.completed.emit();
  }

  /** Reset the wizard so the secretary can write another PV right away. */
  startAnother(): void {
    this.savedPv = null;
    this.pdfPreviewUrl = null;
    this.generatedContent = '';
    this.additionalNotes = '';
    this.qaPairs = this.qaPairs.map(p => ({ ...p, answer: '' }));
    this.selectedEvent = null;
    this.eventContext = null;
    this.error = null;
    this.step = 1;
    this.loadPending();
  }

  back(): void {
    if (this.step === 4) {
      // From step 4 we don't go back — the PV is already saved. Treat
      // "back" as "I'm done, close me".
      this.finish();
      return;
    }
    if (this.step === 3) this.step = 2;
    else if (this.step === 2) {
      if (this.preselectedEvent) { this.cancelled.emit(); return; }
      this.step = 1;
    } else this.cancelled.emit();
  }

  /** Used by *ngFor for performance. */
  trackByQid = (_: number, p: PvQaPair) => p.questionId || p.question;
  trackBySection = (_: number, s: { key: string }) => s.key;

  // ── Section grouping (step 2) ───────────────────────────────────────────

  /** Returns the questions belonging to a section, in registration order. */
  questionsForSection(section: string): PvQaPair[] {
    return this.qaPairs.filter(p => (p.section || '').toLowerCase() === section);
  }

  /** Free-text answers without a section (legacy / custom). */
  questionsWithoutSection(): PvQaPair[] {
    return this.qaPairs.filter(p => !p.section);
  }

  /** Convenience for the template: ordered list of sections actually used. */
  get orderedSections(): { key: string; title: string; hint: string }[] {
    return this.SECTION_ORDER
      .filter(k => this.questionsForSection(k).length > 0)
      .map(k => ({ key: k, title: this.SECTION_TITLES[k] || k, hint: this.SECTION_HINTS[k] || '' }));
  }

  // ── Step 3 : sectioned editor over the AI draft ─────────────────────────

  /** Parse the AI draft (`=== TITLE ===\n…`) into editable sections. */
  private parseDraftSections(draft: string): { title: string; key: string; body: string }[] {
    if (!draft || !draft.trim()) return [];
    const re = /^===\s*(.+?)\s*===\s*$/gmi;
    const matches: { title: string; index: number; matchEnd: number }[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(draft)) !== null) {
      matches.push({ title: m[1], index: m.index, matchEnd: m.index + m[0].length });
    }
    if (matches.length === 0) {
      // No headings → keep a single section so the user can still edit.
      return [{ title: 'Procès-Verbal', key: 'pv', body: draft.trim() }];
    }
    return matches.map((mm, i) => {
      const next = matches[i + 1]?.index ?? draft.length;
      const body = draft.substring(mm.matchEnd, next).trim();
      return { title: mm.title, key: this.slug(mm.title) + '-' + i, body };
    });
  }

  /** Stitch the section bodies back into a single `=== TITLE ===` document. */
  private composeDraft(sections: { title: string; body: string }[]): string {
    return sections
      .map(s => `=== ${s.title.toUpperCase()} ===\n${(s.body || '').trim()}`)
      .join('\n\n');
  }

  private slug(s: string): string {
    return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }

  // ── Helpers used by the template ────────────────────────────────────────

  private toQaPair(q: PvQuestion): PvQaPair {
    return {
      questionId: q.id,
      question:   q.label,
      type:       q.type,
      section:    q.section,
      answer:     '',
      explanation: ''
    };
  }
}
