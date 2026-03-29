package com.clubhub.treasury.entity;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "audit_logs")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class AuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long actorId;

    @Column(nullable = false)
    private String actorEmail;

    @Column(nullable = false)
    private Long clubId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ActionType action;

    @Column(nullable = false)
    private String entityType;

    @Column(nullable = false)
    private Long entityId;

    @Column(columnDefinition = "TEXT")
    private String valuesBefore;

    @Column(columnDefinition = "TEXT")
    private String valuesAfter;

    private BigDecimal amount;

    private String ipAddress;

    @Column(nullable = false, updatable = false)
    private LocalDateTime timestamp;

    @PrePersist
    void onCreate() {
        timestamp = LocalDateTime.now();
    }

    public enum ActionType {
        PAYMENT_CREATED, PAYMENT_UPDATED, PAYMENT_REFUNDED,
        EXPENSE_SUBMITTED, EXPENSE_VALIDATED, EXPENSE_APPROVED, EXPENSE_REJECTED,
        COTISATION_RULE_CREATED, COTISATION_RULE_UPDATED,
        BUDGET_CREATED, BUDGET_UPDATED,
        RECEIPT_GENERATED
    }
}
