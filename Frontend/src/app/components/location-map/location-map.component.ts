import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as L from 'leaflet';

export interface LocationData {
  address: string;
  latitude: number;
  longitude: number;
  placeName?: string;
}

@Component({
  selector: 'app-location-map',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="space-y-4">
      <!-- Champ d'adresse -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">
          Adresse du lieu <span class="text-red-500">*</span>
        </label>
        <div class="flex gap-2">
          <input
            type="text"
            [(ngModel)]="searchAddress"
            (keyup.enter)="searchLocation()"
            placeholder="Ex: Amphi A, Campus Universitaire de la Manouba"
            class="flex-1 rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none">
          <button
            type="button"
            (click)="searchLocation()"
            [disabled]="!searchAddress || searching"
            class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {{ searching ? 'Recherche...' : '🔍 Localiser' }}
          </button>
        </div>
        <p class="text-xs text-gray-500 mt-1">
          Saisissez l'adresse et cliquez sur "Localiser" pour afficher la carte
        </p>
      </div>

      <!-- Carte -->
      <div *ngIf="showMap" class="border rounded-lg overflow-hidden">
        <div #mapContainer class="h-64 w-full"></div>

        <!-- Informations de localisation -->
        <div *ngIf="currentLocation" class="p-3 bg-gray-50 border-t">
          <div class="flex items-start justify-between">
            <div class="flex-1">
              <p class="text-sm font-medium text-gray-800">📍 {{ currentLocation.address }}</p>
              <p class="text-xs text-gray-500 mt-1">
                Coordonnées: {{ currentLocation.latitude.toFixed(6) }}, {{ currentLocation.longitude.toFixed(6) }}
              </p>
            </div>
            <button
              type="button"
              (click)="confirmLocation()"
              class="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700">
              ✅ Confirmer
            </button>
          </div>
        </div>
      </div>

      <!-- Localisation confirmée -->
      <div *ngIf="confirmedLocation && !showMap" class="p-3 bg-green-50 border border-green-200 rounded-lg">
        <div class="flex items-start justify-between">
          <div class="flex-1">
            <p class="text-sm font-medium text-green-800">✅ Localisation confirmée</p>
            <p class="text-sm text-green-700 mt-1">📍 {{ confirmedLocation.address }}</p>
          </div>
          <button
            type="button"
            (click)="editLocation()"
            class="px-3 py-1 bg-green-100 text-green-700 text-sm rounded hover:bg-green-200">
            ✏️ Modifier
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }
  `]
})
export class LocationMapComponent implements OnInit, OnDestroy {
  @Input() initialLocation?: LocationData;
  @Output() locationSelected = new EventEmitter<LocationData>();

  @ViewChild('mapContainer', { static: false }) mapContainer!: ElementRef;

  searchAddress = '';
  searching = false;
  showMap = false;
  currentLocation?: LocationData;
  confirmedLocation?: LocationData;

  private map?: L.Map;
  private marker?: L.Marker;

  ngOnInit() {
    if (this.initialLocation) {
      this.confirmedLocation = this.initialLocation;
      this.searchAddress = this.initialLocation.address;
    }
  }

  ngOnDestroy() {
    if (this.map) {
      this.map.remove();
    }
  }

  async searchLocation() {
    if (!this.searchAddress.trim()) return;

    this.searching = true;

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(this.searchAddress)}&limit=1`
      );

      const results = await response.json();

      if (results && results.length > 0) {
        const result = results[0];
        this.currentLocation = {
          address: this.searchAddress,
          latitude: parseFloat(result.lat),
          longitude: parseFloat(result.lon),
          placeName: result.display_name
        };

        this.showMap = true;
        this.confirmedLocation = undefined;

        setTimeout(() => this.initializeMap(), 100);
      } else {
        alert('❌ Adresse non trouvée. Veuillez vérifier l\'orthographe ou essayer une adresse plus précise.');
      }
    } catch (error) {
      console.error('Erreur de géocodage:', error);
      alert('❌ Erreur lors de la recherche de localisation. Veuillez réessayer.');
    } finally {
      this.searching = false;
    }
  }

  private initializeMap() {
    if (!this.currentLocation || !this.mapContainer) return;

    if (this.map) {
      this.map.remove();
    }

    this.map = L.map(this.mapContainer.nativeElement).setView(
      [this.currentLocation.latitude, this.currentLocation.longitude],
      15
    );

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(this.map);

    this.marker = L.marker([this.currentLocation.latitude, this.currentLocation.longitude])
      .addTo(this.map)
      .bindPopup(this.currentLocation.address)
      .openPopup();

    this.marker.on('dragend', (e) => {
      const position = e.target.getLatLng();
      if (this.currentLocation) {
        this.currentLocation.latitude = position.lat;
        this.currentLocation.longitude = position.lng;
      }
    });

    this.marker.dragging?.enable();
  }

  confirmLocation() {
    if (this.currentLocation) {
      this.confirmedLocation = { ...this.currentLocation };
      this.showMap = false;
      this.locationSelected.emit(this.confirmedLocation);

      if (this.map) {
        this.map.remove();
        this.map = undefined;
      }
    }
  }

  editLocation() {
    this.showMap = true;
    this.confirmedLocation = undefined;

    if (this.currentLocation) {
      setTimeout(() => this.initializeMap(), 100);
    }
  }
}
