import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { apiUrl } from '../../../environments/environment';

export interface Voice2AudioMessage {
  id: string;
  channelId: string;
  userId: string;
  userName: string;
  audioData: string;
  contentType: string;
  createdAt: string;
  hidden?: boolean;
}

export interface Voice2Channel {
  id: string;
  name: string;
  isPrivate: boolean;
  isCommitteeChannel?: boolean;
  createdAt?: string;
  createdBy?: string;
  memberIds?: string[];
  kickedMemberIds?: string[];
  audioHistory?: Voice2AudioMessage[];
}

@Injectable({ providedIn: 'root' })
export class Voice2ChannelService {
  private readonly apiBase = apiUrl('/api/voice2/channels');

  constructor(private http: HttpClient) {}

  getAll(userId: string, role?: string, userCommittee?: string): Observable<Voice2Channel[]> {
    let params = `userId=${userId}`;
    if (role) params += `&role=${role}`;
    if (userCommittee) params += `&userCommittee=${encodeURIComponent(userCommittee)}`;
    return this.http.get<Voice2Channel[]>(`${this.apiBase}?${params}`);
  }

  ensureCommitteeChannel(committeeName: string, memberId: string): Observable<Voice2Channel> {
    return this.http.post<Voice2Channel>(
      `${this.apiBase}/committee-channel/${encodeURIComponent(committeeName)}/${memberId}`,
      {},
    );
  }

  removeFromCommitteeChannel(committeeName: string, memberId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiBase}/committee-channel/${encodeURIComponent(committeeName)}/${memberId}`);
  }

  syncMemberCommitteeChannel(memberId: string, currentCommittee: string): Observable<Voice2Channel> {
    return this.http.post<Voice2Channel>(
      `${this.apiBase}/committee-channel/sync/${memberId}/${encodeURIComponent(currentCommittee)}`,
      {},
    );
  }

  create(channel: { name: string; isPrivate: boolean; memberIds: string[] }, userId: string, role: string): Observable<Voice2Channel> {
    const qUserId = encodeURIComponent(userId ?? '');
    const qRole = encodeURIComponent(role ?? '');
    return this.http.post<Voice2Channel>(`${this.apiBase}?userId=${qUserId}&role=${qRole}`, channel);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiBase}/${id}`);
  }

  addMember(channelId: string, memberId: string): Observable<Voice2Channel> {
    return this.http.post<Voice2Channel>(`${this.apiBase}/${channelId}/members/${memberId}`, {});
  }

  removeMember(channelId: string, memberId: string): Observable<Voice2Channel> {
    return this.http.delete<Voice2Channel>(`${this.apiBase}/${channelId}/members/${memberId}`);
  }
}
