import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  CotisationRule, Payment, Expense, Budget,
  TreasuryDashboard
} from '../models/treasury.models';

@Injectable({ providedIn: 'root' })
export class TreasuryApiService {
  private base = 'http://localhost:8082/api/v1/treasury';

  constructor(private http: HttpClient) {}

  // Dashboard
  getDashboard(clubId: number): Observable<TreasuryDashboard> {
    return this.http.get<TreasuryDashboard>(`${this.base}/${clubId}/dashboard`);
  }

  // Cotisations
  getCotisationRules(clubId: number): Observable<CotisationRule[]> {
    return this.http.get<CotisationRule[]>(`${this.base}/${clubId}/cotisations/rules`);
  }
  createCotisationRule(clubId: number, rule: Partial<CotisationRule>): Observable<CotisationRule> {
    return this.http.post<CotisationRule>(`${this.base}/${clubId}/cotisations/rules`, rule);
  }

  // Payments
  getPayments(clubId: number): Observable<Payment[]> {
    return this.http.get<Payment[]>(`${this.base}/${clubId}/payments`);
  }

  // Expenses
  getExpenses(clubId: number, status?: string): Observable<Expense[]> {
    const params = status ? `?status=${status}` : '';
    return this.http.get<Expense[]>(`${this.base}/${clubId}/expenses${params}`);
  }
  submitExpense(clubId: number, expense: Partial<Expense>): Observable<Expense> {
    return this.http.post<Expense>(`${this.base}/${clubId}/expenses`, expense);
  }
  validateExpense(clubId: number, expenseId: number): Observable<Expense> {
    return this.http.patch<Expense>(`${this.base}/${clubId}/expenses/${expenseId}/validate`, {});
  }
  approveExpense(clubId: number, expenseId: number): Observable<Expense> {
    return this.http.patch<Expense>(`${this.base}/${clubId}/expenses/${expenseId}/approve`, {});
  }
  rejectExpense(clubId: number, expenseId: number, reason: string): Observable<Expense> {
    return this.http.patch<Expense>(`${this.base}/${clubId}/expenses/${expenseId}/reject`, { reason });
  }

  // Budget
  getBudgets(clubId: number): Observable<Budget[]> {
    return this.http.get<Budget[]>(`${this.base}/${clubId}/budgets`);
  }
  createBudget(clubId: number, budget: Partial<Budget>): Observable<Budget> {
    return this.http.post<Budget>(`${this.base}/${clubId}/budgets`, budget);
  }
}
