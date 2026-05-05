import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';

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
  selector: 'app-my-reports',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './my-reports.component.html',
})
export class MyReportsComponent implements OnInit {

  reports: AudioReport[] = [];
  loading = false;
  currentUserName = '';
  private playingId: string | null = null;
  private activeAudio: HTMLAudioElement | null = null;

  private readonly api = 'http://localhost:8080/api/reports';

  constructor(private http: HttpClient, private authService: AuthService) {}

  ngOnInit() {
    const user = this.authService.getCurrentUser();
    if (!user?.userId) return;
    this.authService.getMe().subscribe({
      next: (data: any) => {
        this.currentUserName = `${data?.firstName ?? ''} ${data?.lastName ?? ''}`.trim() || data?.email || 'You';
      },
      error: () => {}
    });
    this.loading = true;
    this.http.get<AudioReport[]>(`${this.api}?reportedByUserId=${user.userId}`).subscribe({
      next: (data) => { this.reports = data; this.loading = false; },
      error: () => { this.loading = false; }
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

  isPlaying(id: string): boolean { return this.playingId === id; }

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
    const map: Record<string, string> = { WARNING: 'Warning issued', DELETE_AUDIO: 'Audio deleted' };
    return type.split(',').map(t => map[t] ?? t).join(' + ');
  }
}
