package com.clubhub.treasury.dto.request;
import jakarta.validation.constraints.*;
import lombok.Data;

@Data
public class CreatePaymentIntentRequest {
    @NotNull private Long paymentId;
}
