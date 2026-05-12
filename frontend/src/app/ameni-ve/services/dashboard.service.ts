import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { apiUrl } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  constructor(private http: HttpClient) {}

  getStats(): Observable<any> {
    return this.http.get<any>(apiUrl('/api/dashboard/stats'), { withCredentials: true });
  }

  getEvents(): Observable<any[]> {
    return this.http.get<any[]>(apiUrl('/api/dashboard/events'), { withCredentials: true });
  }
}
