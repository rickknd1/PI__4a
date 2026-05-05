package com.clubhub.treasury.dto.response;
import lombok.Builder;
import lombok.Data;
import java.math.BigDecimal;
import java.util.List;

@Data @Builder
public class DashboardResponse {
    // KPIs financiers
    private BigDecimal totalCollected;
    private BigDecimal totalPending;
    private BigDecimal totalLate;
    private BigDecimal totalExpensesApproved;
    private double recoveryRate;

    // Membres
    private long membersUpToDate;
    private long membersLate;
    private long totalMembers;

    // Budget
    private int budgetConsumptionPercentage;
    private BigDecimal budgetTotal;
    private BigDecimal budgetConsumed;
    private BigDecimal budgetRemaining;

    // Compteurs activite
    private long totalRules;
    private long totalPayments;
    private long totalExpenses;
    private long expensesPending;
    private long expensesApproved;
    private long expensesRejected;
    private long totalBudgets;

    // Graphiques
    private List<MonthlyRevenue> monthlyRevenue;
    private List<PaymentResponse> recentTransactions;

    @Data @Builder
    public static class MonthlyRevenue {
        private String month;
        private BigDecimal revenue;
    }
}
