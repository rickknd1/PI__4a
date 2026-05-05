import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface AiGenerationRequest {
  candidateName: string;
  clubName: string;
  position: string;
  userIdeas: string;
}

export interface AiGenerationResponse {
  motivationLetter: string;
  program: string;
  skills: string[];
  generatedAt: string;
}

@Injectable({
  providedIn: 'root'
})
export class AiGenerationService {
  private apiUrl = 'http://192.168.1.20:8085/api/ai';

  constructor(private http: HttpClient) {}

  generateMotivationLetter(request: AiGenerationRequest, userId?: string, clubId?: string): Observable<AiGenerationResponse> {
    const params: any = {};
    if (userId) params.userId = userId;
    if (clubId) params.clubId = clubId;

    return this.http.post<AiGenerationResponse>(
      `${this.apiUrl}/generate/motivation-letter`,
      request,
      { params }
    );
  }

  checkHealth(): Observable<any> {
    return this.http.get(`${this.apiUrl}/health`);
  }
}
