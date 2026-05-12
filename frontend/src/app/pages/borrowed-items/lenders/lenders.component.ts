// src/app/pages/borrowed-items/lenders/lenders.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil, finalize, debounceTime, distinctUntilChanged } from 'rxjs';

import { BorrowingService } from '../../../shared/services/borrowing.service';
import { Lender, BorrowedItem } from '../../../shared/interfaces/borrowed-item.interface';

// ── Component ────────────────────────────────────────────────────
@Component({
  selector: 'app-lenders',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './lenders.component.html'
})
export class LendersComponent implements OnInit, OnDestroy {

  // ── Data ──────────────────────────────────────────────────────
  lenders:         Lender[] = [];
  filteredLenders: Lender[] = [];

  // ── UI state ──────────────────────────────────────────────────
  loading       = false;
  detailLoading = false;

  searchTerm          = '';
  selectedReliability = 'all';

  showDetailModal = false;
  selectedLender: Lender | null = null;
  lenderItems: BorrowedItem[] = [];

  private readonly destroy$ = new Subject<void>();

  // ── Constructor ───────────────────────────────────────────────
  constructor(
    private borrowingService: BorrowingService,
    private route: ActivatedRoute
  ) {}

  // ── Lifecycle ─────────────────────────────────────────────────
  ngOnInit(): void {
    this.loadLenders();

    // Deep-link: open modal if ?lender=<name> is in the URL
    this.route.queryParams
      .pipe(takeUntil(this.destroy$))
      .subscribe(params => {
        if (params['lender']) {
          // Wait until lenders are loaded before opening
          const tryOpen = () => {
            const found = this.lenders.find(l => l.name === params['lender']);
            if (found) this.viewLenderDetails(found);
          };
          // Retry once after a short delay in case data isn't loaded yet
          if (this.lenders.length) tryOpen();
          else setTimeout(tryOpen, 800);
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ── Load ──────────────────────────────────────────────────────
  loadLenders(): void {
    this.loading = true;
    this.borrowingService.getLenders()
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.loading = false)
      )
      .subscribe({
        next: (data) => {
          this.lenders         = data ?? [];
          this.filteredLenders = [...this.lenders];
          this.applyFilters();
        },
        error: (err) => {
          console.error('Error loading lenders:', err);
          this.lenders         = [];
          this.filteredLenders = [];
        }
      });
  }

  // ── Filter / search ───────────────────────────────────────────
  filterLenders(): void {
    this.applyFilters();
  }

  private applyFilters(): void {
    const term = this.searchTerm.trim().toLowerCase();
    this.filteredLenders = this.lenders.filter(lender => {
      const matchesSearch = !term || [
        lender.name,
        lender.contactPerson,
        lender.phone,
        lender.email,
        lender.address
      ].some(field => field?.toLowerCase().includes(term));

      const matchesReliability =
        this.selectedReliability === 'all' ||
        lender.reliability === this.selectedReliability;

      return matchesSearch && matchesReliability;
    });
  }

  clearFilters(): void {
    this.searchTerm          = '';
    this.selectedReliability = 'all';
    this.applyFilters();
  }

  // ── Detail modal ──────────────────────────────────────────────
  viewLenderDetails(lender: Lender): void {
    this.selectedLender  = lender;
    this.showDetailModal = true;
    this.lenderItems     = [];
    this.detailLoading   = true;

    this.borrowingService.getLenderDetails(lender.name)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.detailLoading = false)
      )
      .subscribe({
next: (data) => { this.lenderItems = (data.items as BorrowedItem[]) ?? []; },        error: (err)  => { console.error('Error loading lender details:', err); this.lenderItems = []; }
      });
  }

  closeDetailModal(): void {
    this.showDetailModal = false;
    this.selectedLender  = null;
    this.lenderItems     = [];
  }

  // ── Delete ────────────────────────────────────────────────────
  deleteLender(lender: Lender, event?: Event): void {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    if (!lender.id) {
      alert("This lender hasn't been saved yet — refresh the page first.");
      return;
    }
    const confirmMsg = `Delete the lender "${lender.name}"?\n\n` +
      `Borrowed items linked to this lender will keep its name as a label, ` +
      `but the lender record itself will be permanently removed.`;
    if (!confirm(confirmMsg)) return;

    this.borrowingService.deleteLender(lender.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.lenders         = this.lenders.filter(l => l.id !== lender.id);
          this.filteredLenders = this.filteredLenders.filter(l => l.id !== lender.id);
          if (this.selectedLender?.id === lender.id) this.closeDetailModal();
        },
        error: (err) => {
          console.error('Failed to delete lender:', err);
          alert('Failed to delete the lender. Please try again.');
        }
      });
  }

  // ── Stats ─────────────────────────────────────────────────────
  getStats() {
    const high   = this.lenders.filter(l => l.reliability === 'high').length;
    const medium = this.lenders.filter(l => l.reliability === 'medium').length;
    const low    = this.lenders.filter(l => l.reliability === 'low').length;
    const totalBorrows  = this.lenders.reduce((s, l) => s + (l.totalBorrows  || 0), 0);
    const totalOnTime   = this.lenders.reduce((s, l) => s + (l.onTimeReturns || 0), 0);
    return { total: this.lenders.length, high, medium, low, totalBorrows, totalOnTime };
  }

  /** Per-lender on-time rate as 0–100 */
  onTimeRate(lender: Lender): number {
    const total = lender.totalBorrows || 0;
    if (!total) return 0;
    return Math.round(((lender.onTimeReturns || 0) / total) * 100);
  }

  /** Tailwind class for progress bar fill */
  rateBarColor(lender: Lender): string {
    const r = this.onTimeRate(lender);
    if (r >= 90) return 'bg-emerald-500';
    if (r >= 70) return 'bg-amber-500';
    return 'bg-red-500';
  }

  // ── Status / category helpers ─────────────────────────────────

  getCategoryIcon(cat: string): string {
    const m: Record<string, string> = {
      audio_visual: '🎥', furniture: '🪑', decoration: '🎨',
      catering: '🍽️', tools: '🔧', equipment: '📡', vehicles: '🚚', other: '📦'
    };
    return m[cat] ?? '📦';
  }

  getStatusColor(s: string): string {
    const m: Record<string, string> = {
      requested:  'bg-amber-100 text-amber-700',
      approved:   'bg-blue-100 text-blue-700',
      picked_up:  'bg-purple-100 text-purple-700',
      in_use:     'bg-indigo-100 text-indigo-700',
      returned:   'bg-emerald-100 text-emerald-700',
      overdue:    'bg-red-100 text-red-700',
      cancelled:  'bg-gray-100 text-gray-500',
    };
    return m[s] ?? 'bg-gray-100 text-gray-500';
  }

  getStatusText(s: string): string {
    const m: Record<string, string> = {
      requested: 'Requested', approved: 'Approved', picked_up: 'Picked Up',
      in_use: 'In Use', returned: 'Returned', overdue: 'Overdue', cancelled: 'Cancelled'
    };
    return m[s] ?? s;
  }

  getReliabilityColor(r: string | undefined): string {
    switch (r) {
      case 'high':   return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
      case 'medium': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
      case 'low':    return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
      default:       return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300';
    }
  }

  getReliabilityIcon(r: string | undefined): string {
    return r === 'high' ? '✅' : r === 'low' ? '❌' : '⚠️';
  }

  getReliabilityText(r: string | undefined): string {
    return r ? (r.charAt(0).toUpperCase() + r.slice(1)) : 'Unknown';
  }

  /** Top-stripe color per reliability */
  reliabilityStripeClass(r: string | undefined): string {
    return r === 'high' ? 'bg-emerald-400' : r === 'low' ? 'bg-red-400' : 'bg-amber-400';
  }

  /** True if item's expected return date has passed and it's not returned */
  isItemOverdue(item: BorrowedItem): boolean {
    return item.status !== 'returned' && new Date(item.expectedReturnDate) < new Date();
  }
}