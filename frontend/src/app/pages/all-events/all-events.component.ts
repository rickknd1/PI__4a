import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { EventService, BackendEvent } from '../../shared/services/event.service';
import { AuthService } from '../../shared/services/auth.service';
import { CommitteeResponsableService } from '../../shared/services/committee-responsable.service';
import { Router } from '@angular/router';
import { apiUrl } from '../../../environments/environment';
import {
  BorrowedItemBudgetInput,
  computeBorrowedItemBudgetBreakdown,
} from '../../shared/utils/borrowed-item-budget.util';
import { EVENT_FORMAT_OPTIONS, eventFormatLabel } from '../../shared/constants/event-formats';
import { FeedbackSentimentModalComponent } from '../../shared/components/feedback-sentiment-modal/feedback-sentiment-modal.component';

export interface EventFilters {
  status: string;
  dateFrom: string;
  dateTo: string;
  search: string;
  eventFormat: string;
  hasCapacity: boolean;
  hasAttendees: boolean;
}

export type AttendanceStatus = 'checked-in' | 'pending' | 'no-show';

export interface EventAttendee {
  id: string;
  userId?: string;
  name: string;
  memberCode?: string;
  email?: string;
  scanned: boolean;
  scannedAt?: string;
  rsvpDate?: string;
  attendanceStatus?: AttendanceStatus;
}

export interface EventWithAttendance extends BackendEvent {
  attendees?: EventAttendee[];
  rsvpCount?: number;
  attendanceCount?: number;
  checkedInCount?: number;
  pendingCount?: number;
  noShowCount?: number;
  eventTerminated?: boolean;
}

/** API shape for /api/borrowed-items (subset used for event budget). */
interface BorrowedItemBudgetRow extends BorrowedItemBudgetInput {
  id?: string;
  eventId?: string;
  itemName?: string;
  lenderName?: string;
}

interface DevisRow {
  borrowedItemId?: string;
  borrowed_item_id?: string;
  amount?: number;
  status?: string;
}

export interface BorrowedNeedLine {
  title: string;
  amount: number;
}

export interface BorrowedEventNeedsSummary {
  total: number;
  lines: BorrowedNeedLine[];
  supplierSum: number;
  staffSum: number;
  locationSum: number;
  hasProvisional: boolean;
}

@Component({
  selector: 'app-all-events',
  standalone: true,
  imports: [CommonModule, FormsModule, FeedbackSentimentModalComponent],
  templateUrl: './all-events.component.html',
})
export class AllEventsComponent implements OnInit {
  private readonly apiBase = apiUrl('/api');

  events: EventWithAttendance[] = [];
  filteredEvents: EventWithAttendance[] = [];

  loading = false;
  errorMessage = '';
  initialized = false;

  // Modal states
  showDeleteConfirmModal = false;
  eventToDelete: EventWithAttendance | null = null;

  showEventModal = false;
  selectedEvent: EventWithAttendance | null = null;

  sentimentOpen = false;
  sentimentEventId: string | null = null;
  sentimentEventTitle = '';

  showAttendanceModal = false;
  attendanceEvent: EventWithAttendance | null = null;
  attendanceSearch = '';

  // Budget panel
  budgetPanelEventId: string | null = null;

  /** Borrowed needs per event: validated treasurer quote + staff + location (sums). */
  private borrowedBudgetByEventId = new Map<string, BorrowedEventNeedsSummary>();

  readonly eventFormatOptions = EVENT_FORMAT_OPTIONS;

  filters: EventFilters = {
    status: '',
    dateFrom: '',
    dateTo: '',
    search: '',
    eventFormat: '',
    hasCapacity: false,
    hasAttendees: false,
  };

  displayEventFormat(ev: EventWithAttendance): string {
    return eventFormatLabel(ev.eventFormat, ev.eventFormatCustom);
  }

  // Pagination
  currentPage = 1;
  pageSize = 6;

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredEvents.length / this.pageSize));
  }

  get paginatedEvents(): EventWithAttendance[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredEvents.slice(start, start + this.pageSize);
  }

  constructor(
    private eventService: EventService,
    private http: HttpClient,
    private authService: AuthService,
    private committeeResponsableService: CommitteeResponsableService,
    public router: Router
  ) {}

  ngOnInit(): void {
    // Tous les utilisateurs connectes peuvent VOIR la liste des evenements
    // et faire un RSVP (front-office). Les actions admin (creer/editer/supprimer)
    // sont gardees par canAccess() au niveau du template.
    if (!this.initialized) {
      this.initialized = true;
      this.loadEvents();
    }
    // On souscrit quand meme pour mettre a jour canAccess() en arriere-plan
    // (utilise par le template pour afficher/masquer les boutons admin).
    this.committeeResponsableService.responsableStatus$.subscribe(() => {});
  }

  canAccess(): boolean {
    const role = this.authService.getCurrentRole();
    // PRESIDENT, VP et Secretaire Generale ont la main sur les evenements
    // (le SecGen joue le role de Community Manager dans ce club).
    if (role === 'PRESIDENT' || role === 'VICE_PRESIDENT' ||
        role === 'SECRETAIRE_GENERALE' || role === 'SECRETAIRE_GENERAL') return true;
    const isResponsable = this.committeeResponsableService.isResponsable();
    const groupName = (this.committeeResponsableService.getMySubGroupName() || '').toLowerCase();
    return isResponsable && (groupName.includes('event') || groupName.includes('evenement'));
  }

  // Computed stats
  get totalAttendees(): number {
    return this.events.reduce((sum, e) => sum + this.getScannedMembers(e).length, 0);
  }

  get avgAttendanceRate(): number {
    const eventsWithCapacity = this.events.filter(e => e.capacity && e.capacity > 0);
    if (!eventsWithCapacity.length) return 0;
    const total = eventsWithCapacity.reduce((sum, e) => sum + this.getAttendanceRate(e), 0);
    return Math.round(total / eventsWithCapacity.length);
  }

  getStatusCount(status: string): number {
    return this.events.filter(e => (e.status || '').toLowerCase() === status.toLowerCase()).length;
  }

  // Attendance helpers
  getScannedMembers(event: EventWithAttendance): EventAttendee[] {
    return (event.attendees || []).filter(a => a.scanned);
  }

  getAttendanceRate(event: EventWithAttendance): number {
    if (!event.capacity || event.capacity === 0) return 0;
    return Math.round((this.getScannedMembers(event).length / event.capacity) * 100);
  }

  getInitials(name: string): string {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  }

  getFilteredAttendees(event: EventWithAttendance): EventAttendee[] {
    const all = event.attendees || [];
    if (!this.attendanceSearch.trim()) return all;
    const q = this.attendanceSearch.toLowerCase();
    return all.filter(a => 
      a.name.toLowerCase().includes(q) || 
      (a.memberCode || '').toLowerCase().includes(q)
    );
  }

  formatTime(iso: string): string {
    if (!iso) return '';
    return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }

  exportAttendance(event: EventWithAttendance): void {
    const rows = [['Name', 'Email', 'Scanned', 'Time']];
    (event.attendees || []).forEach(a => {
      rows.push([
        a.name,
        a.email || '',
        a.scanned ? 'Yes' : 'No',
        a.scannedAt ? this.formatTime(a.scannedAt) : ''
      ]);
    });

    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${event.title.replace(/\s+/g, '_')}_attendance.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  // Load events
  loadEvents(): void {
    this.loading = true;
    this.errorMessage = '';

    this.eventService.getEvents().subscribe({
      next: (data) => {
        this.events = data.map(e => ({ ...e, attendees: [] }));
        this.filteredEvents = [...this.events];
        this.loading = false;

        // Load detailed attendance for each event
        this.events.forEach(ev => this.loadAttendance(ev));
        this.loadBorrowedItemBudgets();
      },
      error: (err) => {
        this.errorMessage = err.message || 'Failed to load events.';
        this.loading = false;
      }
    });
  }

  private loadBorrowedItemBudgets(): void {
    forkJoin({
      items: this.http.get<BorrowedItemBudgetRow[]>(`${this.apiBase}/borrowed-items`),
      devis: this.http
        .get<DevisRow[]>(`${this.apiBase}/devis/all`)
        .pipe(catchError(() => of([] as DevisRow[]))),
    }).subscribe({
      next: ({ items, devis }) => this.rebuildBorrowedBudgetSummary(items || [], devis || []),
      error: (err) => {
        console.warn('Could not load borrowed-items / devis for event budgets', err);
        this.borrowedBudgetByEventId.clear();
      },
    });
  }

  private devisByBorrowedItemId(devisList: DevisRow[]): Map<string, DevisRow[]> {
    const map = new Map<string, DevisRow[]>();
    for (const d of devisList) {
      const bid = d.borrowedItemId || d.borrowed_item_id;
      if (!bid) continue;
      if (!map.has(bid)) map.set(bid, []);
      map.get(bid)!.push(d);
    }
    return map;
  }

  private rebuildBorrowedBudgetSummary(items: BorrowedItemBudgetRow[], devisList: DevisRow[]): void {
    const devisMap = this.devisByBorrowedItemId(devisList);
    const agg = new Map<string, BorrowedEventNeedsSummary>();
    for (const item of items) {
      const eid = item.eventId?.trim();
      const itemId = item.id?.trim();
      if (!eid || !itemId) continue;
      const devis = devisMap.get(itemId) ?? [];
      const br = computeBorrowedItemBudgetBreakdown(item, devis);
      if (br.total <= 0) continue;
      const title =
        (item.itemName && item.itemName.trim()) ||
        (item.lenderName && item.lenderName.trim()) ||
        'Borrowed need';
      const cur = agg.get(eid) ?? {
        total: 0,
        lines: [],
        supplierSum: 0,
        staffSum: 0,
        locationSum: 0,
        hasProvisional: false,
      };
      cur.lines.push({ title, amount: br.total });
      cur.total += br.total;
      cur.supplierSum += br.supplierQuote;
      cur.staffSum += br.staff;
      cur.locationSum += br.location;
      if (br.mode === 'provisional') cur.hasProvisional = true;
      agg.set(eid, cur);
    }
    this.borrowedBudgetByEventId = agg;
  }

  getBorrowedNeedsSummary(event: EventWithAttendance): BorrowedEventNeedsSummary {
    if (!event.id) {
      return {
        total: 0,
        lines: [],
        supplierSum: 0,
        staffSum: 0,
        locationSum: 0,
        hasProvisional: false,
      };
    }
    return (
      this.borrowedBudgetByEventId.get(event.id) ?? {
        total: 0,
        lines: [],
        supplierSum: 0,
        staffSum: 0,
        locationSum: 0,
        hasProvisional: false,
      }
    );
  }

  getBorrowedNeedsTotal(event: EventWithAttendance): number {
    return this.getBorrowedNeedsSummary(event).total;
  }

  // Load attendance details (confirmed RSVPs + scan status derived server-side)
  loadAttendance(event: EventWithAttendance): void {
    if (!event.id) return;

    this.http.get<any>(`${this.apiBase}/events/${event.id}/attendance`).subscribe({
      next: (data) => {
        event.attendees = data.attendees || [];
        if (data.rsvpCount !== undefined)       event.rsvpCount       = data.rsvpCount;
        if (data.attendanceCount !== undefined) event.attendanceCount = data.attendanceCount;
        if (data.checkedInCount !== undefined)  event.checkedInCount  = data.checkedInCount;
        if (data.pendingCount !== undefined)    event.pendingCount    = data.pendingCount;
        if (data.noShowCount !== undefined)     event.noShowCount     = data.noShowCount;
        if (data.eventTerminated !== undefined) event.eventTerminated = data.eventTerminated;
      },
      error: (err) => {
        console.error(`Failed to load attendance for event ${event.id}`, err);
      }
    });
  }

  // Attendance breakdown helpers (work even before /attendance call completes)
  isEventTerminated(event: EventWithAttendance): boolean {
    if (event.eventTerminated !== undefined) return event.eventTerminated;
    const s = (event.status || '').toLowerCase();
    return s === 'completed' || s === 'cancelled';
  }

  getCheckedInMembers(event: EventWithAttendance): EventAttendee[] {
    return (event.attendees || []).filter(a => a.scanned || a.attendanceStatus === 'checked-in');
  }

  getPendingMembers(event: EventWithAttendance): EventAttendee[] {
    const terminated = this.isEventTerminated(event);
    return (event.attendees || []).filter(a =>
      !a.scanned && (a.attendanceStatus === 'pending' || !terminated)
    );
  }

  getNoShowMembers(event: EventWithAttendance): EventAttendee[] {
    if (!this.isEventTerminated(event)) return [];
    return (event.attendees || []).filter(a =>
      !a.scanned && a.attendanceStatus !== 'checked-in'
    );
  }

  getCheckedInCount(event: EventWithAttendance): number {
    return event.checkedInCount ?? this.getCheckedInMembers(event).length;
  }

  getPendingCount(event: EventWithAttendance): number {
    return event.pendingCount ?? this.getPendingMembers(event).length;
  }

  getNoShowCount(event: EventWithAttendance): number {
    return event.noShowCount ?? this.getNoShowMembers(event).length;
  }

  // Refresh button - call this after scanning QR codes
  refreshEvents(): void {
    this.loadEvents();
  }

  // Filters
  applyFilters(): void {
    this.currentPage = 1;
    const { status, dateFrom, dateTo, search, eventFormat, hasCapacity, hasAttendees } = this.filters;

    this.filteredEvents = this.events.filter(ev => {
      if (status && (ev.status || '').toLowerCase() !== status.toLowerCase()) return false;
      if (dateFrom && new Date(ev.startDate) < new Date(dateFrom)) return false;
      if (dateTo && new Date(ev.startDate) > new Date(dateTo)) return false;
      if (search && !ev.title.toLowerCase().includes(search.toLowerCase())) return false;
      if (eventFormat && (ev.eventFormat || '') !== eventFormat) return false;
      if (hasCapacity && !ev.capacity) return false;
      if (hasAttendees && this.getScannedMembers(ev).length === 0) return false;
      return true;
    });
  }

  resetFilters(): void {
    this.filters = {
      status: '',
      dateFrom: '',
      dateTo: '',
      search: '',
      eventFormat: '',
      hasCapacity: false,
      hasAttendees: false,
    };
    this.filteredEvents = [...this.events];
    this.currentPage = 1;
  }

  // Modals
  openAttendanceModal(event: EventWithAttendance): void {
    this.attendanceEvent = event;
    this.attendanceSearch = '';
    this.showAttendanceModal = true;
    // Refresh attendance when opening modal
    this.loadAttendance(event);
  }

  closeAttendanceModal(): void {
    this.showAttendanceModal = false;
    this.attendanceEvent = null;
  }

  openEventDetails(event: EventWithAttendance): void {
    this.selectedEvent = event;
    this.showEventModal = true;
  }

  closeEventModal(): void {
    this.showEventModal = false;
    this.selectedEvent = null;
    this.closeSentiment();
  }

  openDeleteConfirmModal(event: EventWithAttendance): void {
    this.eventToDelete = event;
    this.showDeleteConfirmModal = true;
  }

  closeDeleteConfirmModal(): void {
    this.showDeleteConfirmModal = false;
    this.eventToDelete = null;
  }

  confirmDeleteEvent(): void {
    if (!this.eventToDelete?.id) return;
    this.eventService.deleteEvent(this.eventToDelete.id).subscribe({
      next: () => {
        this.events = this.events.filter(e => e.id !== this.eventToDelete!.id);
        this.filteredEvents = this.filteredEvents.filter(e => e.id !== this.eventToDelete!.id);
        this.closeDeleteConfirmModal();
      },
      error: (err) => {
        this.errorMessage = err.message || 'Failed to delete event.';
        this.closeDeleteConfirmModal();
      }
    });
  }

  onOverlayClick(event: MouseEvent, modal: 'delete' | 'details' | 'attendance'): void {
    if ((event.target as HTMLElement).classList.contains('modal-overlay')) {
      if (modal === 'delete') this.closeDeleteConfirmModal();
      else if (modal === 'attendance') this.closeAttendanceModal();
      else this.closeEventModal();
    }
  }

  canViewSentiment(event: EventWithAttendance | null = this.selectedEvent): boolean {
    if (!event?.id) return false;
    const status = (event.status || '').toLowerCase();
    if (status === 'completed') return true;
    if (event.endDate) {
      const end = new Date(event.endDate).getTime();
      return Number.isFinite(end) && end < Date.now();
    }
    return false;
  }

  openSentiment(event: EventWithAttendance | null = this.selectedEvent): void {
    if (!event?.id) return;
    this.sentimentEventId = event.id;
    this.sentimentEventTitle = event.title || '';
    this.sentimentOpen = true;
  }

  closeSentiment(): void {
    this.sentimentOpen = false;
    this.sentimentEventId = null;
    this.sentimentEventTitle = '';
  }

  // Date formatters
  formatDate(dateStr: string | undefined): string {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  formatEventDate(dateStr: string | undefined): string {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    const date = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
    const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    return `${date} at ${time}`;
  }

  // Budget panel
  toggleBudgetPanel(evt: Event, event: EventWithAttendance): void {
    evt.stopPropagation();
    if (!event.id) return;
    this.budgetPanelEventId = this.budgetPanelEventId === event.id ? null : event.id;
  }

  getStaffBudgetTotal(event: EventWithAttendance): number {
    if (!event.staff?.length) return 0;
    return event.staff.reduce((sum, s) => {
      const b = s.budget != null ? +s.budget : 0;
      return sum + (isNaN(b) ? 0 : b);
    }, 0);
  }

  /**
   * Calendar staff + all borrowed-item needs (same formula as Borrowed items page) + optional manual event envelope.
   */
  getEventEstimatedTotal(event: EventWithAttendance): number {
    const staffTotal = this.getStaffBudgetTotal(event);
    const planned = event.estimatedBudget != null ? +event.estimatedBudget : 0;
    const borrowed = this.getBorrowedNeedsTotal(event);
    return staffTotal + (isNaN(planned) ? 0 : planned) + borrowed;
  }

  // Status actions
  completeEvent(event: EventWithAttendance): void {
    if (!event.id) return;
    const updated: BackendEvent = { ...event, status: 'completed' };
    this.eventService.updateEvent(event.id, updated).subscribe({
      next: (res) => {
        event.status = res.status || 'completed';
      },
      error: (err) => {
        this.errorMessage = err.message || 'Failed to complete event.';
      }
    });
  }

  cancelEvent(event: EventWithAttendance): void {
    if (!event.id) return;
    const updated: BackendEvent = { ...event, status: 'cancelled' };
    this.eventService.updateEvent(event.id, updated).subscribe({
      next: (res) => {
        event.status = res.status || 'cancelled';
      },
      error: (err) => {
        this.errorMessage = err.message || 'Failed to cancel event.';
      }
    });
  }

  // Pagination
  prevPage(): void {
    if (this.currentPage > 1) this.currentPage--;
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) this.currentPage++;
  }
}