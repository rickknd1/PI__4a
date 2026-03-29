package com.clubhub.treasury.dto.response;
import com.clubhub.treasury.entity.Payment.PaymentStatus;
import lombok.Builder;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data @Builder
public class PaymentResponse {
    private Long id;
    private Long memberId;
    private String memberName;
    private Long clubId;
    private Long cotisationRuleId;
    private String cotisationRuleName;
    private BigDecimal amount;
    private PaymentStatus status;
    private LocalDate dueDate;
    private LocalDateTime paidAt;
    private String stripeReceiptUrl;
    private Integer installmentNumber;
    private Integer totalInstallments;
    private LocalDateTime createdAt;
}
