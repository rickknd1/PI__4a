import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { apiUrl } from '../../../environments/environment';

export interface StaffMember {
  name: string;
  role: string;
  budget: number;
}

export interface BorrowedItem {
  id: string;
  eventId: string;
  eventName?: string;
  itemName: string;
  category: string;
  quantity: number;
  notes?: string;

  // Location
  allocationLocation?: string;
  allocationPeriodStart?: string;
  allocationPeriodEnd?: string;
  isAllocated?: boolean;

  // Budget
  locationBudget?: number;
  rentalFee?: number;
  estimatedBudget: number;

  // Staff
  staff?: StaffMember[];

  // Lender
  lenderName: string;
  lenderPhone?: string;
  lenderEmail?: string;
  lenderType?: string;
  lenderContactPerson?: string;
  lenderAddress?: string;

  // Dates
  borrowedDate: string;
  expectedReturnDate: string;
  actualReturnDate?: string;

  // Financial
  deposit?: number;
  isPaid?: boolean;
  deliveryMethod?: string;

  // Status
  status: 'requested' | 'approved' | 'picked_up' | 'in_use' | 'returned' | 'cancelled';
  reminderSent?: boolean;

  // Devis
  validatedDevisId?: string;
  validationNote?: string;
}

export interface Devis {
  id: string;
  borrowedItemId: string;
  supplierName: string;
  amount: number;
  validUntil?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  deliveryIncluded?: boolean;
  notes?: string;
  status: 'pending' | 'validated' | 'rejected';
  expanded?: boolean;
  createdAt?: string;
  validatedAt?: string;
}

export interface Lender {
  id?: string;
  name: string;
  type?: string;
  phone?: string;
  email?: string;
  address?: string;
  contactPerson?: string;
  totalBorrows?: number;
  onTimeReturns?: number;
  reliability?: 'high' | 'medium' | 'low';
  isActive?: boolean;
  notes?: string;
}

export interface ClubEvent {
  id: string;
  name: string;
  date?: string;
  location?: string;
}

@Injectable({ providedIn: 'root' })
export class BorrowingService {

  private baseUrl = apiUrl('/api');

  constructor(private http: HttpClient) {}

  // ── Borrowed Items ────────────────────────────────────────────────────
  getBorrowedItems(): Observable<BorrowedItem[]> {
    return this.http.get<BorrowedItem[]>(`${this.baseUrl}/borrowed-items`);
  }

  getBorrowedItemsByEvent(eventId: string): Observable<BorrowedItem[]> {
    return this.http.get<BorrowedItem[]>(`${this.baseUrl}/borrowed-items/event/${eventId}`);
  }

  createBorrowedItem(item: Partial<BorrowedItem>): Observable<BorrowedItem> {
    return this.http.post<BorrowedItem>(`${this.baseUrl}/borrowed-items`, item);
  }

  updateBorrowedItem(id: string, updates: Partial<BorrowedItem>): Observable<BorrowedItem> {
    return this.http.put<BorrowedItem>(`${this.baseUrl}/borrowed-items/${id}`, updates);
  }

  updateStatus(id: string, status: string): Observable<BorrowedItem> {
    return this.http.patch<BorrowedItem>(`${this.baseUrl}/borrowed-items/${id}/status?status=${status}`, {});
  }

  markReturned(id: string, body: { actualReturnDate: string; notes?: string; isPaid?: boolean }): Observable<BorrowedItem> {
    return this.http.patch<BorrowedItem>(`${this.baseUrl}/borrowed-items/${id}/return`, body);
  }

  deleteBorrowedItem(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/borrowed-items/${id}`);
  }

  // ── Devis ─────────────────────────────────────────────────────────────
  getDevisForItem(itemId: string): Observable<Devis[]> {
    return this.http.get<Devis[]>(`${this.baseUrl}/devis/item/${itemId}`);
  }

  createDevis(devis: Partial<Devis>): Observable<Devis> {
    return this.http.post<Devis>(`${this.baseUrl}/devis`, devis);
  }

  validateDevis(devisId: string, note?: string): Observable<Devis> {
    return this.http.patch<Devis>(`${this.baseUrl}/devis/${devisId}/validate`, { note: note || '' });
  }

  rejectDevis(devisId: string): Observable<void> {
    return this.http.patch<void>(`${this.baseUrl}/devis/${devisId}/reject`, {});
  }

  // ── Document extraction ───────────────────────────────────────────────
  extractFromDocument(formData: FormData): Observable<any> {
    return this.http.post<any>(`${this.baseUrl}/borrowed-items/extract`, formData);
  }

  // ── Lenders ───────────────────────────────────────────────────────────
  // FIX: was calling /api/lenders which had no handler → now correctly hits GET /api/lenders
  getLenders(): Observable<Lender[]> {
    return this.http.get<Lender[]>(`${this.baseUrl}/lenders`);
  }

  getLenderDetails(lenderName: string): Observable<{ lender: Lender; items: BorrowedItem[] }> {
    return this.http.get<{ lender: Lender; items: BorrowedItem[] }>(
      `${this.baseUrl}/lenders/${encodeURIComponent(lenderName)}/details`
    );
  }

  createLender(lender: Partial<Lender>): Observable<Lender> {
    return this.http.post<Lender>(`${this.baseUrl}/lenders`, lender);
  }

  updateLender(id: string, lender: Partial<Lender>): Observable<Lender> {
    return this.http.put<Lender>(`${this.baseUrl}/lenders/${id}`, lender);
  }

  deleteLender(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/lenders/${id}`);
  }
}
