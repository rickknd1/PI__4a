import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Subject, takeUntil, finalize } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { EventService, BackendEvent, EventStaffMember } from '../../../shared/services/event.service';
import { AuthService } from '../../../shared/services/auth.service';
import { STAFF_ROLE_HINTS } from '../../../shared/constants/staff-role-hints';
import {
  computeBorrowedItemBudgetBreakdown,
  BorrowedBudgetBreakdown,
} from '../../../shared/utils/borrowed-item-budget.util';
import { apiUrl } from '../../../../environments/environment';

// ── Interfaces ────────────────────────────────────────────────────────────────

export interface BorrowedItem {
  id: string;
  eventId: string;
  eventName?: string;
  itemName: string;
  category: string;
  quantity: number;
  notes?: string;
  description?: string;
  estimatedBudget?: number;
  lenderName: string;
  lenderType?: string;
  lenderContactPerson?: string;
  lenderPhone?: string;
  lenderEmail?: string;
  lenderAddress?: string;
  borrowedDate: string;
  expectedReturnDate: string;
  actualReturnDate?: string;
  rentalFee?: number;
  deposit?: number;
  isPaid?: boolean;
  deliveryMethod?: string;
  status: string;
  reminderSent?: boolean;
  validatedDevisId?: string;
  validationNote?: string;
  // Legacy fields kept for backend compat
  allocationLocation?: string;
  allocationPeriodStart?: string;
  allocationPeriodEnd?: string;
  isAllocated?: boolean;
  locationBudget?: number;
  staff?: { name: string; role: string; budget: number }[];
}

export interface Devis {
  id: string;
  borrowedItemId: string;
  supplierName: string;
  amount: number;
  validUntil?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  deliveryIncluded?: boolean;
  notes?: string;
  status: 'pending' | 'validated' | 'rejected';
  expanded?: boolean;
  createdAt?: string;
  validatedAt?: string;
}

export interface DevisForm {
  supplierName: string;
  amount: number | null;
  validUntil: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  deliveryIncluded: boolean;
  notes: string;
}

export interface ClubEvent {
  id: string;
  name: string;
  title?: string;
  date?: string;
  startDate?: string;
  location?: string | { name?: string; address?: string };
}

/** Optional staff / service budgets (no supplier quote required). */
export interface StaffBudgetLineForm {
  name: string;
  role: string;
  budget: number | null;
}

/** New simplified form: one need + 3 devis */
export interface NeedFormData {
  eventId: string;
  category: string;
  title: string;
  description: string;
  devis: [DevisForm, DevisForm, DevisForm];
  staffBudgetLines: StaffBudgetLineForm[];
}

export interface BorrowStats {
  totalItems: number;
  activeItems: number;
  overdueItems: number;
  pendingDevis: number;
}

const PIPELINE_ORDER = ['requested', 'approved', 'picked_up', 'in_use', 'returned'];

function emptyDevisForm(): DevisForm {
  return { supplierName: '', amount: null, validUntil: '', contactName: '', contactPhone: '', contactEmail: '', deliveryIncluded: false, notes: '' };
}

function toLocalDateTime(value?: string | null, fallbackTime = '00:00'): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed.includes('T')) {
    return trimmed.length === 16 ? `${trimmed}:00` : trimmed;
  }
  return `${trimmed}T${fallbackTime}:00`;
}

function emptyNeedForm(): NeedFormData {
  return {
    eventId: '',
    category: 'materiel',
    title: '',
    description: '',
    devis: [emptyDevisForm(), emptyDevisForm(), emptyDevisForm()],
    staffBudgetLines: [],
  };
}

/** Budget from GET /events/:id staff lines (number, string, or missing). */
function parseStaffBudgetRaw(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'));
  return Number.isFinite(n) && !Number.isNaN(n) ? n : null;
}

@Component({
  selector: 'app-all-borrowed',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './all-borrowed.component.html',
})
export class AllBorrowedComponent implements OnInit, OnDestroy {

  private apiUrl = apiUrl('/api');

  items: BorrowedItem[] = [];
  devisMap: Map<string, Devis[]> = new Map();
  events: ClubEvent[] = [];
  loading = false;
  activeTab: 'waiting' | 'approved' | 'returned' = 'waiting';
  stats: BorrowStats = { totalItems: 0, activeItems: 0, overdueItems: 0, pendingDevis: 0 };
  Number = Number;

  // ── Modal state ──────────────────────────────────────────────────────────
  showDeleteConfirmModal = false;
  itemToDelete: BorrowedItem | null = null;

  showReturnModal = false;
  returnItem: BorrowedItem | null = null;
  returnDateTime = '';
  returnNotes = '';

  showEditItemModal = false;
  editItemData: BorrowedItem | null = null;

  showEditLenderModal = false;
  editingItem: BorrowedItem | null = null;
  editLenderData = { lenderName: '', lenderPhone: '', lenderEmail: '', lenderType: '', lenderContactPerson: '', lenderAddress: '' };

  showEditDateModal = false;
  editDateItem: BorrowedItem | null = null;
  editDateData = { expectedReturnDate: '', expectedReturnTime: '' };

  showDevisManageModal = false;
  devisManageItem: BorrowedItem | null = null;
  newSingleDevis: DevisForm = emptyDevisForm();

  showValidateModal = false;
  devisToValidate: Devis | null = null;
  validationNote = '';

  // ── New Need Modal (replaces old import wizard) ────────────────────────
  showNeedModal = false;
  needStep: 'info' | 'devis' | 'confirm' = 'info';
  needForm: NeedFormData = emptyNeedForm();
  saving = false;
  errorMessage = '';
  validationErrors: { [field: string]: string } = {};
  eventSearchTerm = '';
  eventFilterTerm = '';

  // Per-devis PDF extraction loading state
  devisExtracting: { [key: string]: boolean } = {};

  newNeedStaffName = '';
  newNeedStaffRole = 'formateur';
  newNeedStaffBudget: number | null = null;
  /** Same suggestions as calendar staff datalist; role can be any custom string. */
  readonly staffRoleHints = STAFF_ROLE_HINTS;
  newNeedStaffError = '';

  // ── Toast / feedback state ──────────────────────────────────────────────
  toastMessage = '';
  toastType: 'success' | 'error' = 'success';
  toastVisible = false;
  private toastTimer: any = null;

  private destroy$ = new Subject<void>();

  constructor(
    private http: HttpClient,
    private eventService: EventService,
    private authService: AuthService,
  ) {}

  /**
   * Only the treasurer is allowed to validate or reject quotes (devis).
   * The Events committee responsable can SEE the quotes but not act on them,
   * and a simple committee member cannot manage quotes either.
   */
  get isTreasurer(): boolean {
    const role = (this.authService.getCurrentUser()?.role ?? '').toUpperCase();
    return role === 'TRESORIER' || role === 'TREASURER';
  }

  /**
   * Can create / edit / delete a need? Reserved to the Events responsable
   * (i.e. anyone NOT the treasurer in the current scope of this page).
   * The treasurer sees the same data but in read-only mode — only the
   * "Validate / Reject quote" and "Mark paid" actions remain available.
   */
  get canEditNeeds(): boolean {
    return !this.isTreasurer;
  }

  ngOnInit() { this.loadItems(); this.loadEvents(); }
  ngOnDestroy() { this.destroy$.next(); this.destroy$.complete(); }

  // ── Computed tabs ─────────────────────────────────────────────────────────
  get waitingItems(): BorrowedItem[] { return this.items.filter(i => i.status === 'requested'); }
  get approvedItems(): BorrowedItem[] { return this.items.filter(i => ['approved', 'picked_up', 'in_use'].includes(i.status)); }
  get returnedItems(): BorrowedItem[] { return this.items.filter(i => i.status === 'returned'); }
  get overdueItems(): BorrowedItem[] { return this.items.filter(i => this.isOverdue(i)); }

  get pendingDevisCount(): number {
    let c = 0;
    this.devisMap.forEach(list => { if (list.length > 0 && !list.some(d => d.status === 'validated')) c++; });
    return c;
  }

  get filledDevisCount(): number {
    return this.getFilledDevis(this.needForm.devis).length;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  getInitials(name: string): string {
    if (!name?.trim()) return '?';
    return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  }

  getCategoryLabel(cat: string): string {
    const m: Record<string, string> = {
      location_salle: 'Venue / hall rental',
      materiel: 'Equipment / material',
      autre: 'Other',
    };
    return m[cat] || cat || 'Other';
  }

  getNeedStaffBudgetTotal(): number {
    return (this.needForm.staffBudgetLines || []).reduce(
      (s, l) => s + (l.budget != null && !Number.isNaN(Number(l.budget)) ? Number(l.budget) : 0),
      0
    );
  }

  getNeedSupplierLowTotal(): number {
    const filled = this.getFilledDevis(this.needForm.devis);
    if (!filled.length) return 0;
    return Math.min(...filled.map((d) => Number(d.amount)));
  }

  /** Lowest supplier quote plus optional staff/service budgets for this need. */
  getNeedCombinedBudgetTotal(): number {
    return this.getNeedSupplierLowTotal() + this.getNeedStaffBudgetTotal();
  }

  addNeedStaffLine(): void {
    this.newNeedStaffError = '';
    const name = this.newNeedStaffName.trim();
    const role = (this.newNeedStaffRole || '').trim();
    if (!name) {
      this.newNeedStaffError = 'Name is required.';
      return;
    }
    if (!role) {
      this.newNeedStaffError = 'Role is required.';
      return;
    }
    const nameKey = name.toLowerCase();
    const roleKey = role.toLowerCase();
    const existing = (this.needForm.staffBudgetLines || []).find(
      (l) => (l.name || '').trim().toLowerCase() === nameKey && (l.role || '').trim().toLowerCase() === roleKey
    );
    if (existing) {
      this.newNeedStaffError = `${name} is already listed as ${role}.`;
      return;
    }
    const budget =
      this.newNeedStaffBudget != null && !Number.isNaN(Number(this.newNeedStaffBudget))
        ? Number(this.newNeedStaffBudget)
        : null;
    this.needForm.staffBudgetLines = [...(this.needForm.staffBudgetLines || []), { name, role, budget }];
    this.newNeedStaffName = '';
    this.newNeedStaffBudget = null;
  }

  removeNeedStaffLine(i: number): void {
    this.needForm.staffBudgetLines = (this.needForm.staffBudgetLines || []).filter((_, idx) => idx !== i);
  }

  updateNeedStaffBudget(i: number, value: number | string | null): void {
    const list = [...(this.needForm.staffBudgetLines || [])];
    if (!list[i]) return;
    const parsed = value === null || value === '' ? null : Number(value);
    list[i] = { ...list[i], budget: Number.isNaN(parsed as number) ? null : (parsed as number | null) };
    this.needForm.staffBudgetLines = list;
  }

  toggleDevisExpand(dv: Devis) { dv.expanded = !dv.expanded; }

  // ── Events ────────────────────────────────────────────────────────────────
  loadEvents() {
    this.http.get<ClubEvent[]>(`${this.apiUrl}/events`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: d => {
          this.events = (d || []).map((ev: any) => {
            const locationName = typeof ev?.location === 'string'
              ? ev.location
              : (ev?.location?.name || ev?.location?.address || '');
            return {
              id: ev?.id,
              name: ev?.name || ev?.title || 'Untitled event',
              date: ev?.date || (typeof ev?.startDate === 'string' ? ev.startDate.split('T')[0] : undefined),
              location: locationName
            } as ClubEvent;
          }).filter(ev => !!ev.id);
        },
        error: () => {}
      });
  }
  getEventName(eventId: string): string {
    return this.events.find(e => e.id === eventId)?.name || eventId || 'N/A';
  }

  get filteredEvents(): ClubEvent[] {
    const term = this.eventSearchTerm.trim().toLowerCase();
    if (!term) return this.events;
    return this.events.filter(ev => {
      const locationText = typeof ev.location === 'string'
        ? ev.location
        : (ev.location?.name || ev.location?.address || '');
      return (ev.name || '').toLowerCase().includes(term) ||
        locationText.toLowerCase().includes(term);
    });
  }

  onEventPicked(eventId: string): void {
    this.needForm.eventId = eventId;
    this.newNeedStaffError = '';
    const selected = this.events.find(e => e.id === eventId);
    this.eventSearchTerm = selected?.name || '';
    // GET /api/events/{id} must exist on the backend; if not (404), fall back to full list + find.
    this.eventService
      .getEventById(eventId)
      .pipe(
        takeUntil(this.destroy$),
        catchError(() =>
          this.http.get<BackendEvent[]>(`${this.apiUrl}/events`).pipe(
            map((list) => (list || []).find((e) => e.id === eventId) ?? null)
          )
        )
      )
      .subscribe({
        next: (ev: BackendEvent | null) => {
          if (!ev) {
            this.needForm.staffBudgetLines = [];
            return;
          }
          const list: EventStaffMember[] = Array.isArray(ev?.staff) ? ev.staff : [];
          const seen = new Set<string>();
          this.needForm.staffBudgetLines = list
            .map((s: EventStaffMember) => ({
              name: (s.name || '').trim(),
              role: (s.role || '').trim() || 'staff',
              budget: parseStaffBudgetRaw((s as EventStaffMember & { budget?: unknown }).budget),
            }))
            .filter((l) => {
              if (!l.name) return false;
              const k = l.name.toLowerCase() + '|' + l.role.toLowerCase();
              if (seen.has(k)) return false;
              seen.add(k);
              return true;
            });
        },
        error: () => {
          this.needForm.staffBudgetLines = [];
        },
      });
  }

  // ── Pipeline ────────────────────────────────────────────────────────────
  isPipelineDone(step: string, currentStatus: string): boolean {
    return PIPELINE_ORDER.indexOf(step) < PIPELINE_ORDER.indexOf(currentStatus);
  }

  // ── Date / format helpers ───────────────────────────────────────────────
  getCategoryIcon(cat: string): string {
    const m: Record<string, string> = {
      audio_visual: '🎥', furniture: '🪑', decoration: '🎨', catering: '🍽️',
      tools: '🔧', equipment: '📡', vehicles: '🚚', other: '📦',
      location_salle: '🏛️', materiel: '🔩', autre: '📦'
    };
    return m[cat] || '📦';
  }
  getStatusText(s: string): string {
    const m: Record<string, string> = { requested: 'Requested', approved: 'Approved', picked_up: 'Picked Up', in_use: 'In Use', returned: 'Returned', cancelled: 'Cancelled' };
    return m[s] || s;
  }
  isOverdue(item: BorrowedItem): boolean {
    return item.status !== 'returned' && !!item.expectedReturnDate && new Date(item.expectedReturnDate) < new Date();
  }
  daysOverdue(item: BorrowedItem): number {
    return Math.ceil((Date.now() - new Date(item.expectedReturnDate).getTime()) / 86400000);
  }
  formatDateTime(ds: string): string {
    if (!ds) return 'N/A';
    return new Date(ds).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
  formatDate(ds: string | undefined): string {
    if (!ds) return '—';
    return new Date(ds).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  getTodayDate(): string { return new Date().toISOString().split('T')[0]; }
  getNowDateTimeLocal(): string {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
  }
  fieldError(f: string): string { return this.validationErrors[f] || ''; }

  calculateStats() {
    this.stats = {
      totalItems: this.items.length,
      activeItems: this.items.filter(i => !['returned', 'cancelled'].includes(i.status)).length,
      overdueItems: this.overdueItems.length,
      pendingDevis: this.pendingDevisCount
    };
  }

  // ── Devis helpers ─────────────────────────────────────────────────────────
  getItemDevis(itemId: string): Devis[] { return this.devisMap.get(itemId) || []; }
  hasValidatedDevis(id: string): boolean { return this.getItemDevis(id).some(d => d.status === 'validated'); }
  getValidatedDevis(id: string): Devis | undefined { return this.getItemDevis(id).find(d => d.status === 'validated'); }
  getBestDevis(id: string): Devis | undefined {
    const l = this.getItemDevis(id);
    return l.length ? l.reduce((b, d) => d.amount < b.amount ? d : b, l[0]) : undefined;
  }
  getMinAmount(id: string): number { const l = this.getItemDevis(id); return l.length ? Math.min(...l.map(d => d.amount)) : 0; }
  getMaxAmount(id: string): number { const l = this.getItemDevis(id); return l.length ? Math.max(...l.map(d => d.amount)) : 0; }
  getFilledDevis(list: DevisForm[]): DevisForm[] { return list.filter(d => d.supplierName?.trim() && d.amount && Number(d.amount) > 0); }
  getMinAmountForm(): number {
    const f = this.getFilledDevis(this.needForm.devis);
    return f.length ? Math.min(...f.map(d => Number(d.amount))) : 0;
  }

  getItemBudgetBreakdown(item: BorrowedItem): BorrowedBudgetBreakdown {
    return computeBorrowedItemBudgetBreakdown(item, this.getItemDevis(item.id));
  }

  /** Per-event totals (validated quote + staff + lieu) — same rules as All events. */
  get borrowedTotalsByEvent(): Array<{
    eventId: string;
    eventName: string;
    total: number;
    supplierSum: number;
    staffSum: number;
    locationSum: number;
    hasProvisional: boolean;
  }> {
    const map = new Map<
      string,
      { supplierSum: number; staffSum: number; locationSum: number; total: number; hasProvisional: boolean }
    >();
    for (const item of this.items) {
      if (!item.eventId) continue;
      const br = computeBorrowedItemBudgetBreakdown(item, this.getItemDevis(item.id));
      if (br.total <= 0) continue;
      const cur = map.get(item.eventId) ?? {
        supplierSum: 0,
        staffSum: 0,
        locationSum: 0,
        total: 0,
        hasProvisional: false,
      };
      cur.supplierSum += br.supplierQuote;
      cur.staffSum += br.staff;
      cur.locationSum += br.location;
      cur.total += br.total;
      if (br.mode === 'provisional') cur.hasProvisional = true;
      map.set(item.eventId, cur);
    }
    return Array.from(map.entries())
      .map(([eventId, v]) => ({
        eventId,
        eventName: this.getEventName(eventId),
        ...v,
      }))
      .filter((x) => x.total > 0)
      .sort((a, b) => b.total - a.total);
  }

  get filteredBorrowedTotals(): any[] {
    const term = this.eventFilterTerm.trim().toLowerCase();
    if (!term) return this.borrowedTotalsByEvent;
    return this.borrowedTotalsByEvent.filter(row => 
      row.eventName.toLowerCase().includes(term)
    );
  }

  downloadEventPdf(row: any) {
    const doc = `
      Event Spending Summary: ${row.eventName}
      ----------------------------------------
      Total Planned: ${row.total.toFixed(3)} TND
      
      Breakdown:
      - Supplier Quotes: ${row.supplierSum.toFixed(3)} TND
      - Staff/Services:  ${row.staffSum.toFixed(3)} TND
      - Venue/Location:  ${row.locationSum.toFixed(3)} TND
      
      Status: ${row.hasProvisional ? 'Pending (estimates included)' : 'Validated'}
      Generated on: ${new Date().toLocaleString()}
    `;
    
    const blob = new Blob([doc], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Summary_${row.eventName.replace(/\s+/g, '_')}.pdf`;
    a.click();
    window.URL.revokeObjectURL(url);
    this.showToast('Summary downloaded as text file.', 'success');
  }

  // ── API: Items ────────────────────────────────────────────────────────────
  loadItems() {
    this.loading = true;
    this.http.get<BorrowedItem[]>(`${this.apiUrl}/borrowed-items`)
      .pipe(finalize(() => this.loading = false))
      .subscribe({
        next: data => {
          this.items = data;
          this.calculateStats();
          data.forEach(item => this.loadDevisForItem(item.id));
        },
        error: e => console.error('Load items:', e)
      });
  }

  loadDevisForItem(itemId: string) {
    this.http.get<Devis[]>(`${this.apiUrl}/devis/item/${itemId}`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: list => this.devisMap.set(itemId, list.map(d => ({ ...d, expanded: false }))),
        error: () => { if (!this.devisMap.has(itemId)) this.devisMap.set(itemId, []); }
      });
  }

  approveItem(item: BorrowedItem) {
    this.http.patch(`${this.apiUrl}/borrowed-items/${item.id}/status?status=approved`, {})
      .subscribe({ next: () => this.loadItems(), error: e => console.error(e) });
  }
  rejectItem(item: BorrowedItem) {
    this.http.patch(`${this.apiUrl}/borrowed-items/${item.id}/status?status=cancelled`, {})
      .subscribe({ next: () => this.loadItems(), error: e => console.error(e) });
  }
  markPickedUp(item: BorrowedItem) {
    this.http.patch(`${this.apiUrl}/borrowed-items/${item.id}/status?status=picked_up`, {})
      .subscribe({ next: () => this.loadItems(), error: e => console.error(e) });
  }
  markInUse(item: BorrowedItem) {
    this.http.patch(`${this.apiUrl}/borrowed-items/${item.id}/status?status=in_use`, {})
      .subscribe({ next: () => this.loadItems(), error: e => console.error(e) });
  }
  togglePayment(item: BorrowedItem) {
    item.isPaid = true;
    this.http.patch(`${this.apiUrl}/borrowed-items/${item.id}/payment`, { isPaid: true })
      .pipe(takeUntil(this.destroy$)).subscribe({ error: e => console.error(e) });
  }
  sendReminder(item: BorrowedItem) {
    this.http.post(`${this.apiUrl}/borrowed-items/${item.id}/remind`, {})
      .subscribe({
        next: () => this.showToast('Reminder email sent!', 'success'),
        error: (err) => {
          const details = err?.error?.error || err?.error?.message || 'Failed to send reminder email';
          this.showToast(details, 'error');
        }
      });
  }

  isTreasuryValidated(item: BorrowedItem): boolean {
    const note = (item.validationNote || '').toLowerCase();
    return !!item.validatedDevisId && note.includes('treasury:');
  }

  downloadNeedPdf(item: BorrowedItem) {
    if (!this.isTreasuryValidated(item)) {
      this.showToast('Need PDF is available only after treasury validation.', 'error');
      return;
    }
    this.http.get(`${this.apiUrl}/borrowed-items/${item.id}/export/pdf`, { responseType: 'blob' })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (blob) => {
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `need_${item.itemName?.replace(/\\s+/g, '_') || item.id}.pdf`;
          a.click();
          window.URL.revokeObjectURL(url);
          this.showToast('Need PDF downloaded.', 'success');
        },
        error: () => this.showToast('Failed to generate need PDF.', 'error')
      });
  }

  // ── Return ────────────────────────────────────────────────────────────────
  openReturnModal(item: BorrowedItem) {
    this.returnItem = item;
    this.returnDateTime = new Date().toISOString().slice(0, 16);
    this.returnNotes = '';
    this.showReturnModal = true;
  }
  closeReturnModal() { this.showReturnModal = false; this.returnItem = null; }
  confirmReturn() {
    if (!this.returnItem) return;
    this.http.patch(`${this.apiUrl}/borrowed-items/${this.returnItem.id}/return`, {
      actualReturnDate: this.returnDateTime ? new Date(this.returnDateTime).toISOString() : new Date().toISOString(),
      notes: this.returnNotes,
      isPaid: this.returnItem.isPaid
    }).subscribe({ next: () => { this.loadItems(); this.closeReturnModal(); }, error: e => console.error(e) });
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  openDeleteConfirm(item: BorrowedItem) { this.itemToDelete = item; this.showDeleteConfirmModal = true; }
  closeDeleteConfirm() { this.showDeleteConfirmModal = false; this.itemToDelete = null; }
  confirmDelete() {
    if (!this.itemToDelete) return;
    this.http.delete(`${this.apiUrl}/borrowed-items/${this.itemToDelete.id}`)
      .subscribe({ next: () => { this.loadItems(); this.closeDeleteConfirm(); }, error: e => console.error(e) });
  }

  // ── Edit Item ─────────────────────────────────────────────────────────────
  openEditItemModal(item: BorrowedItem) {
    this.editItemData = { ...item };
    this.showEditItemModal = true;
  }
  closeEditItemModal() { this.showEditItemModal = false; this.editItemData = null; }
  saveFullItemEdit() {
    if (!this.editItemData) return;
    const payload: BorrowedItem = { ...this.editItemData };
    this.http.put(`${this.apiUrl}/borrowed-items/${this.editItemData.id}`, payload)
      .subscribe({ next: () => { this.loadItems(); this.closeEditItemModal(); }, error: e => console.error(e) });
  }

  // ── Edit Lender ───────────────────────────────────────────────────────────
  openEditLenderModal(item: BorrowedItem) {
    this.editingItem = item;
    this.editLenderData = {
      lenderName: item.lenderName || '', lenderPhone: item.lenderPhone || '',
      lenderEmail: item.lenderEmail || '', lenderType: item.lenderType || 'individual',
      lenderContactPerson: item.lenderContactPerson || '', lenderAddress: item.lenderAddress || ''
    };
    this.showEditLenderModal = true;
  }
  saveLenderInfo() {
    if (!this.editingItem) return;
    this.http.put(`${this.apiUrl}/borrowed-items/${this.editingItem.id}`, { ...this.editingItem, ...this.editLenderData })
      .subscribe({ next: () => { this.loadItems(); this.showEditLenderModal = false; }, error: e => console.error(e) });
  }

  // ── Edit Date ─────────────────────────────────────────────────────────────
  openEditDateModal(item: BorrowedItem) {
    this.editDateItem = item;
    const d = new Date(item.expectedReturnDate);
    this.editDateData = { expectedReturnDate: d.toISOString().split('T')[0], expectedReturnTime: d.toTimeString().slice(0, 5) };
    this.showEditDateModal = true;
  }
  saveReturnDate() {
    if (!this.editDateItem) return;
    this.http.patch(`${this.apiUrl}/borrowed-items/${this.editDateItem.id}/return-date`, {
      expectedReturnDate: `${this.editDateData.expectedReturnDate}T${this.editDateData.expectedReturnTime}:00`
    }).subscribe({ next: () => { this.loadItems(); this.showEditDateModal = false; }, error: e => console.error(e) });
  }

  // ── Devis Management ──────────────────────────────────────────────────────
  openDevisManageModal(item: BorrowedItem) {
    this.devisManageItem = item;
    this.newSingleDevis = emptyDevisForm();
    this.showDevisManageModal = true;
  }
  closeDevisManageModal() { this.showDevisManageModal = false; this.devisManageItem = null; }

  addSingleDevis() {
    if (!this.devisManageItem || !this.newSingleDevis.supplierName?.trim() || !this.newSingleDevis.amount) return;
    
    // User requested: "be able to add an additional quote if its not approved by the treasury yet"
    // We allow adding if there are < 3 quotes OR if NO quote is validated yet.
    const existing = this.getItemDevis(this.devisManageItem.id);
    const hasValidated = existing.some(d => d.status === 'validated');
    
    if (hasValidated) {
      this.showToast('A quote has already been validated. No further quotes can be added.', 'error');
      return;
    }

    const item = this.devisManageItem;
    const payload = {
      borrowedItemId: item.id,
      supplierName: this.newSingleDevis.supplierName.trim(),
      amount: Number(this.newSingleDevis.amount),
      validUntil: toLocalDateTime(this.newSingleDevis.validUntil, '23:59') || null,
      contactName: this.newSingleDevis.contactName || '',
      contactPhone: this.newSingleDevis.contactPhone || '',
      contactEmail: this.newSingleDevis.contactEmail || '',
      deliveryIncluded: this.newSingleDevis.deliveryIncluded || false,
      notes: this.newSingleDevis.notes || '',
      status: 'pending'
    };
    const pushLocal = (id: string) => {
      const list = this.devisMap.get(item.id) || [];
      list.push({ id, ...payload, status: 'pending', expanded: false } as Devis);
      this.devisMap.set(item.id, [...list]);
      this.newSingleDevis = emptyDevisForm();
      this.calculateStats();
    };
    this.http.post<Devis>(`${this.apiUrl}/devis`, payload)
      .pipe(takeUntil(this.destroy$))
      .subscribe({ next: d => pushLocal(d.id), error: () => pushLocal('local-' + Date.now()) });
  }

  openValidateDevisModal(item: BorrowedItem, dv: Devis) {
    if (!this.isTreasurer) {
      this.showToast('Only the treasurer can approve quotes.', 'error');
      return;
    }
    this.devisManageItem = item;
    this.devisToValidate = dv;
    this.validationNote = '';
    this.showValidateModal = true;
  }

  confirmValidateDevis() {
    if (!this.devisManageItem || !this.devisToValidate) return;
    const item = this.devisManageItem;
    const dv   = this.devisToValidate;

    const list = this.getItemDevis(item.id);
    list.forEach(d => {
      d.status = (d.id === dv.id) ? 'validated' : 'rejected';
      if (d.id === dv.id) d.validatedAt = new Date().toISOString();
    });
    this.devisMap.set(item.id, [...list]);

    this.http.patch(`${this.apiUrl}/devis/${dv.id}/validate`, { note: this.validationNote })
      .pipe(takeUntil(this.destroy$))
      .subscribe({ next: () => this.loadItems() });

    this.showValidateModal = false;
    this.devisToValidate = null;
  }

  rejectDevis(dv: Devis, itemId: string) {
    if (!this.isTreasurer) {
      this.showToast('Only the treasurer can reject quotes.', 'error');
      return;
    }
    dv.status = 'rejected';
    this.devisMap.set(itemId, [...(this.devisMap.get(itemId) || [])]);
    this.http.patch(`${this.apiUrl}/devis/${dv.id}/reject`, {}).pipe(takeUntil(this.destroy$)).subscribe();
  }

  // ── New Need Modal (simplified 3-step) ─────────────────────────────────
  /**
   * Reset every piece of state attached to the "Add a need" modal so a
   * subsequent re-open never inherits previous values (form fields,
   * step pointer, PDF-extraction loaders, staff inputs, errors).
   */
  private resetNeedModalState(): void {
    this.needForm = emptyNeedForm();
    this.needStep = 'info';
    this.devisExtracting = {};
    this.validationErrors = {};
    this.errorMessage = '';
    this.saving = false;
    this.eventSearchTerm = '';
    this.newNeedStaffName = '';
    this.newNeedStaffRole = 'formateur';
    this.newNeedStaffBudget = null;
    this.newNeedStaffError = '';
  }

  openNeedModal() {
    // Always start from a clean slate, then prefill the obvious defaults.
    this.resetNeedModalState();
    if (this.events.length === 1) {
      this.needForm.eventId = this.events[0].id;
      this.eventSearchTerm = this.events[0].name;
    }
    // needStep is forced to 'info' here even if it was already reset, to
    // make the contract crystal-clear at the call-site.
    this.needStep = 'info';
    this.showNeedModal = true;
  }

  closeNeedModal() {
    this.showNeedModal = false;
    // Wipe the form state on close so the next open is fresh — Angular
    // template-driven forms otherwise keep the last typed values.
    this.resetNeedModalState();
  }

  goToDevisStep() {
    this.validationErrors = {};
    if (!this.needForm.eventId) this.validationErrors['eventId'] = 'Please select an event';
    if (!this.needForm.title?.trim()) this.validationErrors['title'] = 'Need title is required';
    if (Object.keys(this.validationErrors).length > 0) return;
    this.needStep = 'devis';
    this.errorMessage = '';
  }

  goToConfirmStep() {
    this.validationErrors = {};
    const filled = this.getFilledDevis(this.needForm.devis).length;
    if (filled < 3) {
      this.validationErrors['devis'] = `All 3 supplier quotes are required (${filled}/3 filled)`;
      return;
    }
    this.needStep = 'confirm';
    this.errorMessage = '';
  }

  goBackToInfo() { this.needStep = 'info'; }
  goBackToDevis() { this.needStep = 'devis'; }

  // ── Toast helper ──────────────────────────────────────────────────────────
  showToast(message: string, type: 'success' | 'error' = 'success', duration = 4000): void {
    this.toastMessage = message;
    this.toastType = type;
    this.toastVisible = true;
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => { this.toastVisible = false; }, duration);
  }

  // ── Per-devis PDF import ──────────────────────────────────────────────────
  importDevisPdf(event: any, devisTarget: DevisForm, devisKey: string): void {
    const file: File = event.target?.files?.[0];
    if (event.target) event.target.value = '';
    if (!file) return;

    if (file.type !== 'application/pdf') {
      this.showToast('Unsupported file type. Please use a PDF.', 'error');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      this.showToast('File too large (max 10 MB).', 'error');
      return;
    }

    this.devisExtracting[devisKey] = true;
    const fd = new FormData();
    fd.append('file', file);

    this.http.post<any>(`${this.apiUrl}/borrowed-items/extract`, fd)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => { this.devisExtracting[devisKey] = false; })
      )
      .subscribe({
        next: (raw) => {
          const d1 = raw.devis1 || {};
          const supplierName = d1.supplierName || raw.lenderName || '';
          const amount = d1.amount || raw.rentalFee || raw.locationBudget || raw.estimatedBudget || null;
          const contactName = d1.contactName || raw.lenderContactPerson || '';
          const contactPhone = d1.contactPhone || raw.lenderPhone || '';
          const contactEmail = d1.contactEmail || raw.lenderEmail || '';
          const validUntil = d1.validUntil || '';
          const deliveryIncluded = d1.deliveryIncluded || false;
          const notes = d1.notes || '';

          if (supplierName) {
            devisTarget.supplierName = supplierName;
            devisTarget.amount = amount ? Number(amount) : null;
            devisTarget.contactName = contactName;
            devisTarget.contactPhone = contactPhone;
            devisTarget.contactEmail = contactEmail;
            devisTarget.validUntil = validUntil;
            devisTarget.deliveryIncluded = deliveryIncluded;
            devisTarget.notes = notes;

            const amountStr = amount ? ` - ${Number(amount).toFixed(3)} TND` : '';
            this.showToast(`Quote extracted: ${supplierName}${amountStr}`, 'success');
          } else {
            this.showToast('Extraction finished but no supplier detected. Fill in manually.', 'error');
          }
        },
        error: () => {
          this.showToast('Extraction failed. Fill in manually.', 'error');
        }
      });
  }

  isDevisExtracting(key: string): boolean {
    return !!this.devisExtracting[key];
  }

  // ── Save the need + 3 devis ────────────────────────────────────────────
  saveNeed() {
    if (this.saving) return;
    this.saving = true;
    this.errorMessage = '';

    const filledDevis = this.getFilledDevis(this.needForm.devis);
    if (filledDevis.length < 3) {
      this.saving = false;
      this.errorMessage = 'All 3 supplier quotes are required.';
      return;
    }

    const firstDevis = filledDevis[0];
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 30);
    const staffLines = (this.needForm.staffBudgetLines || [])
      .filter((l) => l.name.trim() && l.budget != null && Number(l.budget) > 0)
      .map((l) => ({ name: l.name.trim(), role: l.role, budget: Number(l.budget) }));
    const supplierLow = Math.min(...filledDevis.map((d) => Number(d.amount)));
    const staffTotal = staffLines.reduce((s, l) => s + l.budget, 0);

    const payload: Partial<BorrowedItem> = {
      eventId: this.needForm.eventId,
      itemName: this.needForm.title.trim(),
      category: this.needForm.category || 'autre',
      quantity: 1,
      notes: this.needForm.description || '',
      lenderName: firstDevis.supplierName || '',
      lenderPhone: firstDevis.contactPhone || '',
      lenderEmail: firstDevis.contactEmail || '',
      borrowedDate: new Date().toISOString(),
      expectedReturnDate: tomorrow.toISOString(),
      status: 'requested',
      isPaid: false,
      reminderSent: false,
      estimatedBudget: supplierLow + staffTotal,
      staff: staffLines.length ? staffLines : undefined,
    };

    this.http.post<BorrowedItem>(`${this.apiUrl}/borrowed-items`, payload).subscribe({
      next: (created) => {
        let done = 0;
        filledDevis.forEach((dv, idx) => {
          const dvPayload = {
            borrowedItemId: created.id,
            supplierName: dv.supplierName.trim(),
            amount: Number(dv.amount),
            validUntil: toLocalDateTime(dv.validUntil, '23:59') || null,
            contactName: dv.contactName || '',
            contactPhone: dv.contactPhone || '',
            contactEmail: dv.contactEmail || '',
            deliveryIncluded: dv.deliveryIncluded || false,
            notes: dv.notes || '',
            status: 'pending'
          };
          const onDone = (savedDv: Partial<Devis>) => {
            const list = this.devisMap.get(created.id) || [];
            list.push({ id: savedDv.id || `local-${Date.now()}-${idx}`, borrowedItemId: created.id, supplierName: dv.supplierName, amount: Number(dv.amount), status: 'pending', expanded: false } as Devis);
            this.devisMap.set(created.id, list);
            done++;
            if (done === filledDevis.length) {
              this.saving = false;
              this.loadItems();
              this.closeNeedModal();
              this.showToast('Request created with 3 quotes. Pending treasurer validation.', 'success');
            }
          };
          this.http.post<Devis>(`${this.apiUrl}/devis`, dvPayload).pipe(takeUntil(this.destroy$)).subscribe({ next: onDone, error: () => onDone({}) });
        });
      },
      error: (e) => {
        this.saving = false;
        this.errorMessage = `Error: ${e.error?.error || e.statusText || 'Unknown error'}`;
      }
    });
  }

  exportAllNeedsPdf() {
    this.http.get(`${this.apiUrl}/borrowed-items/export/pdf`, { responseType: 'blob' })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (blob) => {
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `all_needs_report.pdf`;
          a.click();
          window.URL.revokeObjectURL(url);
          this.showToast('PDF exported successfully.', 'success');
        },
        error: () => {
          this.showToast('PDF export failed.', 'error');
        }
      });
  }
}
