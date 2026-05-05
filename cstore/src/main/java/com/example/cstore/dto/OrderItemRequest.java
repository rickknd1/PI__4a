package com.example.cstore.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import lombok.Data;

@Data
public class OrderItemRequest {

    @NotBlank(message = "L'ID du produit est obligatoire")
    private String productId;

    @Positive(message = "La quantité doit être supérieure à 0")
    private Integer quantity;
}