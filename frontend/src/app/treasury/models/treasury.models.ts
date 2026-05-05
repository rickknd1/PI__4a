// ================================================
// ClubHub - Treasury Module - TypeScript Models
// MongoDB — IDs are strings, clubId remains number
// ================================================

export type PaymentStatus = 'PENDING' | 'PENDING_CASH' | 'PAID' | 'LATE' | 'REFUNDED' | 'PARTIALLY_REFUNDED' | 'FAILED' | 'EXEMPT';
export type ExpenseStatus = 'SUBMITTED' | 'VALIDATED' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
export type ExpenseCategory = 'FOURNITURES' | 'TRANSPORT' | 'HEBERGEMENT' | 'RESTAURATION' | 'MATERIEL' | 'COMMUNICATION' | 'EVENEMENT' | 'AUTRE';
export type Frequency = 'MONTHLY' | 'QUARTERLY' | 'ANNUAL';

export interface CotisationRule {
  id: string;
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
  createdAt?: string;
  updatedAt?: string;
}

export interface Payment {
  id: string;
  memberId: string;
  memberName?: string;
  clubId: number;
  cotisationRuleId?: string;
  cotisationRuleName?: string;
  amount: number;
  status: PaymentStatus;
  dueDate: string;
  paidAt?: string;
  stripeReceiptUrl?: string;
  installmentNumber?: number;
  totalInstallments?: number;
  createdAt?: string;
}

export interface ExpenseQuote {
  providerName: string;
  amount: number;
  description?: string;
  selected: boolean;
}

export interface Expense {
  id: string;
  clubId: number;
  submittedByMemberId: string;
  submittedByMemberName?: string;
  title: string;
  description?: string;
  amount: number;
  status: ExpenseStatus;
  category?: ExpenseCategory;
  categoryConfidenceScore?: number;
  categoryValidatedByTreasurer: boolean;
  justificatifUrl?: string;
  quotes?: ExpenseQuote[];
  submittedAt?: string;
  validatedAt?: string;
  approvedAt?: string;
  rejectionReason?: string;
}

export interface Budget {
  id: string;
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
  id: string;
  paymentId: string;
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
  totalExpensesApproved?: number;
  recoveryRate: number;
  membersUpToDate: number;
  membersLate: number;
  totalMembers?: number;
  budgetConsumptionPercentage: number;
  budgetTotal?: number;
  budgetConsumed?: number;
  budgetRemaining?: number;
  totalRules?: number;
  totalPayments?: number;
  totalExpenses?: number;
  expensesPending?: number;
  expensesApproved?: number;
  expensesRejected?: number;
  totalBudgets?: number;
  monthlyRevenue: MonthlyRevenue[];
  recentTransactions: Payment[];
}

export interface MonthlyRevenue {
  month: string;
  revenue: number;
}

// AI - Predictions (BF10)
export interface BudgetPrediction {
  period: string;
  predictedRevenue: number;
  predictedExpenses: number;
  predictedBalance: number;
  confidence: number;
  trend: 'UP' | 'DOWN' | 'STABLE';
  alerts?: string[];
  source?: string;
}

// AI - Anomalies (BF12)
export interface AnomalyAlert {
  paymentId?: string;
  expenseId?: string;
  type: string;
  description: string;
  confidenceScore: number;
  zScore?: number;
  detectedAt: string;
}

// Chatbot (BF11)
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date | string;
}

// Audit (BF9)
export interface AuditLog {
  id: string;
  actorId: string;
  actorEmail: string;
  clubId: number;
  action: string;
  entityType: string;
  entityId: string;
  valuesBefore?: string;
  valuesAfter?: string;
  amount?: number;
  ipAddress?: string;
  timestamp: string;
}

// User (MongoDB)
// Roles alignes sur le module User (esprit.com.clubhub.entity.Role)
export type UserRole =
  | 'PRESIDENT'
  | 'VICE_PRESIDENT'
  | 'SECRETAIRE_GENERALE'
  | 'TRESORIER'
  | 'RH'
  | 'MEMBRE_SIMPLE';

export interface MockUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  role: UserRole;
  clubId: number | string;
  profilePhoto?: string;
}
