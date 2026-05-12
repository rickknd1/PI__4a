// src/app/shared/interfaces/borrowed-item.interface.ts
export interface BorrowedItem {
  id?: string;
  eventId: string;
  itemName: string;
  category: string;
  quantity: number;
  
  // Flattened lender fields
  lenderName: string;
  lenderType?: string;
  lenderContactPerson?: string;
  lenderPhone?: string;
  lenderEmail?: string;
  lenderAddress?: string;
  
  borrowedDate: string;
  expectedReturnDate: string;
  actualReturnDate?: string;
  status: 'requested' | 'approved' | 'picked_up' | 'in_use' | 'returned' | 'cancelled';
  deliveryMethod?: string;
  deposit?: number;
  rentalFee?: number;
  notes?: string;
  isPaid: boolean;
  reminderSent: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Lender {
  id?: string;
  name: string;
  type?: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  reliability?: 'high' | 'medium' | 'low';
  totalBorrows?: number;
  onTimeReturns?: number;
  lastBorrowDate?: string;
  notes?: string;
}

export interface BorrowStats {
  totalItems: number;
  borrowedItems: number;
  returnedItems: number;
  overdueItems: number;
  totalDeposit: number;
  totalFees: number;
  pendingReturns: number;
}

export type BorrowStatus = 'requested' | 'approved' | 'picked_up' | 'in_use' | 'returned' | 'cancelled';
export type BorrowCategory = 'audio_visual' | 'furniture' | 'decoration' | 'catering' | 'tools' | 'equipment' | 'vehicles' | 'other';