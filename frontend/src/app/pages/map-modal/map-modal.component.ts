// map-modal.component.ts
import { Component, Input, OnInit, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as L from 'leaflet';

@Component({
  selector: 'app-map-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div *ngIf="show" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div class="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-3xl mx-4 overflow-hidden">
        <div class="flex justify-between items-center p-4 border-b">
          <h3 class="text-xl font-bold">{{ title }}</h3>
          <button (click)="close()" class="text-gray-500 hover:text-gray-700">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div class="p-4">
          <!-- La carte sera affichée ici -->
          <div id="map" style="height: 400px; width: 100%;"></div>
          
          <!-- Informations du lieu -->
          <div class="mt-4 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
            <p class="font-medium">{{ title }}</p>
            <p class="text-sm text-gray-600 dark:text-gray-400">{{ address }}</p>
            <div class="mt-2">
              <a 
                [href]="'https://www.openstreetmap.org/directions?from=&to=' + encodeURIComponent(address)"
                target="_blank"
                class="text-blue-500 text-sm hover:underline">
                📍 Obtenir l'itinéraire (OpenStreetMap)
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
})
export class MapModalComponent implements AfterViewInit {
  @Input() show = false;
  @Input() title = '';
  @Input() address = '';
  @Input() lat = 33.8869;   // Latitude par défaut (Tunis)
  @Input() lng = 9.5375;    // Longitude par défaut (Tunis)
  
  private map: L.Map | undefined;

  ngAfterViewInit() {
    if (this.show) {
      this.initMap();
    }
  }

  ngOnChanges() {
    if (this.show && this.map) {
      this.map.remove();
      this.initMap();
    } else if (this.show) {
      setTimeout(() => this.initMap(), 100);
    }
  }

  private initMap() {
    // Correction des icônes Leaflet (problème connu)
    const iconDefault = L.icon({
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41]
    });
    L.Marker.prototype.options.icon = iconDefault;

    // Créer la carte
    this.map = L.map('map').setView([this.lat, this.lng], 15);
    
    // Ajouter les tuiles OpenStreetMap (gratuit, sans clé)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributeurs'
    }).addTo(this.map);
    
    // Ajouter un marqueur
    L.marker([this.lat, this.lng])
      .addTo(this.map)
      .bindPopup(`<b>${this.title}</b><br>${this.address}`)
      .openPopup();
  }

  close() {
    this.show = false;
    if (this.map) {
      this.map.remove();
      this.map = undefined;
    }
  }
}