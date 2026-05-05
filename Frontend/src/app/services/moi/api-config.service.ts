import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ApiConfigService {
  private apiUrl: string;

  constructor() {
    // Utiliser l'URL de l'environnement
    this.apiUrl = environment.apiUrl;
    console.log('🔧 API URL configurée:', this.apiUrl);
  }

  getQRTokensUrl(): string {
    return `${this.apiUrl}/qr-tokens`;
  }

  getElectionsUrl(): string {
    return `${this.apiUrl}/elections`;
  }

  getAuthUrl(): string {
    return `${this.apiUrl}/auth`;
  }

  getClubsUrl(): string {
    return `${this.apiUrl}/clubs`;
  }

  getUsersUrl(): string {
    return `${this.apiUrl}/users`;
  }
}
