package com.clubhub.treasury.entity;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "budgets")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Budget {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long clubId;

    @Column(nullable = false)
    private String label;

    @Column(nullable = false, precision = 10, scale = 3)
    private BigDecimal totalAmount;

    @Column(nullable = false, precision = 10, scale = 3)
    private BigDecimal consumedAmount = BigDecimal.ZERO;

    @Column(nullable = false)
    private LocalDate periodStart;

    @Column(nullable = false)
    private LocalDate periodEnd;

    // Alert thresholds already sent (to avoid duplicate alerts)
    private boolean alert50Sent = false;
    private boolean alert75Sent = false;
    private boolean alert90Sent = false;
    private boolean alert100Sent = false;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    void onCreate() {
        createdAt = updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

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
