import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Product } from './api.service';

export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  stockQuantity?: number;
  productType?: string;
  description?: string;
  isAvailable?: boolean;
  imageUrl?: string;
  eventName?: string;
  eventDate?: string;
  venue?: string;
  totalTickets?: number;
  availableTickets?: number;
}

@Injectable({ providedIn: 'root' })
export class CartService {
  private items: CartItem[] = [];
  private cartSubject = new BehaviorSubject<CartItem[]>([]);
  cart$ = this.cartSubject.asObservable();

  constructor() {
    const savedCart = localStorage.getItem('cart');
    if (savedCart) {
      this.items = JSON.parse(savedCart);
      this.cartSubject.next(this.items);
    }
  }

  private saveToLocalStorage(): void {
    localStorage.setItem('cart', JSON.stringify(this.items));
  }

  addToCart(product: Product, quantity: number = 1): void {
    const existingItem = this.items.find(item => item.id === product.id);
    if (existingItem) {
      const newQuantity = existingItem.quantity + quantity;
      if (newQuantity <= (product.stockQuantity || 999)) {
        existingItem.quantity = newQuantity;
      } else {
        alert(`Stock maximum atteint pour ${product.name}. Stock disponible: ${product.stockQuantity}`);
        return;
      }
    } else {
      if (quantity <= (product.stockQuantity || 999)) {
        this.items.push({
          id: product.id || '',
          name: product.name,
          price: product.price,
          quantity,
          stockQuantity: product.stockQuantity,
          productType: product.productType,
          description: product.description,
          isAvailable: product.isAvailable,
          imageUrl: product.imageUrl,
          eventName: product.eventName,
          eventDate: product.eventDate,
          venue: product.venue,
          totalTickets: product.totalTickets,
          availableTickets: product.availableTickets,
        });
      } else {
        alert(`Stock maximum atteint pour ${product.name}. Stock disponible: ${product.stockQuantity}`);
        return;
      }
    }
    this.saveToLocalStorage();
    this.cartSubject.next(this.items);
  }

  removeFromCart(productId: string): void {
    this.items = this.items.filter(item => item.id !== productId);
    this.saveToLocalStorage();
    this.cartSubject.next(this.items);
  }

  updateQuantity(productId: string, quantity: number): void {
    const item = this.items.find(item => item.id === productId);
    if (item) {
      if (quantity <= 0) {
        this.removeFromCart(productId);
      } else if (quantity <= (item.stockQuantity || 999)) {
        item.quantity = quantity;
        this.saveToLocalStorage();
        this.cartSubject.next(this.items);
      } else {
        alert(`Stock maximum: ${item.stockQuantity}`);
      }
    }
  }

  getCartItems(): CartItem[] { return this.items; }
  getTotalItems(): number { return this.items.reduce((s, i) => s + i.quantity, 0); }
  getTotalPrice(): number { return this.items.reduce((s, i) => s + i.price * i.quantity, 0); }
  clearCart(): void {
    this.items = [];
    this.saveToLocalStorage();
    this.cartSubject.next(this.items);
  }
  isCartEmpty(): boolean { return this.items.length === 0; }
  getUniqueItemsCount(): number { return this.items.length; }
  getFormattedTotalPrice(): string { return `${this.getTotalPrice().toFixed(3)} DT`; }
  formatPrice(price: number): string { return `${price.toFixed(3)} DT`; }
}
