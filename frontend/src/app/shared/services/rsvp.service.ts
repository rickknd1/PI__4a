// src/app/shared/services/rsvp.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { apiUrl } from '../../../environments/environment';

export interface RSVP {
  id?: string;
  eventId: string;
  userId: string;
  userEmail: string;
  userName: string;
  status: string;        // confirmed | cancelled | waitlist
  qrToken: string;       // unique JWT token
  scanned: boolean;
  rsvpDate: string;
  scannedAt?: string;
}

export interface ScanResult {
  success: boolean;
  message: string;
  memberName?: string;
}

@Injectable({
  providedIn: 'root'
})
export class RSVPService {
  private baseUrl = apiUrl('/api/rsvp');

  constructor(private http: HttpClient) {}

  // Create RSVP with QR code
  rsvpToEvent(eventId: string, userId: string, email: string, name: string): Observable<RSVP> {
    const body = { eventId, userId, email, name };
    console.log('Sending RSVP request:', body); // For debugging
    return this.http.post<RSVP>(`${this.baseUrl}`, body).pipe(
      catchError(this.handleError)
    );
  }

  // Check if user has RSVPed to event
  checkRSVP(eventId: string, userId: string): Observable<RSVP | null> {
    return this.http.get<RSVP[]>(`${this.baseUrl}/event/${eventId}`).pipe(
      map(rsvps => rsvps.find(rsvp => rsvp.userId === userId && rsvp.status === 'confirmed') || null),
      catchError(this.handleError)
    );
  }

  // Get participant count for event
  getParticipantCount(eventId: string): Observable<number> {
    return this.http.get<RSVP[]>(`${this.baseUrl}/event/${eventId}`).pipe(
      map(rsvps => rsvps.filter(rsvp => rsvp.status === 'confirmed').length),
      catchError(this.handleError)
    );
  }

  // Cancel RSVP
  cancelParticipation(eventId: string, userId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${eventId}/${userId}`).pipe(
      catchError(this.handleError)
    );
  }

  // Scan QR code at door (staff only)
  scanQRCode(token: string): Observable<ScanResult> {
    return this.http.post<ScanResult>(`${this.baseUrl}/scan`, { token }).pipe(
      catchError(this.handleError)
    );
  }

  // Get all RSVPs for an event (bureau view)
  getEventRSVPs(eventId: string): Observable<RSVP[]> {
    return this.http.get<RSVP[]>(`${this.baseUrl}/event/${eventId}`).pipe(
      catchError(this.handleError)
    );
  }

  // Get checked-in participantss
  getCheckedInParticipants(eventId: string): Observable<RSVP[]> {
    return this.http.get<RSVP[]>(`${this.baseUrl}/event/${eventId}`).pipe(
      map(rsvps => rsvps.filter(rsvp => rsvp.scanned === true)),
      catchError(this.handleError)
    );
  }

  // Error handler
  private handleError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'An error occurred';
    
    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMessage = error.error.message;
    } else {
      // Server-side error
      errorMessage = error.error || error.message;
      console.error(`Backend returned code ${error.status}, body was:`, error.error);
    }
    
    return throwError(() => errorMessage);
  }
}