import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { apiUrl } from '../../../environments/environment';

export interface EmailPayload {
  to: string;
  userName: string;
  eventTitle: string;
  eventDate: string;
  meetingLink: string;
}

/**
 * Côté branche `virtual_event`, l’e-mail de confirmation pouvait viser un microservice
 * dédié. Ici, on tente d’abord le Gateway s’il expose un endpoint ; sinon
 * l’inscription (VEM) suffit et le flux reste fonctionnel.
 */
@Injectable({ providedIn: 'root' })
export class EmailService {
  constructor(private http: HttpClient) {}

  testConfirmation(payload: EmailPayload): Observable<unknown> {
    const body = { ...payload };
    return this.http.post<unknown>(apiUrl('/api/virtual-events/confirmation-email'), body).pipe(
      catchError(() => of({ skipped: true }))
    );
  }
}
