package com.clubhub.treasury.dto.request;
import com.clubhub.treasury.entity.CotisationRule.Frequency;
import jakarta.validation.constraints.*;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class CreateCotisationRuleRequest {
    @NotBlank private String name;
    @NotNull @Positive private BigDecimal amount;
    @NotNull private Frequency frequency;
    @NotNull private LocalDate startDate;
    private LocalDate endDate;
    private boolean allowExemption = false;
    private boolean allowInstallments = false;
    private Integer maxInstallments;
}
