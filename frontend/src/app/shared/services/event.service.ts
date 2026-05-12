import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { apiUrl as gatewayApi } from '../../../environments/environment';

export interface EventStaffMember {
  name: string;
  role: string;
  budget?: number | null;
}

export interface BackendEvent {
  id?: string;
  title: string;
  description?: string;
  shortDescription?: string;
  categoryId?: string;
  startDate: string;
  endDate: string;
  location?: {
    name: string;
    address: string;
    coordinates: { lat: number; lng: number };
  };
  capacity?: number;
  imageUrl?: string;
  status?: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
  calendar?: string;      // color derived from status
  staff?: EventStaffMember[];
  /** workshop | competition | conference | training | networking | trip_outing | other */
  eventFormat?: string | null;
  /** When eventFormat === 'other' */
  eventFormatCustom?: string | null;
  /** Optional aggregate from backend */
  estimatedBudget?: number;
}

@Injectable({ providedIn: 'root' })
export class EventService {
  private readonly base = gatewayApi('/api/events');

  constructor(private http: HttpClient) {}

  getEvents(): Observable<BackendEvent[]> {
    return this.http.get<BackendEvent[]>(this.base);
  }

  getEventById(id: string): Observable<BackendEvent> {
    return this.http.get<BackendEvent>(`${this.base}/${id}`);
  }

  createEvent(event: BackendEvent): Observable<BackendEvent> {
    return this.http.post<BackendEvent>(this.base, event);
  }

  updateEvent(id: string, event: BackendEvent): Observable<BackendEvent> {
    return this.http.put<BackendEvent>(`${this.base}/${id}`, event);
  }

  deleteEvent(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}