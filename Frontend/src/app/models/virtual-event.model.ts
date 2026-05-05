/**
 * Virtual event (online) — served by the `Virtual_Event_Management`
 * Spring microservice (Gateway :8084 → /api/virtual-events, VEM :8086).
 *
 * Physical (in-person) events are described by `BackendEvent` in
 * `shared/services/event.service.ts` and remain untouched. The two
 * domains coexist on the same calendar via an additive merge in
 * `CalenderComponent.loadEvents()`; nothing in the physical flow is
 * modified.
 */
export interface VirtualEvent {
  id?: string;

  title: string;
  description?: string;
  category?: string;

  /** ISO 8601 — start timestamp of the live session. */
  scheduledAt: string;
  /** ISO 8601 — optional end timestamp. */
  endAt?: string;

  /** External Jitsi/Meet URL returned by the backend when the event is joinable. */
  meetingLink?: string;
  /** Whether the session should be recorded server-side. */
  isRecording?: boolean;

  price?: number;
  isPaid?: boolean;

  maxParticipants?: number;
  currentParticipants?: number;

  imageUrl?: string;
  status?: string;

  organizer?: any;

  /**
   * VIRTUAL : Jitsi + chat. ROOM : idem + lobby STOMP (`/topic/positions`) via `/ameni/meeting/:id` puis lobby/3D.
   */
  type: 'VIRTUAL' | 'ROOM';
  roomId?: string;
}
