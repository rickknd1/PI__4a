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