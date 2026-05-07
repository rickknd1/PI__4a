import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

import { VirtualEventService } from '../../services/virtual-event.service';
import { EmailService, EmailPayload } from '../../services/email.service';
import { VirtualEvent } from '../../models/virtual-event';
import { AuthService } from '../../../shared/services/auth.service';
import { CommitteeResponsableService } from '../../../shared/services/committee-responsable.service';
import { apiUrl } from '../../../../environments/environment';

@Component({
  selector: 'app-events',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  providers: [DatePipe],
  templateUrl: './events.component.html'
})
export class EventsComponent implements OnInit, OnDestroy {
  events: VirtualEvent[] = [];
  selectedEvent: VirtualEvent | null = null;
  isModalOpen = false;

  selectedColor = 'blue';
  selectedType = 'cube';

  userId = '';
  currentUser: any = null;

  joinAccess: { [key: string]: boolean } = {};
  countdowns: { [key: string]: string } = {};

  interval: any;

  loading = false;
  successMsg = '';
  errorMsg = '';
  initialized = false;

  // ── Assistant IA (Gemini) — création d'événement par langage naturel ──
  // L'utilisateur tape "événement gaming le 30 mai 14h durée 2h capacité
  // 50 prix 5 TND" → backend /api/ai/parse appelle Gemini → renvoie un
  // EventAIResponse JSON → on pré-remplit aiDraft puis on POST à
  // /api/virtual-events pour créer l'event sans saisie manuelle.
  showAiModal = false;
  aiPrompt = '';
  aiBusy = false;
  aiDraft: any = null;        // EventAIResponse parsed
  aiRawText = '';             // texte brut renvoyé par Gemini (pour debug)

  // ── Ratings (EventReview) — agrégat affiché sur chaque carte ─────────
  ratingsByEvent: { [eventId: string]: { avg: number; count: number } } = {};

  constructor(
    private virtualEventService: VirtualEventService,
    private emailService: EmailService,
    private datePipe: DatePipe,
    private router: Router,
    private http: HttpClient,
    public authService: AuthService,
    public committeeResponsableService: CommitteeResponsableService
  ) {}

  ngOnInit(): void {
    // Tous les utilisateurs connectes peuvent voir la liste des evenements
    // virtuels et s'y inscrire. Les actions admin (creer/editer/supprimer)
    // sont gardees par canAccess() au niveau des boutons du template.
    if (!this.initialized) {
      this.initialized = true;
      this.loadCurrentUser();
      this.loadEvents();
      // Note : pas de return ici pour conserver le subscribe ci-dessous.
    }
    this.committeeResponsableService.responsableStatus$.subscribe(status => {
      if (status === null) return;
      // Garde inutilisee : si vraiment besoin, decommente la branche
      // d'autorisation. On laisse la souscription pour rafraichir canAccess().
      if (!this.initialized) {
        this.initialized = true;
        this.loadCurrentUser();
        this.loadEvents();

        this.interval = setInterval(() => {
          this.updateCountdowns();
        }, 1000);
      }
    });
  }

  canAccess(): boolean {
    const role = this.authService.getCurrentRole();
    if (role === 'PRESIDENT' || role === 'VICE_PRESIDENT' ||
        role === 'SECRETAIRE_GENERALE' || role === 'SECRETAIRE_GENERAL') return true;
    const isResponsable = this.committeeResponsableService.isResponsable();
    const groupName = (this.committeeResponsableService.getMySubGroupName() || '').toLowerCase();
    const isRespEvents = isResponsable && (groupName.includes('event') || groupName.includes('evenement'));

    // Accès pour event managers OU membre simple (participation)
    return isRespEvents || this.authService.isMember();
  }

  ngOnDestroy(): void {
    if (this.interval) {
      clearInterval(this.interval);
    }
  }

  loadCurrentUser(): void {
    const rawUser =
      localStorage.getItem('currentUser') ||
      localStorage.getItem('user');

    if (!rawUser) {
      console.warn('No user found in localStorage');
      return;
    }

    try {
      const parsed = JSON.parse(rawUser);
      const nestedUser = parsed.user ?? parsed;

      this.currentUser = {
        userId: nestedUser.userId || nestedUser._id || nestedUser.id || '',
        firstName: nestedUser.firstName || '',
        lastName: nestedUser.lastName || '',
        email: nestedUser.email || '',
        token: nestedUser.token || parsed.token || ''
      };

      this.userId = this.currentUser.userId;
    } catch (error) {
      console.error('Error parsing user:', error);
    }
  }

  loadEvents(): void {
    this.virtualEventService.getAllEvents().subscribe({
      next: (data) => {
        this.events = data || [];
        this.loadJoinAccess();
        this.updateCountdowns();
      },
      error: (err) => {
        console.error('Error loading events:', err);
        this.errorMsg = 'Error while loading events';
        this.clearMessages();
      }
    });
  }

  loadJoinAccess(): void {
    if (!this.userId) return;

    this.events.forEach(event => {
      if (!event.id) return;

      this.virtualEventService.canJoin(event.id, this.userId).subscribe({
        next: (res) => {
          this.joinAccess[event.id!] = res === true;
        },
        error: (err) => {
          console.error('canJoin error:', err);
          this.joinAccess[event.id!] = false;
        }
      });
    });
  }

  updateCountdowns(): void {
    const now = new Date().getTime();

    this.events.forEach(event => {
      if (!event.id || !event.scheduledAt) return;

      if (this.isFinished(event)) {
        this.countdowns[event.id] = '✓ Terminé';
        return;
      }

      const eventTime = new Date(event.scheduledAt).getTime();
      const diff = eventTime - now;

      if (diff <= 0) {
        this.countdowns[event.id] = '🔴 LIVE';
        return;
      }

      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);

      this.countdowns[event.id] = `${minutes}m ${seconds}s`;
    });
  }

  canUserJoin(event: VirtualEvent): boolean {
    if (!event?.id || !event.scheduledAt) return false;

    // Demo-friendly : on autorise la jointure des qu'on a la confirmation
    // backend (canJoin). La fenetre "5 minutes avant" cassait la demo car les
    // events seedes sont programmes plusieurs jours plus tard.
    // Backend canJoin verifie deja: registered + paid + not finished + not full.
    return this.joinAccess[event.id] === true;
  }

  isLive(event: VirtualEvent): boolean {
    if (!event?.scheduledAt) return false;
    if (event.status === 'FINISHED' || event.status === 'CANCELLED') return false;

    const now = new Date().getTime();
    const eventTime = new Date(event.scheduledAt).getTime();
    if (now < eventTime) return false;

    const endTime = event.endAt
      ? new Date(event.endAt).getTime()
      : eventTime + 2 * 60 * 60 * 1000;
    if (now >= endTime) return false;

    return true;
  }

  isFinished(event: VirtualEvent): boolean {
    if (event.status === 'FINISHED' || event.status === 'CANCELLED') return true;
    if (!event?.scheduledAt) return false;
    const now = new Date().getTime();
    const endTime = event.endAt
      ? new Date(event.endAt).getTime()
      : new Date(event.scheduledAt).getTime() + 2 * 60 * 60 * 1000;
    return now >= endTime;
  }

  getJoinMessage(event: VirtualEvent): string {
    if (!event?.id || !event.scheduledAt) return 'Invalid event';

    if (this.isFinished(event)) {
      return '✓ Cet événement est terminé';
    }

    if (this.joinAccess[event.id] !== true) {
      return '❌ You must register and pay first';
    }

    if (this.isLive(event)) {
      return '🔴 Event is live';
    }

    return '✅ You can join the event';
  }

  openEventDetails(event: VirtualEvent): void {
    this.selectedEvent = event;
    this.isModalOpen = true;
    this.successMsg = '';
    this.errorMsg = '';
  }

  closeModal(): void {
    this.isModalOpen = false;
    this.selectedEvent = null;
    this.loading = false;
    this.successMsg = '';
    this.errorMsg = '';
  }

  registerToEvent(event: VirtualEvent): void {
    if (!event?.id) {
      this.errorMsg = 'Invalid event';
      this.clearMessages();
      return;
    }

    if (!this.userId) {
      this.errorMsg = 'User not found';
      this.clearMessages();
      return;
    }

    if (!this.currentUser?.email) {
      this.errorMsg = 'User email not found';
      this.clearMessages();
      return;
    }

    this.loading = true;
    this.successMsg = '';
    this.errorMsg = '';

    this.virtualEventService.register(event.id, this.userId).subscribe({
      next: () => {
        const payload: EmailPayload = {
          to: this.currentUser.email,
          userName:
            `${this.currentUser.firstName || ''} ${this.currentUser.lastName || ''}`.trim() || 'Participant',
          eventTitle: event.title || 'Event',
          eventDate: this.formatDate(event.scheduledAt),
          meetingLink: event.meetingLink || 'https://meet.jit.si/default-room'
        };

        this.emailService.testConfirmation(payload).subscribe({
          next: () => {
            this.loading = false;
            this.successMsg = `Successfully registered for ${event.title}. Confirmation email sent.`;
            this.loadEvents();
            this.loadJoinAccess();
            this.clearMessages();
          },
          error: (mailErr: unknown) => {
            this.loading = false;
            console.error('Mail error:', mailErr);
            this.successMsg = `Registered for ${event.title}, but email was not sent.`;
            this.loadEvents();
            this.loadJoinAccess();
            this.clearMessages();
          }
        });
      },
      error: (err) => {
        this.loading = false;
        console.error('Registration error:', err);
        this.errorMsg = err?.error?.message || err?.error?.error || 'Registration failed';
        this.clearMessages();
      }
    });
  }

  payForEvent(event: VirtualEvent): void {
    if (!event?.id || !this.userId) {
      this.errorMsg = 'Invalid payment data';
      this.clearMessages();
      return;
    }

    this.loading = true;
    this.successMsg = '';
    this.errorMsg = '';

    this.virtualEventService.pay(event.id, this.userId).subscribe({
      next: () => {
        this.loading = false;
        this.successMsg = 'Payment successful';
        this.loadJoinAccess();
        this.clearMessages();
      },
      error: (err) => {
        this.loading = false;
        console.error('Payment error:', err);
        this.errorMsg = err?.error?.message || err?.error || 'Payment failed';
        this.clearMessages();
      }
    });
  }

  joinMeeting(event: VirtualEvent): void {
    if (!event?.id) {
      this.errorMsg = 'Invalid event';
      this.clearMessages();
      return;
    }

    if (!this.canUserJoin(event)) {
      this.errorMsg = 'Access denied. Register/pay first or wait until 5 minutes before the event.';
      this.clearMessages();
      return;
    }

    this.selectAvatar();

    const roomId = event.roomId?.trim();
    if (roomId) {
      localStorage.setItem('roomId', roomId);
      this.router.navigate(['/ameni/lobby', roomId]);
    } else {
      this.router.navigate(['/ameni/meeting', event.id!]);
    }

    this.closeModal();
  }

  selectAvatar(): void {
    const avatar = {
      color: this.selectedColor,
      type: this.selectedType
    };

    localStorage.setItem('avatar', JSON.stringify(avatar));
  }

  formatDate(dateStr: string): string {
    return this.datePipe.transform(dateStr, 'EEEE dd MMMM yyyy à HH:mm') || '';
  }

  canCreateEvents(): boolean {
    return this.authService.isBureau() || this.committeeResponsableService.isResponsable();
  }

  clearMessages(): void {
    setTimeout(() => {
      this.successMsg = '';
      this.errorMsg = '';
    }, 3000);
  }

  // ============================================================================
  //  ASSISTANT IA — création d'événement par langage naturel (Gemini)
  // ============================================================================
  openAiAssistant(): void {
    this.showAiModal = true;
    this.aiPrompt = '';
    this.aiDraft = null;
    this.aiRawText = '';
    this.aiBusy = false;
  }

  closeAiAssistant(): void {
    this.showAiModal = false;
  }

  /** Envoie le prompt utilisateur à /api/ai/parse → Gemini → JSON event. */
  askAi(): void {
    const prompt = (this.aiPrompt || '').trim();
    if (!prompt) return;
    this.aiBusy = true;
    this.aiDraft = null;

    this.http
      .post(apiUrl('/api/ai/parse'), prompt, { responseType: 'text' })
      .subscribe({
        next: (raw: string) => {
          this.aiBusy = false;
          this.aiRawText = raw;
          // Gemini renvoie souvent du JSON entouré de markdown ```json ... ```
          // On normalise avant de parser pour pré-remplir le formulaire.
          try {
            const cleaned = raw
              .replace(/^```json\s*/i, '')
              .replace(/```\s*$/i, '')
              .replace(/^```\s*/i, '')
              .trim();
            this.aiDraft = JSON.parse(cleaned);
          } catch (_) {
            this.errorMsg = "L'IA a répondu mais le JSON n'est pas exploitable. Réessaie en précisant date/heure.";
            this.clearMessages();
          }
        },
        error: (err) => {
          this.aiBusy = false;
          this.errorMsg =
            "Erreur Assistant IA : " + (err?.error?.message || err?.message || 'Service IA indisponible');
          this.clearMessages();
        },
      });
  }

  /**
   * Crée l'événement à partir du brouillon AI. Utilise le service
   * VirtualEventService déjà câblé sur /api/virtual-events.
   */
  createFromAiDraft(): void {
    if (!this.aiDraft) return;
    const draft = this.aiDraft;
    const payload: any = {
      title: draft.title || 'Événement sans titre',
      description: draft.description || '',
      category: draft.category || null,
      scheduledAt: draft.scheduledAt || null,
      endAt: draft.endAt || null,
      price: draft.price || 0,
      isPaid: draft.isPaid || false,
      maxParticipants: draft.maxParticipants || null,
      imageUrl: draft.imageUrl || null,
      type: draft.type || null,
      roomId: draft.roomId || null,
    };

    this.http.post(apiUrl('/api/virtual-events'), payload).subscribe({
      next: () => {
        this.successMsg = `Événement « ${payload.title} » créé via Assistant IA.`;
        this.showAiModal = false;
        this.aiDraft = null;
        this.aiPrompt = '';
        this.loadEvents();
        this.clearMessages();
      },
      error: (err) => {
        this.errorMsg =
          "Création échouée : " + (err?.error?.message || err?.message || '400 Bad Request');
        this.clearMessages();
      },
    });
  }

  // ============================================================================
  //  RATINGS — chargement des moyennes pour affichage sur chaque carte
  // ============================================================================
  loadRatingFor(eventId: string): void {
    if (!eventId || this.ratingsByEvent[eventId]) return;
    this.http
      .get<any[]>(apiUrl(`/api/events/${eventId}/reviews`))
      .subscribe({
        next: (reviews) => {
          const approved = (reviews || []).filter((r) => r.approved !== false);
          if (!approved.length) {
            this.ratingsByEvent[eventId] = { avg: 0, count: 0 };
            return;
          }
          const sum = approved.reduce((s, r) => s + (r.rating || 0), 0);
          this.ratingsByEvent[eventId] = {
            avg: Math.round((sum / approved.length) * 10) / 10,
            count: approved.length,
          };
        },
        error: () => {
          this.ratingsByEvent[eventId] = { avg: 0, count: 0 };
        },
      });
  }

  /** Helper template — rend les étoiles (ex: ★★★★☆) à partir d'une moyenne. */
  starsFor(eventId: string | undefined): string {
    if (!eventId) return '';
    const r = this.ratingsByEvent[eventId];
    if (!r || !r.count) return '';
    const full = Math.round(r.avg);
    return '★'.repeat(full) + '☆'.repeat(Math.max(0, 5 - full));
  }

  // ============================================================================
  //  REVIEWS modal — read + create review pour un event terminé
  // ============================================================================
  reviewsModalEventId: string | null = null;
  reviewsModalEventTitle = '';
  reviewsList: any[] = [];
  newReview = { rating: 5, comment: '' };
  reviewSubmitting = false;
  reviewError = '';

  openReviews(event: VirtualEvent | null): void {
    if (!event?.id) return;
    this.reviewsModalEventId = event.id;
    this.reviewsModalEventTitle = event.title || 'Événement';
    this.newReview = { rating: 5, comment: '' };
    this.reviewError = '';
    this.loadReviewsList(event.id);
  }

  closeReviewsModal(): void {
    this.reviewsModalEventId = null;
    this.reviewsList = [];
  }

  private loadReviewsList(eventId: string): void {
    this.http.get<any[]>(apiUrl(`/api/events/${eventId}/reviews`)).subscribe({
      next: (data) => (this.reviewsList = data || []),
      error: () => (this.reviewsList = []),
    });
  }

  submitReview(): void {
    if (!this.reviewsModalEventId) return;
    if (!this.newReview.comment.trim()) {
      this.reviewError = 'Le commentaire est obligatoire';
      return;
    }
    const user = this.authService.getCurrentUser();
    if (!user?.userId) {
      this.reviewError = 'Vous devez être connecté';
      return;
    }
    this.reviewSubmitting = true;
    this.reviewError = '';
    this.http
      .post(apiUrl(`/api/events/${this.reviewsModalEventId}/reviews`), {
        userId: user.userId,
        userName: user.firstName ? `${user.firstName} ${user.lastName ?? ''}`.trim() : (user.email || 'Anonyme'),
        rating: this.newReview.rating,
        comment: this.newReview.comment,
      })
      .subscribe({
        next: () => {
          this.reviewSubmitting = false;
          this.newReview = { rating: 5, comment: '' };
          if (this.reviewsModalEventId) {
            this.loadReviewsList(this.reviewsModalEventId);
            // refresh aussi l'avg sur la carte
            delete this.ratingsByEvent[this.reviewsModalEventId];
            this.loadRatingFor(this.reviewsModalEventId);
          }
        },
        error: (err) => {
          this.reviewSubmitting = false;
          this.reviewError =
            err?.error?.message || err?.error || err?.message || 'Erreur lors de l envoi';
        },
      });
  }
}