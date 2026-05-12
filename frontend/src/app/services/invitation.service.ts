import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { getGatewayBase } from '../../environments/environment';

export interface InviteMemberRequest {
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  customRoleId?: string;
  clubId: string;
}

export interface MemberInvitation {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  customRoleId?: string;
  clubId: string;
  clubName: string;
  invitedBy: string;
  invitedByName: string;
  token: string;
  createdAt: string;
  expiresAt: string;
  used: boolean;
  usedAt?: string;
}

@Injectable({
  providedIn: 'root'
})
export class InvitationService {
  private get apiUrl() { return `${getGatewayBase()}/api/invitations`; }

  constructor(private http: HttpClient) {}

  inviteMember(data: InviteMemberRequest): Observable<any> {
    return this.http.post(`${this.apiUrl}/invite`, data);
  }

  validateToken(token: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/validate/${token}`);
  }

  setupPassword(token: string, password: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/setup-password`, { token, password });
  }

  getClubInvitations(clubId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/club/${clubId}`);
  }

  getPendingInvitations(clubId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/club/${clubId}/pending`);
  }

  resendInvitation(invitationId: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/${invitationId}/resend`, {});
  }

  deleteInvitation(invitationId: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${invitationId}`);
  }
}
