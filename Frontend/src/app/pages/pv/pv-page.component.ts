import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MeetingPv, MeetingPvService, PendingPvEvent } from '../../shared/services/meeting-pv.service';
import { PvWizardComponent } from './pv-wizard/pv-wizard.component';

/**
 * Single page that combines:
 *   - the wizard for creating a new PV (collapsible)
 *   - the history of previously-saved PVs (download / delete)
 *
 * The page is reachable only by users with role SECRETAIRE_GENERALE
 * (enforced by `secretaryGuard` on the route).
 */
@Component({
  selector: 'app-pv-page',
  standalone: true,
  imports: [CommonModule, FormsModule, PvWizardComponent],
  templateUrl: './pv-page.component.html',
  styleUrl: './pv-page.component.css'
})
export class PvPageComponent implements OnInit {
  pendingCount = 0;
  history: MeetingPv[] = [];

  /** When set, the wizard panel is open. */
  wizardOpenWith: PendingPvEvent | null = null;
  wizardVisible = false;

  loadingHistory = false;
  expandedId: string | null = null;

  constructor(private pvService: MeetingPvService) {}

  ngOnInit(): void {
    this.refresh();
  }

  refresh(): void {
    this.loadingHistory = true;
    this.pvService.getPending().subscribe({
      next: list => this.pendingCount = list.length,
      error: () => this.pendingCount = 0
    });
    this.pvService.list().subscribe({
      next: list => { this.history = list; this.loadingHistory = false; },
      error: () => this.loadingHistory = false
    });
  }

  startWizard(event?: PendingPvEvent): void {
    this.wizardOpenWith = event ?? null;
    this.wizardVisible = true;
  }

  onWizardCompleted(): void {
    this.wizardVisible = false;
    this.wizardOpenWith = null;
    this.refresh();
  }

  onWizardCancelled(): void {
    this.wizardVisible = false;
    this.wizardOpenWith = null;
  }

  toggleExpand(id: string): void {
    this.expandedId = this.expandedId === id ? null : id;
  }

  download(pv: MeetingPv): void {
    // Open in a new tab — the backend sets Content-Disposition: attachment
    // so the browser triggers the download dialog.
    window.open(this.pvService.pdfUrl(pv.id), '_blank');
  }

  remove(pv: MeetingPv): void {
    if (!confirm(`Supprimer le PV de « ${pv.eventTitle} » ? Cette action est irréversible.`)) {
      return;
    }
    this.pvService.delete(pv.id).subscribe({
      next: () => this.refresh(),
      error: (err) => alert('Échec de la suppression : ' + (err?.error?.error || 'erreur inconnue'))
    });
  }
}
