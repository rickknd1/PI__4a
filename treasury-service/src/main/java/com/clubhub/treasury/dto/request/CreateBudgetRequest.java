package com.clubhub.treasury.dto.request;
import jakarta.validation.constraints.*;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class CreateBudgetRequest {
    @NotBlank private String label;
    @NotNull @Positive private BigDecimal totalAmount;
    @NotNull private LocalDate periodStart;
    @NotNull private LocalDate periodEnd;
}
