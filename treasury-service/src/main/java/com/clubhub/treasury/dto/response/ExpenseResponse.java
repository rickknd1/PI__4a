package com.clubhub.treasury.dto.response;
import com.clubhub.treasury.entity.Expense.ExpenseStatus;
import com.clubhub.treasury.entity.Expense.ExpenseCategory;
import lombok.Builder;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data @Builder
public class ExpenseResponse {
    private Long id;
    private Long clubId;
    private Long submittedByMemberId;
    private String submittedByMemberName;
    private String title;
    private String description;
    private BigDecimal amount;
    private ExpenseStatus status;
    private ExpenseCategory category;
    private Integer categoryConfidenceScore;
    private boolean categoryValidatedByTreasurer;
    private String justificatifUrl;
    private LocalDateTime submittedAt;
    private LocalDateTime validatedAt;
    private LocalDateTime approvedAt;
    private String rejectionReason;
}
