package com.clubhub.treasury.dto.response;

import lombok.*;
import java.math.BigDecimal;
import java.util.List;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class PredictionResponse {
    private String period;
    private BigDecimal predictedRevenue;
    private BigDecimal predictedExpenses;
    private BigDecimal predictedBalance;
    private int confidence;
    private String trend;
    private List<String> alerts;
    private String source;
}
