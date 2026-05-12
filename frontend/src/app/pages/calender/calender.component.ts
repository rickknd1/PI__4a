import { Component, ViewChild, AfterViewInit, HostListener, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FullCalendarComponent, FullCalendarModule } from '@fullcalendar/angular';
import { EventInput, CalendarOptions, DateSelectArg, EventClickArg } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { ModalComponent } from '../../shared/components/ui/modal/modal.component';
import { EventService, BackendEvent, EventStaffMember } from '../../shared/services/event.service';
import { VirtualEventService } from '../../shared/services/virtual-event.service';
import { VirtualEvent } from '../../models/virtual-event.model';
import { STAFF_ROLE_HINTS } from '../../shared/constants/staff-role-hints';
import { EVENT_FORMAT_OPTIONS, eventFormatShort } from '../../shared/constants/event-formats';
import { LocationService } from '../../shared/services/location.service';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../shared/services/auth.service';
import { CommitteeResponsableService } from '../../shared/services/committee-responsable.service';
import { forkJoin, of, Subject, Subscription } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import {
  EventRecommendationsWidgetComponent,
  StaffRecommendation,
} from '../../shared/components/event-recommendations-widget/event-recommendations-widget.component';
import { SuggestedTiming, EventRecommendationService } from '../../shared/services/event-recommendation.service';
import { AiFeedbackSummaryModalComponent } from '../../shared/components/ai-feedback-summary-modal/ai-feedback-summary-modal.component';
import { FeedbackSentimentModalComponent } from '../../shared/components/feedback-sentiment-modal/feedback-sentiment-modal.component';
import * as L from 'leaflet';

// Fix Leaflet icon issue
const iconDefault = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
});
L.Marker.prototype.options.icon = iconDefault;

@Component({
  selector: 'app-calender',
  standalone: true,
  imports: [CommonModule, FormsModule, FullCalendarModule, ModalComponent, EventRecommendationsWidgetComponent, AiFeedbackSummaryModalComponent, FeedbackSentimentModalComponent, RouterModule],
  templateUrl: './calender.component.html',
  styles: [`
    .map-container { height: 240px; width: 100%; border-radius: 10px; position: relative; z-index: 1; }
    :host ::ng-deep .modal-backdrop { z-index: 1200 !important; }
    :host ::ng-deep .modal-panel { z-index: 1201 !important; }
    .modal-scroll { overflow-y: auto; max-height: calc(100dvh - 130px); padding-right: 2px; }
    :host ::ng-deep .fc-event { border: none !important; cursor: grab !important; }
    :host ::ng-deep .fc-daygrid-event { margin-bottom: 2px !important; border-radius: 5px !important; }
  `]
})
export class CalenderComponent implements AfterViewInit, OnInit, OnDestroy {
  @ViewChild('calendar') calendarComponent!: FullCalendarComponent;

  selectedEvent: BackendEvent | null = null;
  /** Set when the modal is open on an existing virtual event (edit mode). */
  selectedVirtualEvent: VirtualEvent | null = null;
  /**
   * Which sub-form to show inside the "create event" modal.
   *   - 'physical' → original flow (location, staff, capacity, AI reco…)
   *   - 'virtual'  → virtual-event flow (meeting type, price, recording…)
   * Defaults to 'physical' for backwards-compatible behaviour.
   */
  createEventType: 'physical' | 'virtual' = 'physical';
  isOpen = false;
  submitted = false;
  errorMessage = '';
  successMessage = '';
  private calendarReady = false;
  private formMap: L.Map | null = null;
  private formMarker: L.Marker | null = null;

  // Search
  searchQuery = '';
  searchResults: any[] = [];
  showSearchResults = false;
  isSearching = false;
  /** Stream of raw keystrokes — debounced before hitting Nominatim to avoid
   * 429 throttling (Nominatim public API allows ~1 req/sec). */
  private searchInput$ = new Subject<string>();
  private searchSub: Subscription | null = null;

  // Form fields
  eventTitle = '';
  eventDescription = '';
  eventStartDate = '';
  eventEndDate = '';
  eventLocationName = '';
  eventLocationAddress = '';
  eventLat: number | null = 33.8869;
  eventLng: number | null = 9.5375;
  eventCapacity: number | null = null;
  eventStatus = 'published';
  staffList: EventStaffMember[] = [];
  newStaffName = '';
  /** Free-text role (datalist suggests common roles); must be unique among staff. */
  newStaffRoleText = 'formateur';
  /** Optional planned budget (TND) for this staff line — shown in borrowed-items when event is selected. */
  newStaffBudget: number | null = null;
  staffAddError = '';
  /** Shown on member-facing views (e.g. RSVP) */
  memberInfoForPublic = '';
  private eventCache: BackendEvent[] = [];
  /** Last loaded virtual events — used to block overlapping time slots. */
  private virtualEventCache: VirtualEvent[] = [];

  /** Event format (workshop, conference, …) + optional custom label when "other". */
  eventFormat = '';
  eventFormatCustom = '';
  readonly eventFormatOptions = EVENT_FORMAT_OPTIONS;

  // ── Virtual-event-only form fields (used when createEventType === 'virtual') ──
  /** 'VIRTUAL' = classic Jitsi/meeting link, 'ROOM' = 3D room experience. */
  virtualType: 'VIRTUAL' | 'ROOM' = 'VIRTUAL';
  virtualRoomId = '';
  virtualMeetingLink = '';
  virtualPrice: number | null = null;
  virtualIsPaid = false;
  virtualIsRecording = false;
  virtualImageUrl = '';
  virtualCategory = '';

  /** Datalist options for staff role (same list as borrowed-items needs). */
  readonly staffRoleHints = STAFF_ROLE_HINTS;

  statusConfig: Record<string, { color: string; label: string }> = {
    published: { color: '#6366f1', label: 'Published' },
    draft: { color: '#f59e0b', label: 'Draft' },
    cancelled: { color: '#ef4444', label: 'Cancelled' },
    completed: { color: '#10b981', label: 'Completed' },
  };

  getColorFromStatus(s: string): string {
    return this.statusConfig[s]?.color ?? '#6366f1';
  }

  get titleError() { return this.submitted && !this.eventTitle.trim() ? 'Title required' : ''; }
  get startDateError() { return this.submitted && !this.eventStartDate ? 'Start date required' : ''; }
  get endDateError() {
    if (!this.submitted) return '';
    // Virtual events: end date is optional on the VEM API (LocalDateTime endAt
    // can be null). Physical events still require a strict end > start.
    if (this.createEventType === 'virtual') {
      if (!this.eventEndDate) return '';
      if (!this.eventStartDate) return '';
      const s = new Date(this.eventStartDate).getTime();
      const e = new Date(this.eventEndDate).getTime();
      if (Number.isNaN(s) || Number.isNaN(e)) return '';
      if (e <= s) return 'End date and time must be after the start';
      return '';
    }
    if (!this.eventEndDate) return 'End date required';
    if (!this.eventStartDate) return '';
    const s = new Date(this.eventStartDate).getTime();
    const e = new Date(this.eventEndDate).getTime();
    if (Number.isNaN(s) || Number.isNaN(e)) return '';
    if (e <= s) return 'End date and time must be after the start';
    return '';
  }
  /** At least one staff member is required, with any role. */
  get formateurError() {
    if (!this.submitted) return '';
    return this.staffList.length > 0 ? '' : 'Add at least one staff member (any role).';
  }
  get duplicateDayError() {
    if (!this.submitted || !this.eventStartDate) return '';
    if (this.hasDuplicateStartDay(this.eventStartDate + ':00', this.selectedEvent?.id)) {
      return 'Another active event already starts on this calendar day';
    }
    return '';
  }
  get capacityError() { return this.submitted && this.eventCapacity !== null && this.eventCapacity <= 0 ? 'Must be > 0' : ''; }
  get eventFormatError() {
    if (!this.submitted) return '';
    if (this.eventFormat === 'other' && !this.eventFormatCustom.trim()) {
      return "Please specify the format when 'Other' is selected";
    }
    return '';
  }
  get isFormValid() {
    // Virtual events don't require a location, staff, or the "one event per
    // calendar day" rule (several virtual sessions can legitimately happen
    // on the same day across different clubs).
    if (this.createEventType === 'virtual') {
      return (
        !this.titleError &&
        !this.startDateError &&
        !this.endDateError
      );
    }
    return (
      !this.titleError &&
      !this.startDateError &&
      !this.endDateError &&
      !this.capacityError &&
      !this.eventFormatError &&
      !this.formateurError &&
      !this.duplicateDayError
    );
  }

  private normalizeRole(r: string): string {
    return (r || '').trim().toLowerCase();
  }

  private startOfToday(): Date {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private localDayKey(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  /** Same local calendar day as start (ignores cancelled). */
  hasDuplicateStartDay(startIso: string, excludeId?: string): boolean {
    const key = this.localDayKey(startIso);
    if (!key) return false;
    return this.eventCache.some((ev) => {
      if (!ev.startDate || (excludeId && ev.id === excludeId)) return false;
      const st = (ev.status || '').toLowerCase();
      if (st === 'cancelled') return false;
      return this.localDayKey(ev.startDate) === key;
    });
  }

  /** True if the local calendar day of this instant is strictly before today. */
  private isStrictlyBeforeToday(iso: string): boolean {
    const d = this.parseInputAsLocalDate(iso);
    if (Number.isNaN(d.getTime())) return false;
    const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    return dayStart < this.startOfToday();
  }

  private parseInputAsLocalDate(str: string): Date {
    if (!str) return new Date(NaN);
    if (str.includes('T')) {
      const [datePart, timePart] = str.split('T');
      const [y, mo, d] = datePart.split('-').map(Number);
      const [hh, mm] = (timePart || '00:00').split(':').map(Number);
      return new Date(y, mo - 1, d, hh || 0, mm || 0, 0, 0);
    }
    const [y, mo, d] = str.substring(0, 10).split('-').map(Number);
    return new Date(y, mo - 1, d, 0, 0, 0, 0);
  }

  calendarOptions: CalendarOptions = {
    plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin],
    initialView: 'dayGridMonth',
    headerToolbar: { left: 'prev,next addEventButton', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay' },
    selectable: true,
    editable: true,
    dayMaxEvents: 3,
    events: [],
    selectAllow: (info) => !this.isStrictlyBeforeToday(info.startStr),
    eventAllow: (dropInfo) => !this.isStrictlyBeforeToday(dropInfo.startStr),
    select: (info) => this.handleDateSelect(info),
    eventClick: (info) => this.handleEventClick(info),
    eventDrop: (info) => this.handleEventDrop(info),
    eventResize: (info) => this.handleEventResize(info),
    customButtons: {
      addEventButton: {
        text: '＋ Add Event',
        click: () => {
          if (!this.canManageEvents()) {
            alert("Accès refusé");
            return;
          }
          this.resetModalFields();
          this.createEventType = 'physical';
          this.createEventType = 'physical';
          this.applyDefaultEventWindow();
          this.openModal();
        },
      },
    },
    eventContent: (arg) => this.renderEventContent(arg),
  };

  /** True while we're fetching an AI-drafted event description. */
  drafting = false;
  /** Inline error / hint shown beneath the description textarea. */
  draftError = '';

  constructor(
    private eventService: EventService,
    private locationService: LocationService,
    private recoService: EventRecommendationService,
    private virtualEventService: VirtualEventService,
    private authService: AuthService,
    private committeeResponsableService: CommitteeResponsableService,
    private router: Router
  ) {}

  canAccess(): boolean {
    const role = this.authService.getCurrentRole();
    if (role === 'PRESIDENT' || role === 'VICE_PRESIDENT' ||
        role === 'SECRETAIRE_GENERALE' || role === 'SECRETAIRE_GENERAL') return true;
    const isResponsable = this.committeeResponsableService.isResponsable();
    const groupName = (this.committeeResponsableService.getMySubGroupName() || '').toLowerCase();
    return isResponsable && (groupName.includes('event') || groupName.includes('evenement'));
  }

  canManageEvents(): boolean {
    return this.canAccess();
  }

  // ── Virtual-events integration (additive) ────────────────────────────
  //
  // The shared calendar pulls virtual events from the VEM microservice and
  // renders them in a distinct violet tone with an "ONLINE" badge.
  // Create / edit flow: the same modal is re-used — a "Physical | Virtual"
  // toggle at the top of the modal swaps between two sub-forms so each
  // event kind posts to its own microservice (EventService vs
  // VirtualEventService) without tangled shared state.
  //
  // Colour used for virtual events on the month grid. Kept outside the
  // `statusConfig` map so the existing logic that keys off `status`
  // (getColorFromStatus) continues to behave exactly as before.
  private readonly virtualEventColor = '#8b5cf6';
  /** When false, virtual events are hidden from the calendar surface. */
  showVirtualEvents = true;

  ngOnInit() {
    this.searchSub = this.searchInput$.pipe(
      debounceTime(350),
      distinctUntilChanged(),
      switchMap(q => {
        if (q.length <= 2) {
          this.searchResults = [];
          this.showSearchResults = false;
          this.isSearching = false;
          return of(null);
        }
        return this.locationService.geocodeAddress(q).pipe(
          catchError(err => {
            // Log the real error so "No address found" never silently masks
            // a CORS/network/4xx issue. Visible in the browser console.
            console.error('[Nominatim] geocode failed for "%s":', q, err);
            return of([]);
          })
        );
      })
    ).subscribe(results => {
      this.isSearching = false;
      if (results === null) return;
      this.searchResults = Array.isArray(results) ? results : [];
      this.showSearchResults = true;
      console.debug('[Nominatim] %d results for "%s"', this.searchResults.length, this.searchQuery);
    });
  }

  ngOnDestroy() {
    this.searchSub?.unsubscribe();
    this.searchInput$.complete();
  }

  ngAfterViewInit() {
    // Le calendrier est consultable par tous les utilisateurs connectes
    // (lecture). Les actions admin (creation/edition d'evenement) sont
    // gardees par canAccess() au niveau des boutons dans le template.
    if (!this.calendarReady) {
      this.calendarReady = true;
      this.loadEvents();
    }
    this.committeeResponsableService.responsableStatus$.subscribe(() => {
      // No-op : juste pour rafraichir canAccess() reactif
      // (les boutons admin se masquent/affichent dynamiquement).
      if (!this.calendarReady) {
        this.calendarReady = true;
        this.loadEvents();
      }
    });
  }

  @HostListener('document:click', ['$event'])
  onDocClick(e: MouseEvent) {
    if (!(e.target as HTMLElement).closest('.search-wrapper')) {
      this.showSearchResults = false;
    }
  }

  loadEvents(): void {
    // Load physical events (EventService) and virtual events (VEM) in
    // parallel. `VirtualEventService.getAllEvents()` already swallows
    // its own errors (returns `[]`), but we wrap the physical call too
    // so a virtual-events outage can never hide the physical ones, and
    // vice-versa.
    forkJoin({
      physical: this.eventService.getEvents().pipe(catchError(() => of<BackendEvent[]>([]))),
      virtual:  this.showVirtualEvents
        ? this.virtualEventService.getAllEvents()
        : of<VirtualEvent[]>([]),
    }).subscribe({
      next: ({ physical, virtual }) => {
        this.eventCache = physical || [];
        this.virtualEventCache = virtual || [];

        const physicalCal: EventInput[] = (physical || []).map(ev => ({
          id: ev.id,
          title: ev.title,
          start: ev.startDate,
          end: ev.endDate,
          backgroundColor: this.getColorFromStatus(ev.status || 'published'),
          borderColor: 'transparent',
          textColor: '#fff',
          extendedProps: { backendEvent: ev, eventKind: 'physical' }
        }));

        const virtualCal: EventInput[] = (virtual || [])
          .filter(ev => !!ev.scheduledAt)
          .map(ev => ({
            id: `v-${ev.id}`,       // namespaced to avoid colliding with physical ids
            title: ev.title,
            start: ev.scheduledAt,
            end: ev.endAt,
            backgroundColor: this.virtualEventColor,
            borderColor: 'transparent',
            textColor: '#fff',
            // Virtual events are informational on this calendar —
            // Inscription / rejoindre / payer : page `/ameni/events` (VEM).
            editable: false,
            durationEditable: false,
            extendedProps: { virtualEvent: ev, eventKind: 'virtual' }
          }));

        this.updateCalendarEvents([...physicalCal, ...virtualCal]);
      },
      error: (err) => { this.errorMessage = 'Failed to load events. Please try again.'; console.error('Failed to load events:', err); }
    });
  }

  private updateCalendarEvents(events: EventInput[]) {
    if (!this.calendarReady) return;
    const api = this.calendarComponent.getApi();
    api.removeAllEvents();
    api.addEventSource(events);
  }

  private toIsoDateTime(value?: string | null): string {
    if (!value) return '';
    if (!value.includes('T')) return `${value}T00:00:00`;
    const noTz = value.replace(/(Z|[+-]\d{2}:\d{2})$/, '');
    return noTz.length >= 19 ? noTz.substring(0, 19) : noTz;
  }

  handleEventDrop(dropInfo: any) {
    const ev = dropInfo.event.extendedProps['backendEvent'] as BackendEvent;
    if (!ev?.id) return;

    const startDate = this.toIsoDateTime(dropInfo.event.startStr);
    const endDate = this.toIsoDateTime(dropInfo.event.endStr || ev.endDate);

    if (this.isStrictlyBeforeToday(dropInfo.event.startStr)) {
      dropInfo.revert();
      this.errorMessage = 'Cannot move an event to a past date.';
      return;
    }
    if (new Date(endDate).getTime() <= new Date(startDate).getTime()) {
      dropInfo.revert();
      this.errorMessage = 'End must be after start.';
      return;
    }
    if (this.hasDuplicateStartDay(startDate, ev.id)) {
      dropInfo.revert();
      this.errorMessage = 'Another event already starts on this day.';
      return;
    }

    this.eventService.updateEvent(ev.id, { ...ev, startDate, endDate }).subscribe({
      next: () => {
        this.errorMessage = '';
        this.loadEvents();
      },
      error: () => dropInfo.revert(),
    });
  }

  handleEventResize(info: any) {
    const ev = info.event.extendedProps['backendEvent'] as BackendEvent;
    if (!ev?.id) return;

    const startDate = this.toIsoDateTime(info.event.startStr);
    const endDate = this.toIsoDateTime(info.event.endStr);

    if (this.isStrictlyBeforeToday(info.event.startStr)) {
      info.revert();
      this.errorMessage = 'Cannot resize into a past start date.';
      return;
    }
    if (new Date(endDate).getTime() <= new Date(startDate).getTime()) {
      info.revert();
      this.errorMessage = 'End must be after start.';
      return;
    }

    this.eventService.updateEvent(ev.id, { ...ev, startDate, endDate }).subscribe({
      next: () => {
        this.errorMessage = '';
        this.loadEvents();
      },
      error: () => info.revert(),
    });
  }

  handleDateSelect(info: DateSelectArg) {
    if (this.isStrictlyBeforeToday(info.startStr)) {
      this.errorMessage = 'Cannot create an event starting on a past date.';
      return;
    }
    this.resetModalFields();
    // Opening from a date-range selection always starts in physical mode —
    // the user explicitly switches to 'virtual' via the toggle at the top
    // of the modal if they want a virtual-event instead.
    this.createEventType = 'physical';
    const toLocal = (str: string, fallbackTime: string) => (str.includes('T') ? str.substring(0, 16) : str + fallbackTime);
    this.eventStartDate = toLocal(info.startStr, 'T08:00');
    this.eventEndDate = toLocal(info.endStr || info.startStr, 'T10:00');
    this.openModal();
  }

  /**
   * Load an existing virtual event into the shared modal so the user can
   * edit it directly from the calendar (same UX as clicking a physical
   * event). Keeps all other state in sync so validation + submit branch
   * correctly to the VEM backend.
   */
  private loadVirtualEventIntoModal(ev: VirtualEvent): void {
    this.resetModalFields();
    this.createEventType = 'virtual';
    this.selectedEvent = null;
    this.selectedVirtualEvent = ev;

    this.eventTitle = ev.title || '';
    this.eventDescription = ev.description || '';
    // scheduledAt / endAt arrive as ISO strings — trim to the 16-char form
    // that <input type="datetime-local"> expects.
    this.eventStartDate = (ev.scheduledAt || '').substring(0, 16);
    this.eventEndDate   = (ev.endAt || '').substring(0, 16);
    this.eventCapacity  = ev.maxParticipants ?? null;

    this.virtualType       = ev.type || 'VIRTUAL';
    this.virtualRoomId     = ev.roomId || '';
    this.virtualMeetingLink = ev.meetingLink || '';
    this.virtualPrice      = ev.price ?? null;
    this.virtualIsPaid     = !!ev.isPaid;
    this.virtualIsRecording = !!ev.isRecording;
    this.virtualImageUrl   = ev.imageUrl || '';
    this.virtualCategory   = ev.category || '';

    this.openModal();
  }

  /**
   * Toggle the create/edit modal between physical and virtual mode.
   * Called by the segmented switch at the top of the modal.
   * Blocked when editing an existing event — you can't change the kind
   * of a saved event after creation.
   */
  /**
   * Returns an error message if the proposed [start,end] overlaps any
   * non-finished event (physical or virtual) in the caches.
   */
  private getEventTimeOverlapMessage(
    kind: 'physical' | 'virtual',
  ): string | null {
    const startStr = this.eventStartDate?.trim();
    if (!startStr) {
      return null;
    }
    const sNew = new Date(startStr + ':00').getTime();
    if (Number.isNaN(sNew)) {
      return null;
    }
    let eNew: number;
    if (this.eventEndDate?.trim()) {
      eNew = new Date(this.eventEndDate + ':00').getTime();
    } else if (kind === 'virtual') {
      eNew = sNew + 2 * 60 * 60 * 1000;
    } else {
      return null;
    }
    if (Number.isNaN(eNew) || eNew <= sNew) {
      return 'Invalid time range: end must be after start.';
    }

    const exPhys = this.selectedEvent?.id;
    const exVirt = this.selectedVirtualEvent?.id;

    const rangeOverlap = (a0: number, a1: number, b0: number, b1: number) =>
      a0 < b1 && b0 < a1;

    for (const ev of this.eventCache) {
      if (exPhys && ev.id === exPhys) {
        continue;
      }
      if ((ev.status || '').toLowerCase() === 'cancelled') {
        continue;
      }
      if (!ev.startDate) {
        continue;
      }
      const a0 = new Date(
        this.normalizeDateTimeString(ev.startDate),
      ).getTime();
      const a1 = new Date(
        this.normalizeDateTimeString(ev.endDate || ev.startDate),
      ).getTime();
      if (Number.isNaN(a0) || Number.isNaN(a1) || a1 <= a0) {
        continue;
      }
      if (rangeOverlap(sNew, eNew, a0, a1)) {
        return 'Another in-person event is already running in this time window.';
      }
    }

    for (const ve of this.virtualEventCache) {
      if (exVirt && ve.id === exVirt) {
        continue;
      }
      const st = (ve.status || '').toUpperCase();
      if (st === 'CANCELLED' || st === 'FINISHED') {
        continue;
      }
      if (!ve.scheduledAt) {
        continue;
      }
      const a0 = new Date(
        this.normalizeDateTimeString(ve.scheduledAt),
      ).getTime();
      const endSrc = ve.endAt || ve.scheduledAt;
      const a1 = new Date(this.normalizeDateTimeString(endSrc)).getTime();
      if (Number.isNaN(a0) || Number.isNaN(a1) || a1 <= a0) {
        continue;
      }
      if (rangeOverlap(sNew, eNew, a0, a1)) {
        return 'A virtual event is already running in this time window.';
      }
    }

    return null;
  }

  /** Normalise backend ISO to a string Date can parse (trim ms / TZ if needed). */
  private normalizeDateTimeString(v: string): string {
    if (!v) {
      return v;
    }
    const t = v.includes('T') ? v : v.replace(' ', 'T');
    if (/[Z+-]\d{2}:\d{2}$|Z$/.test(t)) {
      return t;
    }
    if (t.length === 16) {
      return t + ':00';
    }
    if (t.length === 10) {
      return t + 'T00:00:00';
    }
    return t;
  }

  setCreateEventType(kind: 'physical' | 'virtual'): void {
    if (this.selectedEvent || this.selectedVirtualEvent) return; // edit mode → locked
    this.createEventType = kind;
    // Reset the submit state so validation errors from the previous mode
    // don't flash in red on the freshly-switched form.
    this.submitted = false;
    // If the user opened the modal without dates, pre-fill a sensible window
    // so virtual mode can submit with only title + start (end optional).
    if (kind === 'virtual' && !this.eventStartDate?.trim()) {
      this.applyDefaultEventWindow();
    }
    // When switching to virtual, ensure the Leaflet map — which was lazily
    // initialised when the modal opened in physical mode — doesn't keep
    // the tile grid stale behind the hidden section.
    if (kind === 'virtual' && this.formMap) {
      this.formMap.remove();
      this.formMap = null;
      this.formMarker = null;
    }
    // When switching back to physical, re-init the map (the element was
    // removed from the DOM by *ngIf, so we have to mount a fresh one).
    if (kind === 'physical') {
      setTimeout(() => this.initFormMap(), 300);
    }
  }

  handleEventClick(info: EventClickArg) {
    // Virtual event → open the SAME modal but switched to the virtual
    // sub-form so the user can edit meeting type / price / recording /
    // etc. without leaving the calendar.
    const virtual = info.event.extendedProps['virtualEvent'] as VirtualEvent | undefined;
    if (virtual) {
      this.loadVirtualEventIntoModal(virtual);
      return;
    }

    const ev = info.event.extendedProps['backendEvent'] as BackendEvent;
    if (!ev) return;

    this.createEventType = 'physical';
    this.selectedVirtualEvent = null;
    this.selectedEvent = ev;
    this.eventTitle = ev.title || '';
    this.eventDescription = ev.description || '';
    this.eventStartDate = ev.startDate?.substring(0, 16) || '';
    this.eventEndDate = ev.endDate?.substring(0, 16) || '';
    this.eventLocationName = ev.location?.name || '';
    this.eventLocationAddress = ev.location?.address || '';
    this.eventLat = ev.location?.coordinates?.lat ?? 33.8869;
    this.eventLng = ev.location?.coordinates?.lng ?? 9.5375;
    this.eventCapacity = ev.capacity ?? null;
    this.eventStatus = ev.status || 'published';
    this.staffList = Array.isArray(ev.staff)
      ? ev.staff.map((s) => ({
          name: (s.name || '').trim(),
          role: (s.role || '').trim(),
          budget: this.parseStaffBudget(s.budget),
        }))
      : [];
    this.memberInfoForPublic = ev.shortDescription || '';
    this.eventFormat = ev.eventFormat || '';
    this.eventFormatCustom = ev.eventFormatCustom || '';
    this.searchQuery = ev.location?.name || '';
    this.openModal();
  }

  handleAddOrUpdateEvent() {
    this.submitted = true;
    if (!this.isFormValid) return;

    // Virtual sub-flow: different payload shape + different microservice.
    if (this.createEventType === 'virtual') {
      this.handleAddOrUpdateVirtualEvent();
      return;
    }

    const overlap = this.getEventTimeOverlapMessage('physical');
    if (overlap) {
      this.errorMessage = overlap;
      return;
    }

    const location = (this.eventLocationName || this.eventLocationAddress) ? {
      name: this.eventLocationName,
      address: this.eventLocationAddress,
      coordinates: { lat: this.eventLat ?? 0, lng: this.eventLng ?? 0 }
    } : undefined;

    const staffPayload: EventStaffMember[] = this.staffList.map((s) => ({
      name: s.name.trim(),
      role: (s.role || '').trim(),
      budget: s.budget != null && !Number.isNaN(Number(s.budget)) ? Number(s.budget) : undefined,
    }));

    const payload: BackendEvent & { staff?: EventStaffMember[] } = {
      title: this.eventTitle,
      description: this.eventDescription,
      shortDescription: this.memberInfoForPublic.trim() || undefined,
      startDate: this.eventStartDate + ':00',
      endDate: this.eventEndDate + ':00',
      location,
      capacity: this.eventCapacity ?? undefined,
      status: this.eventStatus,
      staff: staffPayload,
      eventFormat: this.eventFormat || undefined,
      eventFormatCustom:
        this.eventFormat === 'other' ? (this.eventFormatCustom.trim() || undefined) : undefined,
    };

    this.clearMessages();
    if (this.selectedEvent?.id) {
      this.eventService.updateEvent(this.selectedEvent.id, { ...this.selectedEvent, ...payload }).subscribe({
        next: () => { this.loadEvents(); this.closeModal(); this.successMessage = 'Event updated successfully.'; },
        error: (err) => { this.errorMessage = 'Failed to update event: ' + (err.error?.error || 'Unknown error'); }
      });
    } else {
      // Don't send a placeholder — the backend resolves `createdBy` from
      // the JWT in SessionService. If no session is found it returns 401
      // instead of writing "current-user-id" into the DB (legacy bug).
      this.eventService.createEvent(payload).subscribe({
        next: () => { this.loadEvents(); this.closeModal(); this.successMessage = 'Event created successfully.'; },
        error: (err) => {
          // Same auto-diagnostic pattern as in rsvp.component — on a 401,
          // immediately call /api/rsvp/_debug (which echoes back what the
          // backend saw) so the user gets the actionable verdict in the
          // alert instead of having to dig through DevTools.
          if (err.status === 401) {
            console.error('Event creation 401', err);
            // Inline diagnostic — read what the JwtInterceptor would see
            // and tell the user whether the local token even exists.
            let token: string | null = null;
            try {
              const raw = localStorage.getItem('currentUser');
              token = raw ? (JSON.parse(raw)?.token ?? null) : null;
            } catch { /* ignore */ }
            const msg = 'Backend rejected the event creation:\n  '
              + (err.error?.error || err.error?.message || 'Not signed in.')
              + '\n\nLocal session diagnostic:\n'
              + '  localStorage.currentUser.token: '
              + (token ? token.substring(0, 24) + '... (present)' : '<MISSING>')
              + '\n\n' + (token
                ? 'Token IS present locally but backend says no Bearer header arrived.\n'
                  + 'Open DevTools > Network > the failed POST /api/events request,\n'
                  + 'then look at Request Headers — Authorization should be there.'
                : 'No token in localStorage — sign out and sign in again.');
            alert(msg);
            return;
          }
          this.errorMessage = 'Failed to create event: ' + (err.error?.error || 'Unknown error');
        }
      });
    }
  }

  deleteEvent() {
    // Virtual event being edited → use VEM delete endpoint.
    if (this.createEventType === 'virtual') {
      if (!this.selectedVirtualEvent?.id || !confirm('Delete this virtual event?')) return;
      this.virtualEventService.deleteEvent(this.selectedVirtualEvent.id).subscribe({
        next: () => { this.loadEvents(); this.closeModal(); this.successMessage = 'Virtual event deleted successfully.'; },
        error: (err) => { this.errorMessage = 'Failed to delete virtual event: ' + (err.error?.error || 'Unknown error'); }
      });
      return;
    }
    if (!this.selectedEvent?.id || !confirm('Delete this event?')) return;
    this.eventService.deleteEvent(this.selectedEvent.id).subscribe({
      next: () => { this.loadEvents(); this.closeModal(); this.successMessage = 'Event deleted successfully.'; },
      error: (err) => { this.errorMessage = 'Failed to delete event: ' + (err.error?.error || 'Unknown error'); }
    });
  }

  /**
   * Build a VirtualEvent DTO from the virtual-form fields and send it to
   * the VEM microservice (create vs update depending on
   * `selectedVirtualEvent`). Kept separate from the physical flow so the
   * two payloads can evolve independently without tangled branching.
   */
  private handleAddOrUpdateVirtualEvent(): void {
    const overlap = this.getEventTimeOverlapMessage('virtual');
    if (overlap) {
      this.errorMessage = overlap;
      return;
    }

    // `datetime-local` → ISO LocalDateTime for Jackson (VEM)
    const scheduledAt = this.eventStartDate ? this.eventStartDate + ':00' : '';
    const endAt       = this.eventEndDate   ? this.eventEndDate   + ':00' : undefined;
    if (!scheduledAt) {
      this.errorMessage = 'Start date and time are required for a virtual event.';
      return;
    }

    const payload: VirtualEvent = {
      title:            this.eventTitle.trim(),
      description:      this.eventDescription || undefined,
      category:         this.virtualCategory?.trim() || undefined,
      scheduledAt,
      endAt,
      meetingLink:      this.virtualMeetingLink?.trim() || undefined,
      isRecording:      this.virtualIsRecording,
      price:            this.virtualPrice ?? undefined,
      isPaid:           this.virtualIsPaid,
      maxParticipants:  this.eventCapacity ?? undefined,
      imageUrl:         this.virtualImageUrl?.trim() || undefined,
      type:             this.virtualType,
      roomId:           this.virtualType === 'ROOM' ? (this.virtualRoomId?.trim() || undefined) : undefined,
    };

    this.clearMessages();
    const existing = this.selectedVirtualEvent;
    const obs = existing?.id
      ? this.virtualEventService.updateEvent(existing.id, { ...existing, ...payload })
      : this.virtualEventService.createEvent(payload);

    obs.subscribe({
      next: () => {
        this.loadEvents();
        this.closeModal();
        this.successMessage = existing?.id
          ? 'Virtual event updated successfully.'
          : 'Virtual event created successfully.';
      },
      error: (err) => {
        const body = err.error;
        const msg =
          (typeof body === 'string' ? body : null) ||
          body?.message ||
          body?.error ||
          err?.message ||
          'HTTP ' + (err.status ?? '') + ' — check that Gateway :8084 and VEM are running.';
        this.errorMessage = 'Failed to save virtual event: ' + msg;
        console.error('Virtual event save failed', err);
      }
    });
  }

  addStaff() {
    this.staffAddError = '';
    const name = this.newStaffName.trim();
    const role = (this.newStaffRoleText || '').trim();
    if (!name) {
      this.staffAddError = 'Name is required.';
      return;
    }
    if (!role) {
      this.staffAddError = 'Role is required.';
      return;
    }
    // Unique constraint: the exact pair (name + role) cannot repeat.
    // Different people can share a role; same person can have several roles.
    const nameKey = name.toLowerCase();
    const roleKey = this.normalizeRole(role);
    if (this.staffList.some((s) => s.name.trim().toLowerCase() === nameKey && this.normalizeRole(s.role) === roleKey)) {
      this.staffAddError = `${name} is already listed as ${role}.`;
      return;
    }
    const budget =
      this.newStaffBudget != null && !Number.isNaN(Number(this.newStaffBudget))
        ? Number(this.newStaffBudget)
        : undefined;
    this.staffList = [...this.staffList, { name, role, budget }];
    this.newStaffName = '';
    this.newStaffBudget = null;
  }

  private parseStaffBudget(v: unknown): number | undefined {
    if (v == null || v === '') return undefined;
    const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'));
    return Number.isFinite(n) && !Number.isNaN(n) ? n : undefined;
  }

  removeStaff(i: number) {
    this.staffList = this.staffList.filter((_, idx) => idx !== i);
  }

  onSearchInput() {
    if (this.searchQuery.length > 2) {
      // Show the dropdown immediately with a loading state so the user has
      // visible feedback during the debounce window — otherwise typing feels
      // broken until the request comes back.
      this.isSearching = true;
      this.showSearchResults = true;
    } else {
      this.isSearching = false;
      this.showSearchResults = false;
    }
    this.searchInput$.next(this.searchQuery);
  }

  selectSearchResult(result: any) {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    this.eventLat = lat;
    this.eventLng = lng;
    this.eventLocationAddress = result.display_name;
    if (!this.eventLocationName) {
      this.eventLocationName = result.display_name.split(',')[0].trim();
    }
    this.searchQuery = result.display_name.split(',')[0].trim();
    this.showSearchResults = false;

    if (this.formMap && this.formMarker) {
      this.formMap.setView([lat, lng], 15);
      this.formMarker.setLatLng([lat, lng]);
    } else {
      // Map not initialised yet (e.g. user picked a result before the modal
      // finished rendering). Build it now using the freshly-set coordinates.
      this.initFormMap();
    }
  }

  initFormMap() {
    setTimeout(() => {
      const el = document.getElementById('formMap');
      if (!el) return;
      if (this.formMap) { this.formMap.remove(); this.formMap = null; }
      
      const lat = this.eventLat || 33.8869;
      const lng = this.eventLng || 9.5375;
      
      this.formMap = L.map('formMap').setView([lat, lng], 13);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
      }).addTo(this.formMap);
      
      this.formMarker = L.marker([lat, lng], { draggable: true }).addTo(this.formMap);
      
      this.formMarker.on('dragend', () => {
        const pos = this.formMarker!.getLatLng();
        this.eventLat = pos.lat;
        this.eventLng = pos.lng;
        this.reverseGeocode(pos.lat, pos.lng);
      });
      
      this.formMap.on('click', (e: L.LeafletMouseEvent) => {
        this.eventLat = e.latlng.lat;
        this.eventLng = e.latlng.lng;
        this.formMarker?.setLatLng([this.eventLat, this.eventLng]);
        this.reverseGeocode(this.eventLat, this.eventLng);
      });
      
      this.formMap.invalidateSize();
    }, 400);
  }

  reverseGeocode(lat: number, lng: number) {
    this.locationService.reverseGeocode(lat, lng).subscribe({
      next: (result) => {
        if (result?.display_name) {
          this.eventLocationAddress = result.display_name;
          if (!this.eventLocationName) {
            this.eventLocationName = result.display_name.split(',')[0].trim();
          }
        }
      }
    });
  }

  clearMessages() {
    this.errorMessage = '';
    this.successMessage = '';
  }

  /**
   * Fills start/end with "now" and "now + 2h" so a fresh "+ Add Event" (or
   * a switch to virtual) always has valid physical validation if the user
   * changes nothing — and virtual creation no longer requires typing both.
   */
  private applyDefaultEventWindow(): void {
    const pad = (n: number) => (n < 10 ? '0' + n : String(n));
    const fmt = (d: Date) =>
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    const start = new Date();
    const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
    this.eventStartDate = fmt(start);
    this.eventEndDate = fmt(end);
  }

  resetModalFields() {
    this.createEventType = 'physical';
    this.eventTitle = '';
    this.eventDescription = '';
    this.eventStartDate = '';
    this.eventEndDate = '';
    this.eventLocationName = '';
    this.eventLocationAddress = '';
    this.eventLat = 33.8869;
    this.eventLng = 9.5375;
    this.eventCapacity = null;
    this.eventStatus = 'published';
    this.staffList = [];
    this.newStaffName = '';
    this.newStaffRoleText = 'formateur';
    this.newStaffBudget = null;
    this.staffAddError = '';
    this.memberInfoForPublic = '';
    this.eventFormat = '';
    this.eventFormatCustom = '';
    this.selectedEvent = null;
    this.selectedVirtualEvent = null;
    this.submitted = false;
    this.searchQuery = '';
    this.searchResults = [];
    this.showSearchResults = false;
    // Virtual-specific fields — reset so the form is pristine between opens.
    this.virtualType = 'VIRTUAL';
    this.virtualRoomId = '';
    this.virtualMeetingLink = '';
    this.virtualPrice = null;
    this.virtualIsPaid = false;
    this.virtualIsRecording = false;
    this.virtualImageUrl = '';
    this.virtualCategory = '';
  }

  openModal() {
    this.isOpen = true;
    // Only the physical sub-form uses the Leaflet map — initialising it
    // in virtual mode would target a non-existent DOM node (wrapped in
    // *ngIf) and throw.
    if (this.createEventType === 'physical') {
      setTimeout(() => this.initFormMap(), 400);
    }
  }

  closeModal() {
    this.isOpen = false;
    this.resetModalFields();
    if (this.formMap) {
      this.formMap.remove();
      this.formMap = null;
    }
  }

  // ── AI feedback summary (organisers) ──────────────────────────────────
  aiSummaryOpen = false;
  aiSummaryEventId: string | null = null;
  aiSummaryEventTitle = '';

  /**
   * Show the "AI summary" button only when:
   *   - we're editing an existing event (selectedEvent set)
   *   - the event is over (status completed OR endDate in the past)
   * The backend handles the empty / disabled cases gracefully so we don't
   * need to know in advance whether feedbacks exist or the LLM is wired up.
   */
  canViewAiSummary(): boolean {
    if (!this.selectedEvent?.id) return false;
    const status = (this.selectedEvent.status || '').toLowerCase();
    if (status === 'completed') return true;
    if (this.selectedEvent.endDate) {
      const end = new Date(this.selectedEvent.endDate).getTime();
      return Number.isFinite(end) && end < Date.now();
    }
    return false;
  }

  openAiSummary(): void {
    if (!this.selectedEvent?.id) return;
    this.aiSummaryEventId = this.selectedEvent.id;
    this.aiSummaryEventTitle = this.selectedEvent.title || '';
    this.aiSummaryOpen = true;
  }

  closeAiSummary(): void {
    this.aiSummaryOpen = false;
    this.aiSummaryEventId = null;
    this.aiSummaryEventTitle = '';
  }

  // ── Custom-ML feedback sentiment (organisers, on past events only) ────
  sentimentOpen = false;
  sentimentEventId: string | null = null;
  sentimentEventTitle = '';

  /** Same gating rule as the AI summary button — only past/completed events. */
  canViewSentiment(): boolean {
    return this.canViewAiSummary();
  }

  openSentiment(): void {
    if (!this.selectedEvent?.id) return;
    this.sentimentEventId = this.selectedEvent.id;
    this.sentimentEventTitle = this.selectedEvent.title || '';
    this.sentimentOpen = true;
  }

  closeSentiment(): void {
    this.sentimentOpen = false;
    this.sentimentEventId = null;
    this.sentimentEventTitle = '';
  }

  /**
   * The user clicked a "smart suggestion" format chip.
   * Map it to one of the canonical EVENT_FORMAT_OPTIONS, falling back to the
   * "other" bucket with a free-text label when no canonical match exists.
   */
  onSuggestedFormat(format: string) {
    const canonical = this.eventFormatOptions.find(o => o.id === format);
    if (canonical) {
      this.eventFormat = canonical.id;
      this.eventFormatCustom = '';
    } else {
      this.eventFormat = 'other';
      this.eventFormatCustom = format;
    }
    this.successMessage = `Format set to "${format}" from your past-events analysis.`;
    setTimeout(() => { if (this.successMessage.startsWith('Format set')) this.successMessage = ''; }, 4000);
  }

  /**
   * The user clicked a suggested staff member.
   * Pre-fill the inline "add staff" inputs so they can confirm/adjust before
   * actually adding the line — never silently mutate the staff list.
   */
  onSuggestedStaff(s: StaffRecommendation) {
    this.newStaffName = s.name;
    this.newStaffRoleText = s.role || this.newStaffRoleText;
    this.staffAddError = '';
  }

  /**
   * The user clicked the "Recommended date / time" pill.
   *
   * The recommendation can come from two sources:
   *   - the deterministic recommender → always returns a clean ISO datetime
   *   - the LLM → may return a date-only string ("2026-04-25"), a date with
   *     a wrong time, or — rarely — a malformed value
   * So we parse defensively, fall back to "next occurrence of dayOfWeek at
   * typicalHour" when the date is missing/invalid, and FORCE the typical
   * hour on top of the parsed date so the UX is consistent.
   *
   * Datetime-local inputs need a "YYYY-MM-DDTHH:mm" string (no TZ, no s).
   */
  onSuggestedTiming(t: SuggestedTiming) {
    console.log('[Calendar] applyTiming clicked:', t);
    if (!t) return;

    let start: Date | null = null;
    if (t.suggestedDate) {
      const candidate = new Date(t.suggestedDate);
      if (!isNaN(candidate.getTime())) start = candidate;
    }
    if (!start && t.dayOfWeek) {
      start = this.nextOccurrenceOfDay(t.dayOfWeek, t.typicalHour ?? 18);
    }
    if (!start) {
      this.successMessage = "Couldn't parse the suggested date — try clicking again.";
      setTimeout(() => { this.successMessage = ''; }, 3000);
      return;
    }

    // Force the typical hour even if suggestedDate had an unexpected time.
    const hour = Math.max(8, Math.min(22, t.typicalHour ?? start.getHours() ?? 18));
    start.setHours(hour, 0, 0, 0);
    const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);

    const fmt = (d: Date) => {
      const pad = (n: number) => (n < 10 ? '0' + n : '' + n);
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };

    this.eventStartDate = fmt(start);
    this.eventEndDate   = fmt(end);

    // Visual confirmation so the user knows the click registered even if
    // they don't immediately see the date pickers update (they're often
    // below the AI widget on small screens).
    this.successMessage = `📅 Date pre-filled : ${t.dayOfWeek} ${t.timeOfDay} → ${this.eventStartDate.replace('T', ' ')}`;
    setTimeout(() => {
      if (this.successMessage.startsWith('📅 Date pre-filled')) this.successMessage = '';
    }, 4000);
  }

  /**
   * Calls the backend "/api/recommendations/event-description" endpoint
   * and drops the AI draft into the description textarea. The user can
   * still edit it freely afterwards. We never overwrite an existing
   * description without confirmation: if the textarea is non-empty we
   * append a newline + the draft so nothing the user already typed is lost.
   */
  suggestDescription(): void {
    if (!this.eventTitle?.trim() || this.drafting) return;
    this.drafting = true;
    this.draftError = '';
    const fmt = this.eventFormat === 'other' ? this.eventFormatCustom : this.eventFormat;
    this.recoService.describeEvent(this.eventTitle.trim(), fmt || undefined, 'fr').subscribe({
      next: (res) => {
        this.drafting = false;
        if (!res?.description) {
          this.draftError = res?.hint || 'AI returned an empty draft. Try a more specific title.';
          return;
        }
        this.eventDescription = this.eventDescription?.trim()
          ? `${this.eventDescription.trim()}\n\n${res.description}`
          : res.description;
      },
      error: (err) => {
        this.drafting = false;
        const status = err?.status ?? 0;
        this.draftError = status === 0
          ? 'Backend unreachable. Is the gateway running?'
          : `AI draft failed (HTTP ${status}). Write the description manually.`;
        console.warn('[Calendar] description draft failed:', err);
      }
    });
  }

  /**
   * Returns the next occurrence of the given day-of-week (e.g. "SATURDAY"
   * or "Sunday") at the requested hour. Falls back to today + 7 days if
   * the input is unparseable.
   */
  private nextOccurrenceOfDay(dayName: string, hour: number): Date {
    const map: Record<string, number> = {
      sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
      thursday: 4, friday: 5, saturday: 6,
    };
    const target = map[(dayName ?? '').toLowerCase().trim()];
    const today = new Date();
    if (target === undefined) {
      today.setDate(today.getDate() + 7);
      today.setHours(hour, 0, 0, 0);
      return today;
    }
    const diff = (target - today.getDay() + 7) % 7 || 7; // never today
    const next = new Date(today);
    next.setDate(today.getDate() + diff);
    next.setHours(hour, 0, 0, 0);
    return next;
  }

  renderEventContent(arg: any) {
    const color = arg.event.backgroundColor;
    const time = arg.timeText ? `<span style="font-size:10px;opacity:.8;">${arg.timeText}</span>` : '';
    const virtual = arg.event.extendedProps?.['virtualEvent'] as VirtualEvent | undefined;

    if (virtual) {
      // Virtual events get a distinct "🌐 online" badge so organisers can
      // see at a glance which items on the day are in-person vs online.
      return {
        html: `<div style="background:${color};border-radius:5px;padding:3px 6px;">
                 ${time}
                 <div style="font-size:12px;font-weight:600;color:#fff;">
                   <span style="display:inline-block;background:rgba(255,255,255,.22);padding:0 4px;border-radius:3px;font-size:9px;margin-right:4px;">ONLINE</span>
                   ${arg.event.title}
                 </div>
               </div>`
      };
    }

    const be = arg.event.extendedProps?.['backendEvent'] as BackendEvent | undefined;
    const fmt = be ? eventFormatShort(be.eventFormat, be.eventFormatCustom) : '';
    const fmtHtml = fmt
      ? `<div style="font-size:9px;opacity:.88;margin-top:1px;line-height:1.1;">${fmt.replace(/</g, '&lt;')}</div>`
      : '';
    return {
      html: `<div style="background:${color};border-radius:5px;padding:3px 6px;">
               ${time}
               <div style="font-size:12px;font-weight:600;color:#fff;">${arg.event.title}</div>
               ${fmtHtml}
             </div>`
    };
  }

  /** Toggle the visibility of virtual events on the shared calendar. */
  toggleVirtualEvents(): void {
    this.showVirtualEvents = !this.showVirtualEvents;
    this.loadEvents();
  }
}