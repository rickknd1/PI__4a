import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { apiUrl } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class RecordService {

  private get api(): string {
    return apiUrl('/api');
  }

  constructor(private http: HttpClient) {}

  // 📥 RECORDS
  getAllRecords(): Observable<any[]> {
    return this.http.get<any[]>(`${this.api}/records`);
  }

  createRecord(record: any): Observable<any> {
    return this.http.post<any>(`${this.api}/records`, record);
  }

  deleteRecord(id: string) {
    return this.http.delete(`${this.api}/records/${id}`);
  }

  // 🧠 TRANSCRIPTION
  transcribe(recordId: string, file: File) {
    const formData = new FormData();
    formData.append('audio', file);

    return this.http.post<any>(
      `${this.api}/transcriptions/${recordId}?language=auto`,
      formData
    );
  }

  getTranscriptions(recordId: string) {
    return this.http.get<any>(
      `${this.api}/transcriptions/record/${recordId}`
    );
  }

  // 📄 PDF
  downloadPdf(recordId: string) {
    return this.http.get(
      `${this.api}/transcriptions/record/${recordId}/pdf`,
      { responseType: 'blob' }
    );
  }
}