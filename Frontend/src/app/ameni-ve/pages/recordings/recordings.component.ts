import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RecordService } from '../../services/record.service';
import { AuthService } from '../../../shared/services/auth.service';
import { CommitteeResponsableService } from '../../../shared/services/committee-responsable.service';
import { Router } from '@angular/router';
import { catchError, forkJoin, map, of } from 'rxjs';

@Component({
  selector: 'app-recordings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './recordings.component.html'
})
export class RecordingsComponent implements OnInit {

  records: any[] = [];
  selectedFile!: File;
  loading = false;
  selectedRecord: any = null;
  private initialized = false;

  constructor(
    private recordService: RecordService,
    public authService: AuthService,
    public committeeResponsableService: CommitteeResponsableService,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Tous les utilisateurs autorises (event managers + bureau) peuvent
    // consulter les transcriptions / recordings. Plus de redirect dur :
    // la page se charge, et si la BDD est vide on affiche un empty state.
    if (!this.initialized) {
      this.initialized = true;
      this.loadRecords();
    }
    this.committeeResponsableService.responsableStatus$.subscribe(() => {
      // Refresh canAccess() reactivement (pour les boutons admin du template).
    });
  }

  canAccess(): boolean {
    const role = this.authService.getCurrentRole();
    if (role === 'PRESIDENT' || role === 'VICE_PRESIDENT' ||
        role === 'SECRETAIRE_GENERALE' || role === 'SECRETAIRE_GENERAL') return true;
    const isResponsable = this.committeeResponsableService.isResponsable();
    const groupName = (this.committeeResponsableService.getMySubGroupName() || '').toLowerCase();
    return isResponsable && (groupName.includes('event') || groupName.includes('evenement'));
  }

  loadRecords() {
    this.loading = true;
    this.recordService.getAllRecords().subscribe({
      next: (data) => {
        const list = Array.isArray(data) ? data : [];
        if (list.length === 0) {
          this.records = [];
          this.loading = false;
          return;
        }

        forkJoin(
          list.map(record =>
            this.recordService.getTranscriptions(record.id).pipe(
              map(tsRaw => {
                const tsList = this.normalizeTranscriptions(tsRaw);
                const latest = tsList[0];
                return {
                  ...record,
                  transcript: latest
                    ? (latest.text || latest.transcript || latest.content || String(latest))
                    : null
                };
              }),
              catchError(() => of({ ...record, transcript: null }))
            )
          )
        ).subscribe(recordsWithTranscripts => {
          this.records = recordsWithTranscripts;
          this.loading = false;
        });
      },
      error: (err) => {
        console.error(err);
        this.loading = false;
      }
    });
  }

  /**
   * Backend can return either:
   *  - an array of transcriptions
   *  - a paged payload { content: [...] }
   *  - a single object
   * We normalize into a sorted array (newest first).
   */
  private normalizeTranscriptions(payload: any): any[] {
    let rows: any[] = [];
    if (Array.isArray(payload)) {
      rows = payload;
    } else if (Array.isArray(payload?.content)) {
      rows = payload.content;
    } else if (payload && typeof payload === 'object') {
      rows = [payload];
    }

    return rows
      .filter(Boolean)
      .sort((a, b) => {
        const ta = new Date(a?.createdAt || a?.timestamp || 0).getTime();
        const tb = new Date(b?.createdAt || b?.timestamp || 0).getTime();
        return tb - ta;
      });
  }

  // 📤 SELECT FILE
  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (!file) return;
    this.selectedFile = file;
    this.upload();
  }

  // 🚀 UPLOAD + TRANSCRIBE
  upload() {
    if (!this.selectedFile) {
      alert("Choisir un fichier");
      return;
    }
    this.loading = true;
    const record = {
      fileUrl: "temp",
      gdprConsent: true,
      virtualEvent: null
    };
    this.recordService.createRecord(record).subscribe({
      next: (created) => {
        this.recordService.transcribe(created.id, this.selectedFile)
          .subscribe({
            next: () => {
              alert("✅ Transcription réussie !");
              this.loading = false;
              this.loadRecords();
            },
            error: () => {
              alert("❌ erreur transcription");
              this.loading = false;
            }
          });
      },
      error: () => {
        alert("❌ erreur création record");
        this.loading = false;
      }
    });
  }

  // ▶️ PLAY AUDIO
  play(record: any) {
    if (record.fileUrl && record.fileUrl !== 'temp') {
      window.open(record.fileUrl, '_blank');
    } else {
      alert("Pas d’audio disponible");
    }
  }

  viewTranscript(record: any) {
    this.selectedRecord = record;
  }

  closeTranscript() {
    this.selectedRecord = null;
  }

  copyTranscript() {
    if (this.selectedRecord?.transcript) {
      navigator.clipboard.writeText(this.selectedRecord.transcript).then(() => {
        alert('Transcript copied to clipboard!');
      });
    }
  }

  // 🗑 DELETE
  delete(id: string) {
    if (!confirm("Supprimer ?")) return;

    this.recordService.deleteRecord(id).subscribe(() => {
      this.records = this.records.filter(r => r.id !== id);
    });
  }

  // 📄 PDF DOWNLOAD
  downloadPdf(recordId: string) {
    this.recordService.downloadPdf(recordId).subscribe({
      next: (blob: Blob) => {
        if (blob.size === 0) {
          alert("❌ PDF vide !");
          return;
        }
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'transcription.pdf';
        a.click();
        window.URL.revokeObjectURL(url);
      },
      error: () => {
        alert("❌ erreur téléchargement PDF");
      }
    });
  }
}