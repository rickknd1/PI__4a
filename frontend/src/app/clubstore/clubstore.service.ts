// =============================================================================
// CLUBSTORE SERVICE — version minimale integree au frontend principal v1.3
// =============================================================================
// Ce service expose les endpoints du microservice store-service (port 8087)
// via le Gateway (port 8084 -> /api/products, /api/orders, /api/cart).
//
// On reste sur le pattern HttpClient direct vers le Gateway, comme treasury.
// Le JWT est porte par le cookie HttpOnly (withCredentials: true).
// =============================================================================

import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

export interface StoreProduct {
  id?: string;
  clubId?: string;
  name: string;
  description?: string;
  price: number;
  productType: string;
  stockQuantity: number;
  isAvailable?: boolean;
  imageUrl?: string;
  size?: string;
  color?: string;
  eventName?: string;
  eventDate?: string;
  venue?: string;
  totalTickets?: number;
  availableTickets?: number;
  membershipDurationMonths?: number;
  membershipLevel?: string;
}

export interface StoreOrderItem {
  productId: string;
  quantity: number;
  productName?: string;
  price?: number;
}

export interface StoreOrderRequest {
  memberId: string;
  shippingAddress: string;
  paymentMethod: string;
  items: StoreOrderItem[];
}

export interface StoreOrder {
  id?: string;
  memberId: string;
  orderNumber?: string;
  items: StoreOrderItem[];
  totalAmount: number;
  status: string;
  orderDate?: string;
  shippingAddress: string;
  paymentMethod: string;
}

@Injectable({ providedIn: 'root' })
export class ClubstoreService {
  // Le frontend tape la Gateway (8084), qui route vers store-service (8087).
  private readonly base = 'http://localhost:8084/api';

  constructor(private http: HttpClient) {}

  // ========== PRODUCTS ==========
  list(): Observable<StoreProduct[]> {
    return this.http
      .get<StoreProduct[]>(`${this.base}/products`, { withCredentials: true })
      .pipe(catchError(() => of([])));
  }

  byType(type: string): Observable<StoreProduct[]> {
    return this.http
      .get<StoreProduct[]>(`${this.base}/products/type/${type}`, {
        withCredentials: true,
      })
      .pipe(catchError(() => of([])));
  }

  available(): Observable<StoreProduct[]> {
    return this.http
      .get<StoreProduct[]>(`${this.base}/products/available`, {
        withCredentials: true,
      })
      .pipe(catchError(() => of([])));
  }

  create(p: StoreProduct): Observable<StoreProduct> {
    return this.http.post<StoreProduct>(`${this.base}/products`, p, {
      withCredentials: true,
    });
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/products/${id}`, {
      withCredentials: true,
    });
  }

  /** Update product (admin). */
  update(id: string, p: StoreProduct): Observable<StoreProduct> {
    return this.http.put<StoreProduct>(`${this.base}/products/${id}`, p, {
      withCredentials: true,
    });
  }

  // ========== ORDERS ==========
  myOrders(memberId: string): Observable<StoreOrder[]> {
    return this.http
      .get<StoreOrder[]>(`${this.base}/orders/member/${memberId}`, {
        withCredentials: true,
      })
      .pipe(catchError(() => of([])));
  }

  /** Liste de TOUTES les commandes (admin). */
  allOrders(): Observable<StoreOrder[]> {
    return this.http
      .get<StoreOrder[]>(`${this.base}/orders`, { withCredentials: true })
      .pipe(catchError(() => of([])));
  }

  /** Update status d'une order (admin: PENDING -> CONFIRMED -> SHIPPED -> DELIVERED). */
  updateOrderStatus(id: string, status: string): Observable<StoreOrder> {
    // Backend expects @RequestParam, so status goes in the query string
    return this.http.put<StoreOrder>(
      `${this.base}/orders/${id}/status?status=${encodeURIComponent(status)}`,
      {},
      { withCredentials: true }
    );
  }

  placeOrder(req: StoreOrderRequest): Observable<StoreOrder> {
    return this.http.post<StoreOrder>(`${this.base}/orders`, req, {
      withCredentials: true,
    });
  }
}
