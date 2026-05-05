import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface AudioMessage {
  id: string;
  channelId: string;
  userId: string;
  userName: string;
  audioData: string;
  contentType: string;
  createdAt: string;
  hidden?: boolean;
}

export interface Channel {
  id: string;
  name: string;
  isPrivate: boolean;
  isCommitteeChannel?: boolean;
  createdAt?: string;
  createdBy?: string;
  memberIds?: string[];
  kickedMemberIds?: string[];
  audioHistory?: AudioMessage[];
}

@Injectable({ providedIn: 'root' })
export class ChannelService {
  private apiUrl = 'http://localhost:8080/api/channels';

  constructor(private http: HttpClient) {}

  getAll(userId: string, role?: string, userCommittee?: string): Observable<Channel[]> {
    let params = `userId=${userId}`;
    if (role) params += `&role=${role}`;
    if (userCommittee) params += `&userCommittee=${encodeURIComponent(userCommittee)}`;
    return this.http.get<Channel[]>(`${this.apiUrl}?${params}`);
  }

  ensureCommitteeChannel(committeeName: string, memberId: string): Observable<Channel> {
    return this.http.post<Channel>(
      `${this.apiUrl}/committee-channel/${encodeURIComponent(committeeName)}/${memberId}`,
      {}
    );
  }

  removeFromCommitteeChannel(committeeName: string, memberId: string): Observable<void> {
    return this.http.delete<void>(
      `${this.apiUrl}/committee-channel/${encodeURIComponent(committeeName)}/${memberId}`
    );
  }

  syncMemberCommitteeChannel(memberId: string, currentCommittee: string): Observable<Channel> {
    return this.http.post<Channel>(
      `${this.apiUrl}/committee-channel/sync/${memberId}/${encodeURIComponent(currentCommittee)}`,
      {}
    );
  }

  create(
    channel: { name: string; isPrivate: boolean; memberIds: string[] },
    userId: string,
    role: string
  ): Observable<Channel> {
    return this.http.post<Channel>(
      `${this.apiUrl}?userId=${userId}&role=${role}`,
      channel
    );
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  addMember(channelId: string, memberId: string): Observable<Channel> {
    return this.http.post<Channel>(`${this.apiUrl}/${channelId}/members/${memberId}`, {});
  }

  removeMember(channelId: string, memberId: string): Observable<Channel> {
    return this.http.delete<Channel>(`${this.apiUrl}/${channelId}/members/${memberId}`);
  }

}
