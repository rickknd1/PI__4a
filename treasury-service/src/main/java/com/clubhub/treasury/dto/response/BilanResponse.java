package com.clubhub.treasury.dto.response;

import lombok.*;
import java.math.BigDecimal;
import java.util.List;

@Data @Builder
public class BilanResponse {
    private String periodLabel;
    private String startDate;
    private String endDate;
    private String generatedAt;

    // Revenus
    private BigDecimal totalRevenues;
    private long totalPaymentsPaid;
    private long totalPaymentsLate;
    private long totalPaymentsPending;

    // Depenses
    private BigDecimal totalExpensesApproved;
    private BigDecimal totalExpensesPending;
    private long countExpensesApproved;
    private long countExpensesPending;
    private long countExpensesRejected;

    // Solde
    private BigDecimal solde;
    private double recoveryRate;

    // Budget
    private BigDecimal budgetTotal;
    private BigDecimal budgetConsumed;
    private int budgetPercentage;

    // Details
    private List<PaymentResponse> payments;
    private List<ExpenseResponse> expenses;

    // Par categorie
    private List<CategoryBreakdown> expensesByCategory;

    @Data @Builder
    public static class CategoryBreakdown {
        private String category;
        private BigDecimal total;
        private long count;
        private double percentage;
    }
}
