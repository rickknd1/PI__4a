import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { apiUrl } from '../../../environments/environment';
import { VirtualEvent } from '../models/virtual-event';

@Injectable({
  providedIn: 'root'
})
export class VirtualEventService {
  private readonly apiBase = apiUrl('/api/virtual-events');

  constructor(private http: HttpClient) {}

  getAllEvents(): Observable<VirtualEvent[]> {
    return this.http.get<VirtualEvent[]>(this.apiBase);
  }

  register(eventId: string, userId: string): Observable<unknown> {
    return this.http.post(`${this.apiBase}/${eventId}/register/${userId}`, {});
  }

  pay(eventId: string, userId: string): Observable<unknown> {
    return this.http.post(`${this.apiBase}/${eventId}/pay/${userId}`, {});
  }

  canJoin(eventId: string, userId: string): Observable<boolean> {
    return this.http.get<boolean>(`${this.apiBase}/${eventId}/can-join/${userId}`);
  }
}