// location.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { HttpParams } from '@angular/common/http';

/**
 * Polite identifier appended to every Nominatim request. The public
 * Nominatim instance asks consumers to identify themselves so abusive
 * clients can be contacted before being banned. A reachable email is
 * fine for academic / club projects.
 */
const NOMINATIM_EMAIL = 'clubhub-pfe@esprit.tn';

@Injectable({
  providedIn: 'root'
})
export class LocationService {
  constructor(private http: HttpClient) {}

  // Recherche d'adresse avec Nominatim (OpenStreetMap)
  geocodeAddress(address: string): Observable<any> {
    const url = 'https://nominatim.openstreetmap.org/search';
    const params = new HttpParams()
      .set('q', address)
      .set('format', 'jsonv2')
      .set('limit', '5')
      .set('addressdetails', '1')
      .set('email', NOMINATIM_EMAIL);
    return this.http.get(url, { params });
  }

  // Reverse geocoding (coordonnées → adresse)
  reverseGeocode(lat: number, lng: number): Observable<any> {
    const url = 'https://nominatim.openstreetmap.org/reverse';
    const params = new HttpParams()
      .set('lat', String(lat))
      .set('lon', String(lng))
      .set('format', 'json')
      .set('email', NOMINATIM_EMAIL);
    return this.http.get(url, { params });
  }
}