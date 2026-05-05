import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { finalize } from 'rxjs/operators';
import { AuthService } from '../../shared/services/auth.service';
import { EventFeedbackModalComponent } from '../../shared/components/event-feedback-modal/event-feedback-modal.component';
import { apiUrl } from '../../../environments/environment';

export interface EventDetails {
  id?: string;
  title: string;
  description?: string;
  shortDescription?: string;
  staff?: { name: string; role: string; budget?: number }[];
  startDate: string;
  endDate: string;
  status: string;
  capacity?: number;
  location?: any;
  participantCount?: number;
  remainingSpots?: number;
  isFull?: boolean;
}

export interface RSVPResponse {
  success: boolean;
  message: string;
  eventId: string;
  eventTitle: string;
  userName: string;
  userEmail: string;
  qrUrl: string;
  currentParticipantCount: number;
  remainingSpots: number;
  eventFull: boolean;
}

@Component({
  selector: 'app-rsvp',
  standalone: true,
  imports: [CommonModule, FormsModule, EventFeedbackModalComponent],
  templateUrl: './rsvp.component.html'
})
export class RsvpComponent implements OnInit {
  events: EventDetails[] = [];
  filteredEvents: EventDetails[] = [];
  loading = false;
  activeFilter = 'All';
  statusFilters = ['All', 'published', 'joined', 'completed', 'cancelled'];
  
  userParticipations: { [eventId: string]: boolean } = {};

  currentUser: { id: string; email: string; name: string } = { id: '', email: '', name: '' };

  // ── Feedback modal state ──────────────────────────────────────────────
  feedbackOpen = false;
  feedbackEvent: EventDetails | null = null;

  // ── QR ticket modal state ─────────────────────────────────────────────
  // Le backend génère le QR à chaque POST /api/rsvp et l'envoie par email.
  // On garde aussi l'URL côté client (cache mémoire + sessionStorage) pour
  // afficher un QR à l'écran que l'utilisateur peut scanner à l'entrée
  // sans aller chercher son mail. Chaque entrée de la map est l'URL
  // encodée dans le QR (le payload, pas l'image).
  qrModalOpen = false;
  qrModalEvent: EventDetails | null = null;
  qrUrlByEvent: { [eventId: string]: string } = {};

  private baseUrl = apiUrl('/api');

  constructor(private http: HttpClient, private authService: AuthService) {}
  
  ngOnInit() {
    const user = this.authService.getUser();
    if (!user || !user.id) {
      this.currentUser = { id: '', email: '', name: 'Guest' };
    } else {
      this.currentUser = {
        id: user.id,
        email: user.email,
        name: user.name
      };
    }
    // Restore previously cached QR URLs so reloading the page keeps the
    // tickets visible. Cache key namespaces by user id to avoid leaking
    // QR data across accounts on a shared browser.
    try {
      const raw = sessionStorage.getItem('rsvp.qr.' + this.currentUser.id);
      if (raw) this.qrUrlByEvent = JSON.parse(raw) || {};
    } catch (_) { /* ignore */ }
    this.loadEvents();
  }

  private persistQrCache(): void {
    try {
      sessionStorage.setItem(
        'rsvp.qr.' + this.currentUser.id,
        JSON.stringify(this.qrUrlByEvent),
      );
    } catch (_) { /* ignore quota errors */ }
  }
  
  getPublishedCount(): number {
    return this.events.filter(e => e.status === 'published').length;
  }
  
  getJoinedCount(): number {
    return Object.values(this.userParticipations).filter(v => v === true).length;
  }
  
  getCompletedCount(): number {
    return this.events.filter(e => e.status === 'completed').length;
  }
  
  loadEvents() {
    this.loading = true;
    this.http.get<EventDetails[]>(`${this.baseUrl}/events/with-counts`)
      .pipe(finalize(() => this.loading = false))
      .subscribe({
        next: (events) => {
          this.events = events;
          this.filterEvents();
          this.loadParticipationStatuses();
        },
        error: (err) => { console.error('Failed to load events', err); alert('Failed to load events. Please refresh the page.'); }
      });
  }
  
  loadParticipationStatuses() {
    if (this.events.length === 0) return;
    
    const eventIds = this.events.map(e => e.id!);
    this.http.post<{ [key: string]: boolean }>(`${this.baseUrl}/rsvp/check-batch`, {
      eventIds: eventIds,
      userId: [this.currentUser.id]
    }).subscribe({
      next: (statuses) => {
        this.userParticipations = statuses;
        this.filterEvents();
      },
      error: (err) => { console.error('Failed to load participation statuses', err); }
    });
  }
  
  filterEvents() {
    if (this.activeFilter === 'All') {
      this.filteredEvents = [...this.events];
    } else if (this.activeFilter === 'joined') {
      this.filteredEvents = this.events.filter(e => this.userParticipations[e.id!]);
    } else {
      this.filteredEvents = this.events.filter(
        e => e.status?.toLowerCase() === this.activeFilter.toLowerCase()
      );
    }
  }
  
  setFilter(filter: string) {
    this.activeFilter = filter;
    this.filterEvents();
  }
  onRSVP(event: EventDetails) {
  if (!this.currentUser.id) {
    alert('Please sign in to register for events.');
    return;
  }

  if (!event.id) {
    return;
  }

  const isJoined = this.userParticipations[event.id];

  if (isJoined) {
    // Cancel RSVP
    if (confirm(`Cancel your registration for "${event.title}"?`)) {
      this.loading = true;
      this.http.delete(`${this.baseUrl}/rsvp/${event.id}/${this.currentUser.id}`)
        .pipe(finalize(() => this.loading = false))
        .subscribe({
          next: (response: any) => {
            this.userParticipations[event.id!] = false;
            this.loadEvents(); // Reload to update counts
            alert(response.message || 'Registration cancelled successfully');
          },
          error: (err) => {
            console.error('Cancel failed', err);
            const errorMsg = err.error?.message || err.error || 'Failed to cancel registration';
            alert(errorMsg);
          }
        });
    }
  } else {
    // Identity (userId, email, name) is now resolved from the JWT cookie
    // server-side — we only need to tell the backend WHICH event we want
    // to RSVP to. This guarantees the QR + confirmation email always go
    // to the *connected* user, no matter what the client tries to send.
    this.loading = true;
    this.http.post<RSVPResponse>(`${this.baseUrl}/rsvp`, {
      eventId: event.id
    }).pipe(finalize(() => this.loading = false))
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.userParticipations[event.id!] = true;
            // Cache QR URL for in-app display (modal). Persist so a reload
            // keeps the ticket visible until the user clears the session.
            if (response.qrUrl && event.id) {
              this.qrUrlByEvent[event.id] = response.qrUrl;
              this.persistQrCache();
            }
            this.loadEvents(); // Reload to update counts
            alert(`${response.message}\nQR code sent to ${response.userEmail}`);
          }
        },
        error: (err) => {
          console.error('RSVP failed', err);
          if (err.status === 401) {
            // Auto-diagnostic — call /api/rsvp/_debug with the same
            // HttpClient (so the same interceptor runs). The response
            // tells us whether the Bearer header even reaches the backend.
            // We then show the full diagnosis in ONE alert so the user
            // doesn't have to dig through DevTools.
            this.http.get<any>(`${this.baseUrl}/rsvp/_debug`).subscribe({
              next: (dbg) => alert(
                'Backend rejected the RSVP because it could not see your session.\n\n'
                + 'Diagnostic from /api/rsvp/_debug:\n'
                + '  authorizationHeader: ' + (dbg.authorizationHeader ?? '<missing>') + '\n'
                + '  cookieHeader:        ' + (dbg.cookieHeader ?? '<missing>') + '\n'
                + '  authenticated:       ' + dbg.authenticated + '\n'
                + (dbg.user ? '  user: ' + JSON.stringify(dbg.user) + '\n' : '')
                + '\nIf authorizationHeader is "<none>" the SPA is not '
                + 'sending the Bearer token — sign out then sign in again.'),
              error: () => alert(
                'Backend rejected the RSVP and the diagnostic endpoint is '
                + 'also unreachable. Sign out, sign back in, then retry.\n'
                + '(Open DevTools > Network and look for `Authorization` on '
                + 'the failed POST /api/rsvp request.)')
            });
            return;
          }
          const errorMsg = err.error?.message || 'Failed to register for event';
          alert(errorMsg);
        }
      });
  }
}
 
  
  formatDate(dateStr: string): string {
    if (!dateStr) return 'TBA';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'long', day: 'numeric', year: 'numeric'
    });
  }
  
  formatDateTime(dateStr: string): string {
    if (!dateStr) return 'TBA';
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  }
  
  getCapacityStatus(event: EventDetails): string {
    if (!event.capacity) return '♾️ Unlimited spots';
    if (event.isFull) return '🔴 Event is full';
    const remaining = event.remainingSpots || (event.capacity - (event.participantCount || 0));
    if (remaining <= 10) {
      return `⚠️ Only ${remaining} spots left!`;
    }
    return `🟢 ${remaining} spots available`;
  }
  
  getCapacityClass(event: EventDetails): string {
    if (!event.capacity) return 'text-gray-500';
    if (event.isFull) return 'text-red-500';
    if (event.remainingSpots && event.remainingSpots <= 10) return 'text-amber-500';
    return 'text-emerald-500';
  }
  
  canJoin(event: EventDetails): boolean {
    return event.status?.toLowerCase() === 'published' && !event.isFull;
  }

  // ── Feedback ────────────────────────────────────────────────────────────
  /**
   * A user can leave feedback when:
   *   - they actually attended (RSVP confirmed) AND
   *   - the event is over (status "completed" OR endDate in the past)
   * We don't gate on QR check-in to avoid penalising clubs that don't scan.
   */
  canLeaveFeedback(event: EventDetails): boolean {
    if (!event.id || !this.currentUser.id) return false;
    if (!this.userParticipations[event.id]) return false;
    const status = (event.status || '').toLowerCase();
    if (status === 'completed') return true;
    if (event.endDate) {
      const end = new Date(event.endDate).getTime();
      return Number.isFinite(end) && end < Date.now();
    }
    return false;
  }

  openFeedback(event: EventDetails): void {
    this.feedbackEvent = event;
    this.feedbackOpen = true;
  }
  closeFeedback(): void {
    this.feedbackOpen = false;
    this.feedbackEvent = null;
  }
  onFeedbackSubmitted(): void {
    this.closeFeedback();
    alert('Thanks! Your feedback helps us recommend better events.');
  }

  // ── QR ticket ───────────────────────────────────────────────────────
  /** Returns the data URL for a QR image from a public renderer. */
  qrImageSrc(payload: string): string {
    const enc = encodeURIComponent(payload);
    return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=8&data=${enc}`;
  }

  hasQr(eventId: string | undefined): boolean {
    return !!eventId && !!this.qrUrlByEvent[eventId];
  }

  /**
   * Opens the QR modal for an event the user joined. If no cached qrUrl
   * exists (e.g. user RSVP'd in a previous session and we don't have the
   * payload), we encode a deterministic fallback `eventId|userId` so they
   * still see something — the gate scanner can use it as a backup ID.
   */
  openQr(event: EventDetails): void {
    if (!event.id) return;
    if (!this.qrUrlByEvent[event.id]) {
      this.qrUrlByEvent[event.id] = `RSVP|${event.id}|${this.currentUser.id}`;
      this.persistQrCache();
    }
    this.qrModalEvent = event;
    this.qrModalOpen = true;
  }

  closeQr(): void {
    this.qrModalOpen = false;
    this.qrModalEvent = null;
  }
}