import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { apiUrl } from '../../../../environments/environment';
import { AuthService } from '../../../shared/services/auth.service';

interface AudioReport {
  id: string;
  channelName: string;
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
}

@Component({
  selector: 'app-voice2-my-reports',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './my-reports.component.html',
})
export class Voice2MyReportsComponent implements OnInit {
  reports: AudioReport[] = [];
  loading = false;
  error = '';
  private playingId: string | null = null;
  private activeAudio: HTMLAudioElement | null = null;
  private readonly api = apiUrl('/api/voice2/reports');

  constructor(private http: HttpClient, private auth: AuthService) {}

  ngOnInit(): void {
    const user = this.auth.getCurrentUser();
    if (!user?.userId) {
      this.error = 'User session not found.';
      return;
    }
    this.loading = true;
    this.error = '';
    this.http
      .get<AudioReport[]>(`${this.api}?reportedByUserId=${encodeURIComponent(user.userId)}`)
      .subscribe({
        next: (rows) => {
          this.reports = rows;
          this.loading = false;
        },
        error: () => {
          this.error = 'Unable to load your reports.';
          this.loading = false;
        },
      });
  }

  playAudio(report: AudioReport): void {
    if (this.activeAudio) {
      this.activeAudio.pause();
      this.activeAudio = null;
      if (this.playingId === report.id) {
        this.playingId = null;
        return;
      }
    }
    const audio = new Audio(`data:${report.contentType};base64,${report.audioData}`);
    audio.play().catch(() => {});
    audio.onended = () => {
      this.playingId = null;
      this.activeAudio = null;
    };
    this.activeAudio = audio;
    this.playingId = report.id;
  }

  isPlaying(id: string): boolean {
    return this.playingId === id;
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleString();
  }

  reasonLabel(reason: string): string {
    return (
      {
        INAPPROPRIATE: 'Inappropriate content',
        HARASSMENT: 'Harassment or bullying',
        SPAM: 'Spam',
        OTHER: 'Other',
      } as any
    )[reason] ?? reason;
  }
}
