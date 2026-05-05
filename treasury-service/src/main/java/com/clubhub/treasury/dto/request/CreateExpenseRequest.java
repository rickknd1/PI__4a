package com.clubhub.treasury.dto.request;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import lombok.Data;
import java.math.BigDecimal;
import java.util.List;

@Data
public class CreateExpenseRequest {
    @NotBlank private String title;
    private String description;
    @NotNull @Positive private BigDecimal amount;
    private String justificatifUrl;

    @NotNull @Size(min = 3, max = 3, message = "Exactly 3 quotes are required")
    @Valid
    private List<QuoteRequest> quotes;

    @Data
    public static class QuoteRequest {
        @NotBlank(message = "Provider name is required")
        private String providerName;
        @NotNull @Positive(message = "Quote amount must be positive")
        private BigDecimal amount;
        private String description;
    }
}
