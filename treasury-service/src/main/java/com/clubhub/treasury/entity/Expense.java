package com.clubhub.treasury.entity;

import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Document(collection = "expenses")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Expense {

    @Id
    private String id;

    @Indexed
    @Field("club_id")
    private String clubId;

    private String submittedByMemberId;

    private String validatedByTreasurerId;
    private String approvedByPresidentId;

    private String title;

    private String description;

    private BigDecimal amount;

    @Indexed
    @Field("status")
    private ExpenseStatus status;

    // IA auto-categorization
    private ExpenseCategory category;

    private Integer categoryConfidenceScore; // 0-100

    private boolean categoryValidatedByTreasurer = false;

    // 3-quote system: member must provide 3 quotes from different providers
    private List<Quote> quotes;

    // Justificatif (file path or URL)
    private String justificatifUrl;

    private LocalDateTime submittedAt;
    private LocalDateTime validatedAt;
    private LocalDateTime approvedAt;

    private String rejectionReason;

    private LocalDateTime createdAt = LocalDateTime.now();
    private LocalDateTime updatedAt = LocalDateTime.now();

    public enum ExpenseStatus {
        SUBMITTED, VALIDATED, APPROVED, REJECTED, CANCELLED
    }

    @Data @NoArgsConstructor @AllArgsConstructor @Builder
    public static class Quote {
        private String providerName;    // Nom du fournisseur
        private BigDecimal amount;      // Montant du devis
        private String description;     // Description
        private boolean selected;       // true si choisi par le tresorier
    }

    public enum ExpenseCategory {
        FOURNITURES, TRANSPORT, HEBERGEMENT, RESTAURATION,
        MATERIEL, COMMUNICATION, EVENEMENT, AUTRE
    }
}
