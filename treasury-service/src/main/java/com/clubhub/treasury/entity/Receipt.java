package com.clubhub.treasury.entity;

import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

import java.time.LocalDateTime;

@Document(collection = "receipts")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Receipt {

    @Id
    private String id;

    private String paymentId;

    private String receiptNumber;

    private String filePath;

    private String memberName;

    private String clubName;

    private LocalDateTime generatedAt = LocalDateTime.now();
}
