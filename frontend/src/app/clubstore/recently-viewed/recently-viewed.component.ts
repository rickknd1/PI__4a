import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { RecentlyViewedService } from '../services/recently-viewed.service';
import { Product } from '../services/api.service';

@Component({
  selector: 'app-recently-viewed',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div *ngIf="recentProducts.length > 0" class="mt-3 rounded-lg border border-blue-200 bg-gradient-to-br from-blue-50 to-white shadow-sm overflow-hidden">
      <div class="px-3 py-2 bg-blue-100 border-b border-blue-200">
        <div class="flex items-center gap-2">
          <svg class="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <h3 class="text-xs font-semibold uppercase tracking-wide text-blue-700">Récemment consultés</h3>
        </div>
      </div>
      <div class="p-2 space-y-1">
        <a *ngFor="let product of recentProducts"
           [routerLink]="['/products', product.id]"
           class="flex items-center gap-2 p-2 rounded-lg text-gray-700 hover:bg-blue-50 transition group">
          <div class="w-8 h-8 bg-gray-100 rounded-md overflow-hidden flex-shrink-0">
            <img [src]="product.imageUrl || 'https://placehold.co/40x40/f0f0f0/969696?text=?'" class="w-full h-full object-cover">
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium truncate">{{ product.name }}</p>
            <p class="text-xs text-gray-500">{{ product.price }} DT</p>
          </div>
          <svg class="w-4 h-4 text-gray-400 group-hover:text-blue-500 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
          </svg>
        </a>
      </div>
    </div>
  `,
})
export class RecentlyViewedComponent implements OnInit {
  recentProducts: Product[] = [];
  constructor(private recentlyViewed: RecentlyViewedService) {}
  ngOnInit() { this.recentProducts = this.recentlyViewed.getProducts(); }
  refresh() { this.recentProducts = this.recentlyViewed.getProducts(); }
}
