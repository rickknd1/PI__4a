package com.clubhub.treasury.dto.response;

import lombok.*;
import java.time.LocalDateTime;

@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class AnomalyResponse {
    private String paymentId;
    private String expenseId;
    private String type;
    private String description;
    private int confidenceScore;
    private double zScore;
    private LocalDateTime detectedAt;
}
