// ================================================
// ClubHub - Treasury Module - TypeScript Models
// Mirrors Spring Boot entities + API DTOs
// ================================================

export type PaymentStatus = 'PENDING' | 'PAID' | 'LATE' | 'REFUNDED' | 'PARTIALLY_REFUNDED' | 'FAILED' | 'EXEMPT';
export type ExpenseStatus = 'SUBMITTED' | 'VALIDATED' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
export type ExpenseCategory = 'FOURNITURES' | 'TRANSPORT' | 'HEBERGEMENT' | 'RESTAURATION' | 'MATERIEL' | 'COMMUNICATION' | 'EVENEMENT' | 'AUTRE';
export type Frequency = 'MONTHLY' | 'QUARTERLY' | 'ANNUAL';

export interface CotisationRule {
  id: number;
  clubId: number;
  name: string;
  amount: number;
  frequency: Frequency;
  startDate: string;
  endDate?: string;
  active: boolean;
  allowExemption: boolean;
  allowInstallments: boolean;
  maxInstallments?: number;
}

export interface Payment {
  id: number;
  memberId: number;
  memberName?: string;
  clubId: number;
  cotisationRule?: CotisationRule;
  amount: number;
  status: PaymentStatus;
  dueDate: string;
  paidAt?: string;
  stripeReceiptUrl?: string;
  installmentNumber?: number;
  totalInstallments?: number;
}

export interface Expense {
  id: number;
  clubId: number;
  submittedByMemberId: number;
  submittedByMemberName?: string;
  title: string;
  description?: string;
  amount: number;
  status: ExpenseStatus;
  category?: ExpenseCategory;
  categoryConfidenceScore?: number;
  categoryValidatedByTreasurer: boolean;
  justificatifUrl?: string;
  submittedAt?: string;
  validatedAt?: string;
  approvedAt?: string;
  rejectionReason?: string;
}

export interface Budget {
  id: number;
  clubId: number;
  label: string;
  totalAmount: number;
  consumedAmount: number;
  remainingAmount: number;
  consumptionPercentage: number;
  periodStart: string;
  periodEnd: string;
}

export interface Receipt {
  id: number;
  paymentId: number;
  receiptNumber: string;
  filePath: string;
  memberName: string;
  clubName: string;
  generatedAt: string;
}

// Dashboard KPIs
export interface TreasuryDashboard {
  totalCollected: number;
  totalPending: number;
  totalLate: number;
  recoveryRate: number;
  membersUpToDate: number;
  membersLate: number;
  budgetConsumptionPercentage: number;
  monthlyRevenue: MonthlyRevenue[];
  recentTransactions: Payment[];
}

export interface MonthlyRevenue {
  month: string;
  revenue: number;
  target: number;
}

// AI
export interface BudgetPrediction {
  period: string;
  predictedRevenue: number;
  predictedExpenses: number;
  predictedBalance: number;
  confidence: number;
  trend: 'UP' | 'DOWN' | 'STABLE';
  alert?: string;
}

export interface AnomalyAlert {
  paymentId?: number;
  expenseId?: number;
  type: string;
  description: string;
  confidenceScore: number;
  detectedAt: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}
