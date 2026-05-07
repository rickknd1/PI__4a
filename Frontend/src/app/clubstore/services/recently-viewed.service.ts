import { Injectable } from '@angular/core';
import { Product } from './api.service';

@Injectable({ providedIn: 'root' })
export class RecentlyViewedService {
  private readonly STORAGE_KEY = 'recently_viewed';
  private readonly MAX_ITEMS = 5;

  addProduct(product: Product): void {
    let recent = this.getProducts();
    recent = recent.filter(p => p.id !== product.id);
    recent.unshift(product);
    recent = recent.slice(0, this.MAX_ITEMS);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(recent));
  }

  getProducts(): Product[] {
    const data = localStorage.getItem(this.STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  }

  clear(): void {
    localStorage.removeItem(this.STORAGE_KEY);
  }
}
