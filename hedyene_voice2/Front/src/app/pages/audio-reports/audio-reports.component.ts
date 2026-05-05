import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

interface AudioReport {
  id: string;
  audioMessageId: string;
  channelId: string;
  channelName: string;
  reportedByUserId: string;
  reportedByUserName: string;
  reportedUserId: string;
  reportedUserName: string;
  audioData: string;
  contentType: string;
  reason: string;
  details: string;
  status: string;
  decisionType: string;
  decisionText: string;
  treatedAt: string;
  createdAt: string;
  aiGenerated: boolean;
  aiConfidence: number;
  aiTranscript: string;
}

@Component({
  selector: 'app-audio-reports',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './audio-reports.component.html',
})
export class AudioReportsComponent implements OnInit {

  reports: AudioReport[] = [];
  loading = false;
  statusFilter = 'ALL';
  updatingId: string | null = null;
  deletingId: string | null = null;
  playingId: string | null = null;
  private activeAudio: HTMLAudioElement | null = null;

  // Decision modal
  decisionReport: AudioReport | null = null;
  decisionTypeWarning = false;
  decisionTypeDeleteAudio = false;
  decisionText = '';
  decisionSubmitting = false;

  private readonly api = 'http://localhost:8080/api/reports';

  constructor(private http: HttpClient) {}

  ngOnInit() { this.loadReports(); }

  loadReports() {
    this.loading = true;
    const url = this.statusFilter === 'ALL'
      ? this.api
      : `${this.api}?status=${this.statusFilter}`;
    this.http.get<AudioReport[]>(url).subscribe({
      next: (data) => { this.reports = data; this.loading = false; },
      error: () => { this.loading = false; }
    });
  }

  openDecisionModal(report: AudioReport) {
    this.decisionReport = report;
    const types = (report.decisionType ?? '').split(',');
    this.decisionTypeWarning = types.includes('WARNING');
    this.decisionTypeDeleteAudio = types.includes('DELETE_AUDIO');
    this.decisionText = report.decisionText ?? '';
  }

  closeDecisionModal() {
    this.decisionReport = null;
    this.decisionTypeWarning = false;
    this.decisionTypeDeleteAudio = false;
    this.decisionText = '';
  }

  submitDecision() {
    if (!this.decisionReport || (!this.decisionTypeWarning && !this.decisionTypeDeleteAudio)) return;
    const types = [
      this.decisionTypeWarning ? 'WARNING' : null,
      this.decisionTypeDeleteAudio ? 'DELETE_AUDIO' : null
    ].filter(Boolean).join(',');
    this.decisionSubmitting = true;
    this.http.patch(`${this.api}/${this.decisionReport.id}/status`, {
      status: 'REVIEWED',
      decisionType: types,
      decisionText: this.decisionText
    }).subscribe({
      next: (updated: any) => {
        const idx = this.reports.findIndex(r => r.id === updated.id);
        if (idx !== -1) this.reports[idx] = updated;
        this.decisionSubmitting = false;
        this.closeDecisionModal();
        if (this.statusFilter !== 'ALL') this.loadReports();
      },
      error: () => { this.decisionSubmitting = false; }
    });
  }

  updateStatus(report: AudioReport, status: string) {
    this.updatingId = report.id;
    this.http.patch(`${this.api}/${report.id}/status`, { status }).subscribe({
      next: (updated: any) => {
        report.status = updated.status;
        this.updatingId = null;
        if (this.statusFilter !== 'ALL') this.loadReports();
      },
      error: () => { this.updatingId = null; }
    });
  }

  playAudio(report: AudioReport) {
    if (this.activeAudio) {
      this.activeAudio.pause();
      this.activeAudio = null;
      if (this.playingId === report.id) { this.playingId = null; return; }
    }
    const audio = new Audio(`data:${report.contentType};base64,${report.audioData}`);
    audio.play().catch(() => {});
    audio.onended = () => { this.playingId = null; this.activeAudio = null; };
    this.activeAudio = audio;
    this.playingId = report.id;
  }

  deleteReport(report: AudioReport) {
    this.deletingId = report.id;
    this.http.delete(`${this.api}/${report.id}`).subscribe({
      next: () => {
        this.reports = this.reports.filter(r => r.id !== report.id);
        this.deletingId = null;
      },
      error: () => { this.deletingId = null; }
    });
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleString();
  }

  reasonLabel(reason: string): string {
    return ({
      INAPPROPRIATE: 'Inappropriate content',
      HARASSMENT: 'Harassment or bullying',
      SPAM: 'Spam',
      OTHER: 'Other'
    } as any)[reason] ?? reason;
  }

  decisionLabel(type: string): string {
    const map: Record<string, string> = { WARNING: 'Warning issued', DELETE_AUDIO: 'Audio hidden' };
    return type.split(',').map(t => map[t] ?? t).join(' + ');
  }

  get pendingCount(): number {
    return this.reports.filter(r => r.status === 'PENDING').length;
  }
}
