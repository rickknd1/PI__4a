package com.clubhub.treasury.entity;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "expenses")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Expense {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long clubId;

    @Column(nullable = false)
    private Long submittedByMemberId;

    private Long validatedByTreasurerId;
    private Long approvedByPresidentId;

    @Column(nullable = false)
    private String title;

    @Column(length = 1000)
    private String description;

    @Column(nullable = false, precision = 10, scale = 3)
    private BigDecimal amount;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ExpenseStatus status;

    // IA auto-categorization
    @Enumerated(EnumType.STRING)
    private ExpenseCategory category;

    private Integer categoryConfidenceScore; // 0-100

    private boolean categoryValidatedByTreasurer = false;

    // Justificatif (file path or URL)
    private String justificatifUrl;

    private LocalDateTime submittedAt;
    private LocalDateTime validatedAt;
    private LocalDateTime approvedAt;

    private String rejectionReason;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    void onCreate() {
        createdAt = updatedAt = LocalDateTime.now();
        if (status == null) status = ExpenseStatus.SUBMITTED;
        submittedAt = LocalDateTime.now();
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public enum ExpenseStatus {
        SUBMITTED, VALIDATED, APPROVED, REJECTED, CANCELLED
    }

    public enum ExpenseCategory {
        FOURNITURES, TRANSPORT, HEBERGEMENT, RESTAURATION,
        MATERIEL, COMMUNICATION, EVENEMENT, AUTRE
    }
}
