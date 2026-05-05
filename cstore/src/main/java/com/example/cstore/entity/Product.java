package com.example.cstore.entity;

import jakarta.validation.constraints.*;
import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Document(collection = "products")
public class Product {

    public enum ProductType {
        TSHIRT, JERSEY, SCARF, CERTIFICATE, EVENT_TICKET, ACCESSORY, HAT
    }

    @Id
    private String id;

    @NotBlank(message = "Le clubId est obligatoire")
    private String clubId;

    @NotBlank(message = "Le nom du produit est obligatoire")
    @Size(min = 2, max = 100, message = "Le nom doit contenir entre 2 et 100 caractères")
    private String name;

    @Size(max = 500, message = "La description ne peut pas dépasser 500 caractères")
    private String description;

    @NotNull(message = "Le type de produit est obligatoire")
    private ProductType productType;

    @NotNull(message = "Le prix est obligatoire")
    @Positive(message = "Le prix doit être supérieur à 0")
    private BigDecimal price;

    @NotNull(message = "La quantité en stock est obligatoire")
    @PositiveOrZero(message = "Le stock ne peut pas être négatif")
    private Integer stockQuantity;

    private String imageUrl;

    private Boolean isAvailable = true;

    // Champs pour vêtements
    @Size(max = 10, message = "La taille ne peut pas dépasser 10 caractères")
    private String size;

    @Size(max = 30, message = "La couleur ne peut pas dépasser 30 caractères")
    private String color;

    // Champs pour CERTIFICATE
    @Positive(message = "La durée d'abonnement doit être positive")
    private Integer membershipDurationMonths;

    @Pattern(regexp = "^(BRONZE|SILVER|GOLD|PLATINUM)$", message = "Le niveau doit être BRONZE, SILVER, GOLD ou PLATINUM")
    private String membershipLevel;

    // Champs pour EVENT_TICKET
    @NotBlank(message = "Le nom de l'événement est obligatoire pour les tickets")
    private String eventName;

    @Future(message = "La date de l'événement doit être dans le futur")
    private LocalDateTime eventDate;

    private String venue;

    @Positive(message = "Le nombre total de tickets doit être positif")
    private Integer totalTickets;

    @PositiveOrZero(message = "Les tickets disponibles ne peuvent pas être négatifs")
    private Integer availableTickets;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}