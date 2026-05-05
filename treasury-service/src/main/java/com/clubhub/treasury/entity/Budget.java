package com.clubhub.treasury.entity;

import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Document(collection = "budgets")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Budget {

    @Id
    private String id;

    @Indexed
    @Field("club_id")
    private Long clubId;

    private String label;

    private BigDecimal totalAmount;

    private BigDecimal consumedAmount = BigDecimal.ZERO;

    private LocalDate periodStart;

    private LocalDate periodEnd;

    // Alert thresholds already sent (to avoid duplicate alerts)
    private boolean alert50Sent = false;
    private boolean alert75Sent = false;
    private boolean alert90Sent = false;
    private boolean alert100Sent = false;

    private LocalDateTime createdAt = LocalDateTime.now();
    private LocalDateTime updatedAt = LocalDateTime.now();

    public BigDecimal getRemainingAmount() {
        return totalAmount.subtract(consumedAmount);
    }

    public int getConsumptionPercentage() {
        if (totalAmount.compareTo(BigDecimal.ZERO) == 0) return 0;
        return consumedAmount.multiply(BigDecimal.valueOf(100))
                .divide(totalAmount, 0, java.math.RoundingMode.HALF_UP)
                .intValue();
    }
}
