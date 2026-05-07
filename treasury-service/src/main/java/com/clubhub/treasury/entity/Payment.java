package com.clubhub.treasury.entity;

import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Document(collection = "payments")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Payment {

    @Id
    private String id;

    @Indexed
    @Field("member_id")
    private String memberId;

    @Indexed
    @Field("club_id")
    private String clubId;

    private String cotisationRuleId;

    private BigDecimal amount;

    @Indexed
    @Field("status")
    private PaymentStatus status;

    private LocalDate dueDate;

    private LocalDateTime paidAt;

    // Stripe
    private String stripePaymentIntentId;
    private String stripeReceiptUrl;

    // Installments
    private Integer installmentNumber;
    private Integer totalInstallments;

    private LocalDateTime createdAt = LocalDateTime.now();
    private LocalDateTime updatedAt = LocalDateTime.now();

    public enum PaymentStatus {
        PENDING, PENDING_CASH, PAID, LATE, REFUNDED, PARTIALLY_REFUNDED, FAILED, EXEMPT
    }
}
