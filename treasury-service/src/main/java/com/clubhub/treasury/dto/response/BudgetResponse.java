package com.clubhub.treasury.dto.response;
import lombok.Builder;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDate;

@Data @Builder
public class BudgetResponse {
    private Long id;
    private Long clubId;
    private String label;
    private BigDecimal totalAmount;
    private BigDecimal consumedAmount;
    private BigDecimal remainingAmount;
    private int consumptionPercentage;
    private LocalDate periodStart;
    private LocalDate periodEnd;
}
