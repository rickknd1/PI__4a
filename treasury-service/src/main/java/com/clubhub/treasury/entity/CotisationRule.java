package com.clubhub.treasury.entity;

import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Document(collection = "cotisation_rules")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class CotisationRule {

    @Id
    private String id;

    @Indexed
    @Field("club_id")
    private Long clubId;

    private String name;

    private BigDecimal amount;

    private Frequency frequency;

    private LocalDate startDate;

    private LocalDate endDate;

    private boolean active = true;

    private boolean allowExemption = false;

    private boolean allowInstallments = false;

    private Integer maxInstallments;

    private LocalDateTime createdAt = LocalDateTime.now();
    private LocalDateTime updatedAt = LocalDateTime.now();

    public enum Frequency {
        MONTHLY, QUARTERLY, ANNUAL
    }

    @Override
    public String toString() {
        return name + " - " + amount + " TND/" + frequency;
    }
}
