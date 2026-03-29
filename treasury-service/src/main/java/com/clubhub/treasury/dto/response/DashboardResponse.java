package com.clubhub.treasury.dto.response;
import lombok.Builder;
import lombok.Data;
import java.math.BigDecimal;
import java.util.List;

@Data @Builder
public class DashboardResponse {
    private BigDecimal totalCollected;
    private BigDecimal totalPending;
    private BigDecimal totalLate;
    private double recoveryRate;
    private long membersUpToDate;
    private long membersLate;
    private int budgetConsumptionPercentage;
    private List<MonthlyRevenue> monthlyRevenue;
    private List<PaymentResponse> recentTransactions;

    @Data @Builder
    public static class MonthlyRevenue {
        private String month;
        private BigDecimal revenue;
    }
}
