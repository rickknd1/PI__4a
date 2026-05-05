package com.example.cstore.entity;

import jakarta.validation.constraints.*;
import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Data
@Document(collection = "orders")
public class Order {

    public enum OrderStatus {
        PENDING, CONFIRMED, SHIPPED, DELIVERED, CANCELLED
    }

    @Id
    private String id;

    @NotBlank(message = "L'ID du membre est obligatoire")
    private String memberId;

    @Indexed(unique = true)
    private String orderNumber;

    @NotEmpty(message = "La commande doit contenir au moins un article")
    private List<OrderItem> items;

    @NotNull(message = "Le montant total est obligatoire")
    @PositiveOrZero(message = "Le montant total ne peut pas être négatif")
    private BigDecimal totalAmount;

    @NotNull(message = "Le statut est obligatoire")
    private OrderStatus status;

    @NotNull(message = "La date de commande est obligatoire")
    private LocalDateTime orderDate;

    @NotBlank(message = "L'adresse de livraison est obligatoire")
    @Size(min = 5, max = 255, message = "L'adresse doit contenir entre 5 et 255 caractères")
    private String shippingAddress;

    @NotBlank(message = "Le mode de paiement est obligatoire")
    @Pattern(regexp = "^(CARTE|PAYPAL|ESPECES|CASH_ON_DELIVERY|BANK_TRANSFER|STRIPE)$", message = "Mode de paiement invalide")
    private String paymentMethod;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}