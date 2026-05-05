package com.clubhub.treasury.controller;

import com.clubhub.treasury.security.Roles;
import com.clubhub.treasury.service.PaymentService;
import com.clubhub.treasury.service.StripeService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/treasury/{clubId}/stripe")
@PreAuthorize(Roles.AUTHENTICATED)
public class StripeController {

    private final StripeService stripeService;
    private final PaymentService paymentService;

    public StripeController(StripeService stripeService, PaymentService paymentService) {
        this.stripeService = stripeService;
        this.paymentService = paymentService;
    }

    @PostMapping("/create-payment-intent/{paymentId}")
    public ResponseEntity<Map<String, String>> createPaymentIntent(
            @PathVariable Long clubId,
            @PathVariable String paymentId,
            @RequestParam(defaultValue = "Membre") String memberName) {
        var payment = paymentService.getOrThrow(paymentId);
        return ResponseEntity.ok(stripeService.createPaymentIntent(payment, memberName));
    }

    @PostMapping("/checkout-session/{paymentId}")
    public ResponseEntity<Map<String, String>> createCheckoutSession(
            @PathVariable Long clubId,
            @PathVariable String paymentId,
            @RequestParam(defaultValue = "Membre") String memberName,
            @RequestParam(defaultValue = "http://localhost:4200/treasury/payer-cotisation") String successUrl,
            @RequestParam(defaultValue = "http://localhost:4200/treasury/payer-cotisation") String cancelUrl) {
        var payment = paymentService.getOrThrow(paymentId);
        return ResponseEntity.ok(stripeService.createCheckoutSession(payment, memberName, successUrl, cancelUrl));
    }

    @GetMapping("/session/{sessionId}")
    public ResponseEntity<Map<String, String>> getSession(
            @PathVariable Long clubId,
            @PathVariable String sessionId) {
        return ResponseEntity.ok(stripeService.getPaymentIntentFromSession(sessionId));
    }

    @GetMapping("/status")
    public ResponseEntity<Map<String, Object>> status(@PathVariable Long clubId) {
        return ResponseEntity.ok(Map.of(
                "available", stripeService.isAvailable(),
                "currency", "EUR",
                "mode", stripeService.isAvailable() ? "LIVE" : "MOCK"
        ));
    }
}
