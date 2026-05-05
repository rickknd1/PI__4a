import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Club, Member, SubGroup, SubGroupRecommendation } from '../../models/club.model';
import { apiUrl } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ClubService {
  private baseUrl = apiUrl('/api/clubs');

  constructor(private http: HttpClient) { }

  // ========== CRUD ==========
  getAllClubs(): Observable<Club[]> {
    return this.http.get<Club[]>(this.baseUrl);
  }

  getClubById(id: string): Observable<Club> {
    return this.http.get<Club>(`${this.baseUrl}/${id}`);
  }

  createClub(club: Club): Observable<Club> {
    return this.http.post<Club>(this.baseUrl, club);
  }

  updateClub(id: string, club: Club): Observable<Club> {
    return this.http.put<Club>(`${this.baseUrl}/${id}`, club);
  }

  deleteClub(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  // ========== GESTION DES MEMBRES ==========
  addMember(clubId: string, member: Member): Observable<Club> {
    return this.http.post<Club>(`${this.baseUrl}/${clubId}/members`, member);
  }

  approveMember(clubId: string, userId: string): Observable<Club> {
    return this.http.put<Club>(`${this.baseUrl}/${clubId}/members/${userId}/approve`, {});
  }

  rejectMember(clubId: string, userId: string): Observable<Club> {
    return this.http.delete<Club>(`${this.baseUrl}/${clubId}/members/${userId}`);
  }

  changeMemberRole(clubId: string, userId: string, role: string): Observable<Club> {
    return this.http.put<Club>(`${this.baseUrl}/${clubId}/members/${userId}/role?role=${role}`, {});
  }

  // ========== GESTION DES SOUS-GROUPES ==========
  addSubGroup(clubId: string, subGroup: SubGroup): Observable<Club> {
    return this.http.post<Club>(`${this.baseUrl}/${clubId}/subgroups`, subGroup);
  }

  removeSubGroup(clubId: string, subGroupId: string): Observable<Club> {
    return this.http.delete<Club>(`${this.baseUrl}/${clubId}/subgroups/${subGroupId}`);
  }

  assignToSubGroup(clubId: string, userId: string, subGroupId: string, subGroupRole: string = 'MEMBRE'): Observable<Club> {
    return this.http.put<Club>(`${this.baseUrl}/${clubId}/members/${userId}/subgroup/${subGroupId}`, { subGroupRole });
  }

  removeFromSubGroup(clubId: string, subGroupId: string, userId: string): Observable<Club> {
    return this.http.delete<Club>(`${this.baseUrl}/${clubId}/subgroups/${subGroupId}/members/${userId}`);
  }

  // ========== SERVICE MÉTIER ==========
  recommendRole(clubId: string, userId: string): Observable<SubGroupRecommendation> {
    return this.http.get<SubGroupRecommendation>(`${this.baseUrl}/${clubId}/recommend-role/${userId}`);
  }
 // ========== GESTION DES SOUS-GROUPES ==========
updateSubGroup(clubId: string, subGroupId: string, subGroup: SubGroup): Observable<Club> {
  return this.http.put<Club>(`${this.baseUrl}/${clubId}/subgroups/${subGroupId}`, subGroup);
}

updateMemberInClub(clubId: string, userId: string, memberData: any): Observable<Club> {
  return this.http.put<Club>(`${this.baseUrl}/${clubId}/members/${userId}`, memberData);
}
}