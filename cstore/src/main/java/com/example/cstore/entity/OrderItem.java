package com.example.cstore.entity;

import jakarta.validation.constraints.*;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
public class OrderItem {

    public enum ItemStatus {
        BOOKED, IN_DELIVERY, SOLD
    }

    @NotBlank(message = "L'ID du produit est obligatoire")
    private String productId;

    private String productName;
    private Product.ProductType productType;

    @NotNull(message = "La quantité est obligatoire")
    @Positive(message = "La quantité doit être supérieure à 0")
    private Integer quantity;

    @NotNull(message = "Le prix unitaire est obligatoire")
    @Positive(message = "Le prix unitaire doit être supérieur à 0")
    private BigDecimal unitPrice;

    @NotNull(message = "Le sous-total est obligatoire")
    @PositiveOrZero(message = "Le sous-total ne peut pas être négatif")
    private BigDecimal subtotal;

    private ItemStatus status;

    private String eventName;
    private LocalDateTime eventDate;
    private String ticketCode;
}