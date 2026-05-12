import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { apiUrl } from '../../../environments/environment';

export interface CustomRole {
  id?: string;
  clubId: string;
  roleName: string;
  description?: string;
  permissions: string[];
  isActive?: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class CustomRoleService {
  private baseUrl = apiUrl('/api/roles');

  constructor(private http: HttpClient) {}

  getRolesByClub(clubId: string): Observable<CustomRole[]> {
    return this.http.get<CustomRole[]>(`${this.baseUrl}/club/${clubId}`);
  }

  getRoleById(id: string): Observable<CustomRole> {
    return this.http.get<CustomRole>(`${this.baseUrl}/${id}`);
  }

  createRole(role: CustomRole): Observable<CustomRole> {
    return this.http.post<CustomRole>(this.baseUrl, role);
  }

  updateRole(id: string, role: CustomRole): Observable<CustomRole> {
    return this.http.put<CustomRole>(`${this.baseUrl}/${id}`, role);
  }

  deleteRole(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
