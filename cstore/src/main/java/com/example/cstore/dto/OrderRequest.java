package com.example.cstore.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import lombok.Data;
import java.util.List;

@Data
public class OrderRequest {

    // FIX: Make memberId optional (not required)
    private String memberId;

    @NotEmpty(message = "La commande doit contenir au moins un article")
    @Valid
    private List<@Valid OrderItemRequest> items;

    @NotBlank(message = "L'adresse de livraison est obligatoire")
    @Size(min = 5, max = 255, message = "L'adresse doit contenir entre 5 et 255 caractères")
    private String shippingAddress;

    @NotBlank(message = "Le mode de paiement est obligatoire")
    @Pattern(regexp = "^(CARTE|PAYPAL|ESPECES|CASH_ON_DELIVERY|BANK_TRANSFER|STRIPE)$", message = "Mode de paiement invalide")
    private String paymentMethod;
}