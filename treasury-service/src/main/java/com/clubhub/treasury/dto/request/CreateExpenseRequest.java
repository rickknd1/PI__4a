package com.clubhub.treasury.dto.request;
import jakarta.validation.constraints.*;
import lombok.Data;
import java.math.BigDecimal;

@Data
public class CreateExpenseRequest {
    @NotBlank private String title;
    private String description;
    @NotNull @Positive private BigDecimal amount;
    private String justificatifUrl;
}
