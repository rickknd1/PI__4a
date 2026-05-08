import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, DecimalPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { AuthService } from '../../../shared/services/auth.service';

interface Preset {
  key: string;
  label: string;
  start: string;
  end: string;
  icon?: string;
}

@Component({
  selector: 'app-rapports',
  standalone: true,
  imports: [CommonModule, DecimalPipe, DatePipe, FormsModule],
  templateUrl: './rapports.component.html',
})
export class RapportsComponent implements OnInit {
  clubId: number | string = 1;
  loading = false;
  error = '';
  success = '';
  bilan: any = null;

  presets: Preset[] = [];
  selectedKey = 'this-month';

  customStart = '';
  customEnd = '';
  customLabel = 'Bilan personnalise';

  pdfPreviewUrl: SafeResourceUrl | null = null;
  pdfBlobUrl = '';

  private http = inject(HttpClient);
  private sanitizer = inject(DomSanitizer);
  private auth = inject(AuthService);
  private base = 'http://localhost:8084/api/v1/treasury';

  ngOnInit() {
    const u = this.auth.getCurrentUser();
    this.clubId = (u?.clubId as any) ?? 1;
    this.buildPresets();
    // Charge automatiquement le mois en cours
    this.applyPreset(this.presets.find(p => p.key === 'this-month')!);
  }

  /** Construit les presets dynamiquement a partir de la date du jour */
  private buildPresets() {
    const today = new Date();
    const y = today.getFullYear();
    const m = today.getMonth(); // 0-indexed

    // 1. Mois en cours
    const monthStart = new Date(y, m, 1);
    const monthEnd = new Date(y, m + 1, 0);

    // 2. Mois dernier
    const lastMonthStart = new Date(y, m - 1, 1);
    const lastMonthEnd = new Date(y, m, 0);

    // 3. Trimestre en cours
    const qStartMonth = Math.floor(m / 3) * 3;
    const qStart = new Date(y, qStartMonth, 1);
    const qEnd = new Date(y, qStartMonth + 3, 0);

    // 4. Annee scolaire (sept N-1 -> aout N)
    const schoolStartYear = m >= 8 ? y : y - 1;
    const schoolStart = new Date(schoolStartYear, 8, 1);
    const schoolEnd = new Date(schoolStartYear + 1, 7, 31);

    // 5. Annee civile en cours
    const yearStart = new Date(y, 0, 1);
    const yearEnd = new Date(y, 11, 31);

    // 6. Tout l'historique
    const allStart = new Date(2024, 0, 1);
    const allEnd = new Date(y + 1, 11, 31);

    const monthName = ['Janvier','Fevrier','Mars','Avril','Mai','Juin','Juillet','Aout','Septembre','Octobre','Novembre','Decembre'];

    this.presets = [
      {
        key: 'this-month',
        label: `Mois en cours (${monthName[m]} ${y})`,
        start: this.fmt(monthStart),
        end: this.fmt(monthEnd),
      },
      {
        key: 'last-month',
        label: `Mois dernier (${monthName[(m + 11) % 12]} ${m === 0 ? y - 1 : y})`,
        start: this.fmt(lastMonthStart),
        end: this.fmt(lastMonthEnd),
      },
      {
        key: 'this-quarter',
        label: `Trimestre en cours (${monthName[qStartMonth]}-${monthName[qStartMonth + 2]} ${y})`,
        start: this.fmt(qStart),
        end: this.fmt(qEnd),
      },
      {
        key: 'school-year',
        label: `Annee scolaire ${schoolStartYear}/${schoolStartYear + 1}`,
        start: this.fmt(schoolStart),
        end: this.fmt(schoolEnd),
      },
      {
        key: 'this-year',
        label: `Annee civile ${y}`,
        start: this.fmt(yearStart),
        end: this.fmt(yearEnd),
      },
      {
        key: 'all',
        label: `Tout l'historique`,
        start: this.fmt(allStart),
        end: this.fmt(allEnd),
      },
      {
        key: 'custom',
        label: 'Personnalise',
        start: '',
        end: '',
      },
    ];
  }

  applyPreset(p: Preset) {
    this.selectedKey = p.key;
    if (p.key !== 'custom') {
      this.customStart = p.start;
      this.customEnd = p.end;
      this.customLabel = p.label;
      this.generatePreview();
    }
  }

  /** Auto-genere l'apercu quand les dates personnalisees changent. */
  onCustomDateChange() {
    this.selectedKey = 'custom';
    if (this.customStart && this.customEnd && this.customStart <= this.customEnd) {
      this.customLabel = 'Bilan personnalise';
      this.generatePreview();
    }
  }

  /** Recupere le bilan en JSON (apercu). */
  generatePreview() {
    if (!this.customStart || !this.customEnd) return;
    this.loading = true;
    this.error = '';
    this.bilan = null;
    this.closePdfPreview();
    const url = `${this.base}/${this.clubId}/bilans?start=${this.customStart}&end=${this.customEnd}&label=${encodeURIComponent(this.customLabel)}`;
    this.http.get<any>(url).subscribe({
      next: (data) => {
        this.bilan = this.mapBilan(data, this.customLabel, this.customStart, this.customEnd);
        this.loading = false;
      },
      error: (e) => {
        this.error = 'Erreur: ' + (e.error?.message || e.status);
        this.loading = false;
      }
    });
  }

  /** Charge le PDF dans un iframe pour preview avant telechargement. */
  showPdfPreview() {
    if (!this.bilan) return;
    this.loading = true;
    this.closePdfPreview();
    const url = `${this.base}/${this.clubId}/bilans/pdf?start=${this.customStart}&end=${this.customEnd}&label=${encodeURIComponent(this.customLabel)}`;
    this.http.get(url, { responseType: 'blob' }).subscribe({
      next: (blob) => {
        this.pdfBlobUrl = URL.createObjectURL(blob);
        this.pdfPreviewUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.pdfBlobUrl);
        this.loading = false;
      },
      error: () => { this.error = 'Erreur generation PDF.'; this.loading = false; }
    });
  }

  closePdfPreview() {
    if (this.pdfBlobUrl) URL.revokeObjectURL(this.pdfBlobUrl);
    this.pdfBlobUrl = '';
    this.pdfPreviewUrl = null;
  }

  downloadPdf() {
    if (!this.bilan) return;
    const url = `${this.base}/${this.clubId}/bilans/pdf?start=${this.customStart}&end=${this.customEnd}&label=${encodeURIComponent(this.customLabel)}`;
    this.http.get(url, { responseType: 'blob' }).subscribe({
      next: (blob) => {
        const u = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = u;
        a.download = `bilan-${this.customStart}-${this.customEnd}.pdf`;
        a.click();
        URL.revokeObjectURL(u);
        this.success = 'PDF telecharge !';
        setTimeout(() => this.success = '', 3000);
      },
      error: () => { this.error = 'Erreur telechargement PDF.'; }
    });
  }

  exportCSV() {
    if (!this.bilan) return;
    const rows = [
      ['Periode', this.bilan.label],
      ['Debut', this.bilan.periodStart],
      ['Fin', this.bilan.periodEnd],
      [''],
      ['Poste', 'Montant (TND)'],
      ['Recettes encaissees', this.bilan.totalCollected],
      ['Recettes en retard', this.bilan.totalLate ?? 0],
      ['Depenses approuvees', this.bilan.totalExpenses],
      ['Solde net', this.bilan.solde],
      ['Taux de recouvrement (%)', this.bilan.recoveryRate],
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bilan-${this.customStart}-${this.customEnd}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  private mapBilan(data: any, label: string, start: string, end: string): any {
    return {
      label: data.periodLabel || label,
      periodStart: data.startDate || start,
      periodEnd: data.endDate || end,
      totalCollected: data.totalRevenues || 0,
      totalLate: data.totalLate ?? 0,
      totalExpenses: data.totalExpensesApproved || data.totalApprovedExpenses || 0,
      solde: data.solde || 0,
      recoveryRate: data.recoveryRate || 0,
      paidCount: data.totalPaymentsPaid ?? data.paidCount ?? 0,
      lateCount: data.totalPaymentsLate ?? data.lateCount ?? 0,
      pendingCount: data.totalPaymentsPending ?? data.pendingCount ?? 0,
      expensesApproved: data.countExpensesApproved ?? 0,
      expensesPending: data.countExpensesPending ?? 0,
      expensesRejected: data.countExpensesRejected ?? 0,
    };
  }

  private fmt(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
}
