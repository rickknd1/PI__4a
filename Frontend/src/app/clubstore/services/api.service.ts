// Adapter service: re-expose ClubstoreService methods + types under the
// names expected by the components ported from `groupe/clubstore-final`.
// Lets us drop-in those components without rewriting their imports.

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

const API_URL = 'http://localhost:8084/api'; // gateway

export interface Product {
  id: string;
  clubId?: string;
  clubName?: string;
  name: string;
  description?: string;
  price: number;
  productType: string;
  stockQuantity: number;
  isAvailable: boolean;
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

export interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
}

export interface Order {
  id?: string;
  memberId: string;
  orderNumber?: string;
  items: OrderItem[];
  totalAmount: number;
  status: string;
  orderDate?: string;
  shippingAddress: string;
  paymentMethod: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface OrderRequestPayload {
  memberId: string;
  shippingAddress: string;
  paymentMethod: string;
  items: { productId: string; quantity: number }[];
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  constructor(private http: HttpClient) {}

  // ===== PRODUCTS =====
  getAllProducts(): Observable<Product[]> {
    return this.http.get<Product[]>(`${API_URL}/products`, { withCredentials: true });
  }
  getProductsByType(type: string): Observable<Product[]> {
    return this.http.get<Product[]>(`${API_URL}/products/type/${type}`, { withCredentials: true });
  }
  getAvailableProducts(): Observable<Product[]> {
    return this.http.get<Product[]>(`${API_URL}/products/available`, { withCredentials: true });
  }
  getProductById(id: string): Observable<Product> {
    return this.http.get<Product>(`${API_URL}/products/${id}`, { withCredentials: true });
  }
  getProductRecommendations(productId: string): Observable<Product[]> {
    return this.http.get<Product[]>(`${API_URL}/products/${productId}/recommendations`, { withCredentials: true });
  }
  getNextUpcomingEvent(): Observable<Product> {
    return this.http.get<Product>(`${API_URL}/products/next-event`, { withCredentials: true });
  }
  createProduct(product: Product | any): Observable<Product> {
    return this.http.post<Product>(`${API_URL}/products`, product, { withCredentials: true });
  }
  updateProduct(id: string, product: Product | any): Observable<Product> {
    return this.http.put<Product>(`${API_URL}/products/${id}`, product, { withCredentials: true });
  }
  deleteProduct(id: string): Observable<void> {
    return this.http.delete<void>(`${API_URL}/products/${id}`, { withCredentials: true });
  }

  // ===== AI PDF EXTRACTION =====
  extractFromPdf(formData: FormData): Observable<any> {
    return this.http.post<any>(`${API_URL}/products/extract-from-pdf`, formData, { withCredentials: true });
  }

  // ===== ORDERS =====
  getAllOrders(): Observable<Order[]> {
    return this.http.get<Order[]>(`${API_URL}/orders`, { withCredentials: true });
  }
  getOrdersByMember(memberId: string): Observable<Order[]> {
    return this.http.get<Order[]>(`${API_URL}/orders/member/${memberId}`, { withCredentials: true });
  }
  createOrder(order: OrderRequestPayload): Observable<Order> {
    return this.http.post<Order>(`${API_URL}/orders`, order, { withCredentials: true });
  }
  updateOrderStatus(orderId: string, status: string): Observable<Order> {
    // cstore expects @RequestParam, so status goes in the query string
    return this.http.put<Order>(`${API_URL}/orders/${orderId}/status?status=${encodeURIComponent(status)}`, {}, { withCredentials: true });
  }
}
