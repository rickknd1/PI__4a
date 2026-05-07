package com.clubhub.treasury.entity;

import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

import java.time.LocalDateTime;

@Document(collection = "notifications")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Notification {

    @Id
    private String id;

    @Indexed
    @Field("club_id")
    private String clubId;

    private String recipientId;

    @Indexed
    @Field("recipient_email")
    private String recipientEmail;

    private NotificationType type;

    private String title;

    private String message;

    private boolean read = false;

    private boolean emailSent = false;

    private String attachmentUrl;

    private LocalDateTime createdAt = LocalDateTime.now();

    public enum NotificationType {
        PAYMENT_DUE,          // Cotisation a payer
        PAYMENT_CONFIRMED,    // Paiement confirme
        PAYMENT_LATE,         // Paiement en retard
        PAYMENT_REFUNDED,     // Remboursement
        EXPENSE_SUBMITTED,    // Depense soumise (pour tresorier)
        EXPENSE_VALIDATED,    // Depense validee (pour president)
        EXPENSE_APPROVED,     // Depense approuvee (pour soumetteur)
        EXPENSE_REJECTED,     // Depense rejetee (pour soumetteur)
        BUDGET_ALERT,         // Seuil budget atteint
        INVOICE_GENERATED,    // Facture generee
        REPORT_GENERATED,     // Bilan genere
        REMINDER              // Rappel general
    }
}
