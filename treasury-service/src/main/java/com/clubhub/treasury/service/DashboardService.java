package com.clubhub.treasury.service;

import com.clubhub.treasury.dto.response.DashboardResponse;
import com.clubhub.treasury.dto.response.DashboardResponse.MonthlyRevenue;
import com.clubhub.treasury.dto.response.PaymentResponse;
import com.clubhub.treasury.entity.Budget;
import com.clubhub.treasury.entity.Expense;
import com.clubhub.treasury.entity.Payment;
import com.clubhub.treasury.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.format.TextStyle;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class DashboardService {

    private final PaymentRepository paymentRepository;
    private final BudgetRepository budgetRepository;
    private final CotisationRuleRepository cotisationRuleRepository;
    private final ExpenseRepository expenseRepository;

    public DashboardResponse getDashboard(Long clubId) {
        // Load all payments once for in-memory computation
        List<Payment> allPayments = paymentRepository.findByClubIdOrderByCreatedAtDesc(clubId);

        // KPIs financiers (in-memory)
        BigDecimal totalCollected = allPayments.stream()
                .filter(p -> p.getStatus() == Payment.PaymentStatus.PAID)
                .map(Payment::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal totalPending = allPayments.stream()
                .filter(p -> p.getStatus() == Payment.PaymentStatus.PENDING)
                .map(Payment::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal totalLate = allPayments.stream()
                .filter(p -> p.getStatus() == Payment.PaymentStatus.LATE)
                .map(Payment::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);

        // Membres (in-memory: count distinct memberIds by status)
        long membersUp = allPayments.stream()
                .filter(p -> p.getStatus() == Payment.PaymentStatus.PAID)
                .map(Payment::getMemberId).distinct().count();
        long membersLate = allPayments.stream()
                .filter(p -> p.getStatus() == Payment.PaymentStatus.LATE)
                .map(Payment::getMemberId).distinct().count();

        // Taux de recouvrement
        double recoveryRate = 0;
        BigDecimal total = totalCollected.add(totalPending);
        if (total.compareTo(BigDecimal.ZERO) > 0) {
            recoveryRate = totalCollected.divide(total, 4, RoundingMode.HALF_UP)
                    .multiply(BigDecimal.valueOf(100)).doubleValue();
        }

        // Budget actif
        int budgetPct = 0;
        BigDecimal budgetTotal = BigDecimal.ZERO;
        BigDecimal budgetConsumed = BigDecimal.ZERO;
        BigDecimal budgetRemaining = BigDecimal.ZERO;
        Optional<Budget> activeBudget = budgetRepository
                .findFirstByClubIdAndPeriodStartLessThanEqualAndPeriodEndGreaterThanEqualOrderByCreatedAtDesc(clubId, LocalDate.now(), LocalDate.now());
        if (activeBudget.isPresent()) {
            Budget b = activeBudget.get();
            budgetPct = b.getConsumptionPercentage();
            budgetTotal = b.getTotalAmount();
            budgetConsumed = b.getConsumedAmount();
            budgetRemaining = b.getRemainingAmount();
        }

        // Depenses (in-memory)
        List<Expense> allExpenses = expenseRepository.findByClubIdOrderByCreatedAtDesc(clubId);
        BigDecimal totalExpApproved = allExpenses.stream()
                .filter(e -> e.getStatus() == Expense.ExpenseStatus.APPROVED)
                .map(Expense::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        long expPending = allExpenses.stream().filter(e -> e.getStatus() == Expense.ExpenseStatus.SUBMITTED || e.getStatus() == Expense.ExpenseStatus.VALIDATED).count();
        long expApproved = allExpenses.stream().filter(e -> e.getStatus() == Expense.ExpenseStatus.APPROVED).count();
        long expRejected = allExpenses.stream().filter(e -> e.getStatus() == Expense.ExpenseStatus.REJECTED).count();

        // Compteurs
        long totalRules = cotisationRuleRepository.findByClubId(clubId).size();
        long totalPayments = allPayments.size();
        long totalBudgets = budgetRepository.findByClubId(clubId).size();

        // Monthly revenue last 6 months (in-memory: filter by paidAt month/year)
        List<MonthlyRevenue> monthly = new ArrayList<>();
        for (int i = 5; i >= 0; i--) {
            LocalDate d = LocalDate.now().minusMonths(i);
            int month = d.getMonthValue();
            int year = d.getYear();
            BigDecimal rev = allPayments.stream()
                    .filter(p -> p.getStatus() == Payment.PaymentStatus.PAID && p.getPaidAt() != null
                            && p.getPaidAt().getMonthValue() == month && p.getPaidAt().getYear() == year)
                    .map(Payment::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
            monthly.add(MonthlyRevenue.builder()
                    .month(d.getMonth().getDisplayName(TextStyle.SHORT, Locale.FRENCH))
                    .revenue(rev)
                    .build());
        }

        // Recent transactions (last 10)
        List<PaymentResponse> recent = allPayments.stream().limit(10)
                .map(p -> PaymentResponse.builder()
                        .id(p.getId()).memberId(p.getMemberId()).amount(p.getAmount())
                        .status(p.getStatus()).dueDate(p.getDueDate()).paidAt(p.getPaidAt())
                        .createdAt(p.getCreatedAt())
                        .build())
                .collect(Collectors.toList());

        return DashboardResponse.builder()
                .totalCollected(totalCollected)
                .totalPending(totalPending)
                .totalLate(totalLate)
                .totalExpensesApproved(totalExpApproved)
                .recoveryRate(recoveryRate)
                .membersUpToDate(membersUp)
                .membersLate(membersLate)
                .totalMembers(membersUp + membersLate)
                .budgetConsumptionPercentage(budgetPct)
                .budgetTotal(budgetTotal)
                .budgetConsumed(budgetConsumed)
                .budgetRemaining(budgetRemaining)
                .totalRules(totalRules)
                .totalPayments(totalPayments)
                .totalExpenses(allExpenses.size())
                .expensesPending(expPending)
                .expensesApproved(expApproved)
                .expensesRejected(expRejected)
                .totalBudgets(totalBudgets)
                .monthlyRevenue(monthly)
                .recentTransactions(recent)
                .build();
    }
}
