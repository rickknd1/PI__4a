import { Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { TreasuryApiService } from '../../services/treasury-api.service';
import { AuditLog, MockUser } from '../../models/treasury.models';

@Component({
  selector: 'app-audit',
  standalone: true,
  imports: [CommonModule, DatePipe, DecimalPipe, FormsModule],
  templateUrl: './audit.component.html',
})
export class AuditComponent implements OnInit {
  clubId = 1;
  allLogs: AuditLog[] = [];
  filtered: AuditLog[] = [];
  logs: AuditLog[] = [];
  loading = true;
  error = '';

  // Filtres
  filterAction = '';
  filterActor = '';
  filterEntityType = '';
  filterDateFrom = '';
  filterDateTo = '';
  searchQuery = '';

  // Pagination
  page = 0;
  pageSize = 10;
  pageSizeOptions = [10, 25, 50, 100];
  get total(): number { return this.filtered.length; }
  get totalPages(): number { return Math.max(1, Math.ceil(this.total / this.pageSize)); }
  get pageStart(): number { return this.total === 0 ? 0 : this.page * this.pageSize + 1; }
  get pageEnd(): number { return Math.min((this.page + 1) * this.pageSize, this.total); }

  // Modal detail
  selectedLog: AuditLog | null = null;

  // Member name resolution
  memberNames = new Map<string, string>();

  // Liste deroulante des types d'actions trouves dans la BDD (rempli a partir des logs)
  actionTypes: string[] = [];
  actorList: { id: string; name: string; email: string }[] = [];
  entityTypes: string[] = [];

  constructor(private api: TreasuryApiService, private http: HttpClient) {}

  ngOnInit() {
    this.loadMembers();
    this.api.getAuditLogs(this.clubId).subscribe({
      next: (data) => {
        this.allLogs = data;
        this.buildFilterOptions();
        this.applyFilters();
        this.loading = false;
      },
      error: () => { this.error = 'Impossible de charger le journal d audit.'; this.loading = false; }
    });
  }

  loadMembers() {
    this.http.get<MockUser[]>('http://localhost:8084/api/v1/users/club/1').subscribe({
      next: (users) => {
        users.forEach(u => this.memberNames.set(u.id, u.firstName + ' ' + u.lastName));
        this.buildFilterOptions();
        this.applyFilters();
      },
      error: () => {}
    });
  }

  /** Construit les listes deroulantes a partir des logs. */
  private buildFilterOptions() {
    this.actionTypes = Array.from(new Set(this.allLogs.map(l => l.action))).sort();
    this.entityTypes = Array.from(new Set(this.allLogs.map(l => l.entityType))).sort();
    const actorIds = Array.from(new Set(this.allLogs.map(l => l.actorId)));
    this.actorList = actorIds.map(id => {
      const log = this.allLogs.find(l => l.actorId === id);
      return {
        id,
        name: this.memberNames.get(id) || (log?.actorEmail?.split('@')[0] || 'Inconnu'),
        email: log?.actorEmail || ''
      };
    }).sort((a, b) => a.name.localeCompare(b.name));
  }

  resolveMember(id: string): string {
    return this.memberNames.get(id) || '#' + id?.slice(-6);
  }

  // ============================================================
  //  Filtres + recherche
  // ============================================================
  applyFilters() {
    let result = [...this.allLogs];

    if (this.filterAction) {
      result = result.filter(l => l.action === this.filterAction);
    }
    if (this.filterActor) {
      result = result.filter(l => l.actorId === this.filterActor);
    }
    if (this.filterEntityType) {
      result = result.filter(l => l.entityType === this.filterEntityType);
    }
    if (this.filterDateFrom) {
      const from = new Date(this.filterDateFrom).getTime();
      result = result.filter(l => new Date(l.timestamp).getTime() >= from);
    }
    if (this.filterDateTo) {
      const to = new Date(this.filterDateTo).getTime() + 86400000; // inclusif
      result = result.filter(l => new Date(l.timestamp).getTime() <= to);
    }
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.trim().toLowerCase();
      result = result.filter(l =>
        (l.actorEmail || '').toLowerCase().includes(q) ||
        (l.entityType || '').toLowerCase().includes(q) ||
        (l.entityId || '').toLowerCase().includes(q) ||
        (l.action || '').toLowerCase().includes(q) ||
        (l.valuesAfter || '').toLowerCase().includes(q) ||
        (l.valuesBefore || '').toLowerCase().includes(q)
      );
    }

    this.filtered = result;
    this.page = 0;
    this.applyView();
  }

  resetFilters() {
    this.filterAction = '';
    this.filterActor = '';
    this.filterEntityType = '';
    this.filterDateFrom = '';
    this.filterDateTo = '';
    this.searchQuery = '';
    this.applyFilters();
  }

  applyView() {
    const start = this.page * this.pageSize;
    this.logs = this.filtered.slice(start, start + this.pageSize);
  }

  changePageSize() {
    this.page = 0;
    this.applyView();
  }

  goToPage(p: number) {
    this.page = Math.max(0, Math.min(p, this.totalPages - 1));
    this.applyView();
  }

  // ============================================================
  //  Compteurs par type entite
  // ============================================================
  countByType(type: string): number {
    return this.allLogs.filter(l => l.entityType === type).length;
  }

  // ============================================================
  //  Export CSV
  // ============================================================
  exportCsv() {
    const headers = ['Date', 'Acteur', 'Email', 'Action', 'Type entite', 'ID entite', 'Avant', 'Apres', 'Montant TND'];
    const esc = (v: any) => {
      if (v == null) return '';
      const s = String(v).replace(/"/g, '""');
      return /[",\n]/.test(s) ? `"${s}"` : s;
    };
    const rows = this.filtered.map(l => [
      new Date(l.timestamp).toISOString(),
      this.resolveMember(l.actorId),
      l.actorEmail,
      l.action,
      l.entityType,
      l.entityId,
      l.valuesBefore || '',
      l.valuesAfter || '',
      l.amount ?? ''
    ].map(esc).join(','));
    const csv = '﻿' + [headers.join(','), ...rows].join('\n'); // BOM UTF-8 pour Excel
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    a.download = `audit-clubhub-${stamp}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  exportJson() {
    const blob = new Blob([JSON.stringify(this.filtered, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    a.download = `audit-clubhub-${stamp}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ============================================================
  //  Modal detail
  // ============================================================
  openDetail(log: AuditLog) { this.selectedLog = log; }
  closeDetail() { this.selectedLog = null; }

  // ============================================================
  //  Formatage
  // ============================================================
  formatAction(action: string): string {
    const map: Record<string, string> = {
      'PAYMENT_CREATED': 'Paiement cree',
      'PAYMENT_UPDATED': 'Paiement MAJ',
      'PAYMENT_REFUNDED': 'Remboursement',
      'EXPENSE_SUBMITTED': 'Depense soumise',
      'EXPENSE_VALIDATED': 'Depense validee',
      'EXPENSE_APPROVED': 'Depense approuvee',
      'EXPENSE_REJECTED': 'Depense rejetee',
      'COTISATION_RULE_CREATED': 'Regle creee',
      'COTISATION_RULE_UPDATED': 'Regle MAJ',
      'BUDGET_CREATED': 'Budget cree',
      'BUDGET_UPDATED': 'Budget MAJ',
      'RECEIPT_GENERATED': 'Recu genere',
    };
    return map[action] ?? action;
  }

  actionClass(action: string): string {
    if (action.includes('APPROVED') || action.includes('CREATED')) return 'bg-green-100 text-green-700';
    if (action.includes('REJECTED')) return 'bg-red-100 text-red-700';
    if (action.includes('REFUNDED')) return 'bg-blue-100 text-blue-700';
    if (action.includes('VALIDATED') || action.includes('UPDATED')) return 'bg-yellow-100 text-yellow-700';
    return 'bg-gray-100 text-gray-600';
  }
}
