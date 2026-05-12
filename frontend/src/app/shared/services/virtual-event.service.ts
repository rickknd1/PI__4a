import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { VirtualEvent } from '../../models/virtual-event.model';
import { apiUrl as gatewayApi } from '../../../environments/environment';

/**
 * Thin HTTP client for the `Virtual_Event_Management` microservice.
 *
 * Served through the Gateway at :8084 (route id = `virtual-events`,
 * cf. Gateway/application.properties). The Gateway routes
 * `/api/virtual-events/**` to `lb://virtual-event-management` which
 * Eureka resolves to the VEM instance running on :8086 (port was
 * moved from 8082 because 8082 is already used by voice-service; the
 * service name is in kebab-case because Gateway 5.x — RFC 1123 —
 * refuses underscores in `lb://` hostnames).
 *
 * Keeping the same host/port as `EventService` means the JWT cookie
 * (HttpOnly, set at /api/auth/login) is sent on these calls too, so
 * authenticated endpoints like register / pay / can-join work without
 * any interceptor change.
 */
@Injectable({ providedIn: 'root' })
export class VirtualEventService {
  private readonly base = gatewayApi('/api/virtual-events');

  constructor(private http: HttpClient) {}

  /**
   * Fetches all virtual events. Degraded behaviour: if the VEM service
   * is unreachable we return an empty array so the shared calendar
   * keeps rendering the physical events normally. This is important
   * because the CalenderComponent merges both sources via forkJoin —
   * a single failure must not take down the whole view.
   */
  getAllEvents(): Observable<VirtualEvent[]> {
    return this.http.get<VirtualEvent[]>(this.base).pipe(
      catchError((err) => {
        // eslint-disable-next-line no-console
        console.warn('[VirtualEventService] getAllEvents failed', err);
        return of<VirtualEvent[]>([]);
      })
    );
  }

  getEventById(id: string): Observable<VirtualEvent> {
    return this.http.get<VirtualEvent>(`${this.base}/${id}`);
  }

  createEvent(event: VirtualEvent): Observable<VirtualEvent> {
    return this.http.post<VirtualEvent>(this.base, event);
  }

  updateEvent(id: string, event: VirtualEvent): Observable<VirtualEvent> {
    return this.http.put<VirtualEvent>(`${this.base}/${id}`, event);
  }

  deleteEvent(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  register(eventId: string, userId: string): Observable<any> {
    return this.http.post(`${this.base}/${eventId}/register/${userId}`, {});
  }

  pay(eventId: string, userId: string): Observable<any> {
    return this.http.post(`${this.base}/${eventId}/pay/${userId}`, {});
  }

  canJoin(eventId: string, userId: string): Observable<boolean> {
    return this.http.get<boolean>(`${this.base}/${eventId}/can-join/${userId}`);
  }

  /** Backend-resolved meeting link (only valid close to event start). */
  getMeetingLink(eventId: string): Observable<string> {
    return this.http.get(`${this.base}/${eventId}/link`, { responseType: 'text' });
  }
}
