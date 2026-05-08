import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  CotisationRule, Payment, Expense, Budget,
  TreasuryDashboard, AnomalyAlert, BudgetPrediction,
  ChatMessage, AuditLog
} from '../models/treasury.models';

export interface LatePaymentPrediction {
  memberId: string;
  memberName: string;
  email: string;
  role: string;
  lateProbability: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN';
  previousPayments: number;
  previousLate: number;
}

@Injectable({ providedIn: 'root' })
export class TreasuryApiService {
  private base = 'http://localhost:8084/api/v1/treasury';

  constructor(private http: HttpClient) {}

  // Dashboard
  getDashboard(clubId: number | string): Observable<TreasuryDashboard> {
    return this.http.get<TreasuryDashboard>(`${this.base}/${clubId}/dashboard`);
  }

  // Cotisations
  getCotisationRules(clubId: number | string): Observable<CotisationRule[]> {
    return this.http.get<CotisationRule[]>(`${this.base}/${clubId}/cotisations/rules`);
  }
  createCotisationRule(clubId: number | string, rule: Partial<CotisationRule>): Observable<CotisationRule> {
    return this.http.post<CotisationRule>(`${this.base}/${clubId}/cotisations/rules`, rule);
  }

  // Payments
  getPayments(clubId: number | string): Observable<Payment[]> {
    return this.http.get<Payment[]>(`${this.base}/${clubId}/payments`);
  }

  // Expenses
  getExpenses(clubId: number | string, status?: string): Observable<Expense[]> {
    const params = status ? `?status=${status}` : '';
    return this.http.get<Expense[]>(`${this.base}/${clubId}/expenses${params}`);
  }
  submitExpense(clubId: number | string, expense: Partial<Expense>): Observable<Expense> {
    return this.http.post<Expense>(`${this.base}/${clubId}/expenses`, expense);
  }
  validateExpense(clubId: number | string, expenseId: string, selectedQuoteIndex: number = 0): Observable<Expense> {
    return this.http.patch<Expense>(`${this.base}/${clubId}/expenses/${expenseId}/validate`, { selectedQuoteIndex });
  }
  approveExpense(clubId: number | string, expenseId: string): Observable<Expense> {
    return this.http.patch<Expense>(`${this.base}/${clubId}/expenses/${expenseId}/approve`, {});
  }
  rejectExpense(clubId: number | string, expenseId: string, reason: string): Observable<Expense> {
    return this.http.patch<Expense>(`${this.base}/${clubId}/expenses/${expenseId}/reject`, { reason });
  }

  // Budget
  getBudgets(clubId: number | string): Observable<Budget[]> {
    return this.http.get<Budget[]>(`${this.base}/${clubId}/budgets`);
  }
  createBudget(clubId: number | string, budget: Partial<Budget>): Observable<Budget> {
    return this.http.post<Budget>(`${this.base}/${clubId}/budgets`, budget);
  }

  // Audit
  getAuditLogs(clubId: number | string): Observable<AuditLog[]> {
    return this.http.get<AuditLog[]>(`${this.base}/${clubId}/audit`);
  }

  // Receipts
  generateReceipt(clubId: number | string, paymentId: string, memberName: string, clubName: string): Observable<any> {
    return this.http.post(`${this.base}/${clubId}/receipts/generate/${paymentId}?memberName=${encodeURIComponent(memberName)}&clubName=${encodeURIComponent(clubName)}`, {});
  }
  downloadReceipt(clubId: number | string, paymentId: string, memberName: string, clubName: string): Observable<Blob> {
    return this.http.get(`${this.base}/${clubId}/receipts/download/${paymentId}?memberName=${encodeURIComponent(memberName)}&clubName=${encodeURIComponent(clubName)}`, { responseType: 'blob' });
  }

  // IA - Chatbot (BF11)
  chatAi(clubId: number | string, message: string): Observable<{ reply: string; source: string }> {
    return this.http.post<{ reply: string; source: string }>(`${this.base}/${clubId}/ai/chat`, { message });
  }

  // IA - Predictions (BF10)
  getPredictions(clubId: number | string, months: number = 3): Observable<BudgetPrediction[]> {
    return this.http.get<BudgetPrediction[]>(`${this.base}/${clubId}/ai/predictions?months=${months}`);
  }

  // IA - Anomalies (BF12)
  getAnomalies(clubId: number | string): Observable<AnomalyAlert[]> {
    return this.http.get<AnomalyAlert[]>(`${this.base}/${clubId}/ai/anomalies`);
  }

  // IA - Categorisation (BF13)
  categorizeExpense(clubId: number | string, title: string, description: string): Observable<{ category: string; confidence: number; reason: string; source: string }> {
    return this.http.post<{ category: string; confidence: number; reason: string; source: string }>(`${this.base}/${clubId}/ai/categorize`, { title, description });
  }

  // IA - Status
  getAiStatus(clubId: number | string): Observable<{ aiAvailable: boolean; model: string; features: string[] }> {
    return this.http.get<{ aiAvailable: boolean; model: string; features: string[] }>(`${this.base}/${clubId}/ai/status`);
  }

  // IA - Predictions retard paiement (Random Forest entraine localement)
  // Endpoint public /api/v1/demo/late-payment/predictions, route via gateway
  getLatePaymentPredictions(): Observable<LatePaymentPrediction[]> {
    return this.http.get<LatePaymentPrediction[]>('http://localhost:8084/api/v1/demo/late-payment/predictions');
  }

  // Stripe
  createPaymentIntent(clubId: number | string, paymentId: string, memberName: string): Observable<{ clientSecret: string; paymentIntentId: string; mode: string }> {
    return this.http.post<{ clientSecret: string; paymentIntentId: string; mode: string }>(`${this.base}/${clubId}/stripe/create-payment-intent/${paymentId}?memberName=${encodeURIComponent(memberName)}`, {});
  }

  // Stripe Checkout Session — redirige vers le portail Stripe
  createCheckoutSession(clubId: number | string, paymentId: string, memberName: string): Observable<{ sessionId: string; url: string; mode: string }> {
    const successUrl = encodeURIComponent(window.location.origin + '/treasury/payer-cotisation');
    const cancelUrl = encodeURIComponent(window.location.origin + '/treasury/payer-cotisation?cancelled=true');
    return this.http.post<{ sessionId: string; url: string; mode: string }>(
      `${this.base}/${clubId}/stripe/checkout-session/${paymentId}?memberName=${encodeURIComponent(memberName)}&successUrl=${successUrl}&cancelUrl=${cancelUrl}`, {});
  }

  // Retrieve PaymentIntent ID from a Checkout Session
  getStripeSession(clubId: number | string, sessionId: string): Observable<{ paymentIntentId: string; status: string }> {
    return this.http.get<{ paymentIntentId: string; status: string }>(`${this.base}/${clubId}/stripe/session/${sessionId}`);
  }

  // Confirm payment (after Stripe succeeds)
  confirmPayment(clubId: number | string, paymentId: string, stripeIntentId: string, receiptUrl: string, clubName: string, memberName?: string): Observable<any> {
    return this.http.patch(`${this.base}/${clubId}/payments/${paymentId}/confirm`,
      { stripeIntentId, receiptUrl, clubName, memberName: memberName || 'Membre' });
  }

  // Request cash payment (membre demande, tresorier devra valider)
  requestCashPayment(clubId: number | string, paymentId: string): Observable<any> {
    return this.http.patch(`${this.base}/${clubId}/payments/${paymentId}/request-cash`, {});
  }

  // Get member's own payments
  getMyPayments(clubId: number | string, memberId: string): Observable<Payment[]> {
    return this.http.get<Payment[]>(`${this.base}/${clubId}/payments/member/${memberId}`);
  }

  // Refund payment
  refundPayment(clubId: number | string, paymentId: string, actorId: string, actorEmail: string): Observable<any> {
    return this.http.patch(`${this.base}/${clubId}/payments/${paymentId}/refund`, {},
      { headers: { 'X-Actor-Id': actorId, 'X-Actor-Email': actorEmail } });
  }

  // Demo seed (public, route via gateway pour eviter CORS double)
  seedDemoData(): Observable<any> {
    return this.http.post('http://localhost:8084/api/v1/demo/seed', {});
  }
}
