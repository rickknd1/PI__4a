package com.clubhub.treasury.entity;

import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Document(collection = "audit_logs")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class AuditLog {

    @Id
    private String id;

    private String actorId;

    private String actorEmail;

    @Indexed
    @Field("club_id")
    private String clubId;

    private ActionType action;

    private String entityType;

    private String entityId;

    private String valuesBefore;

    private String valuesAfter;

    private BigDecimal amount;

    private String ipAddress;

    private LocalDateTime timestamp = LocalDateTime.now();

    public enum ActionType {
        PAYMENT_CREATED, PAYMENT_UPDATED, PAYMENT_REFUNDED,
        EXPENSE_SUBMITTED, EXPENSE_VALIDATED, EXPENSE_APPROVED, EXPENSE_REJECTED,
        COTISATION_RULE_CREATED, COTISATION_RULE_UPDATED,
        BUDGET_CREATED, BUDGET_UPDATED,
        RECEIPT_GENERATED
    }
}
