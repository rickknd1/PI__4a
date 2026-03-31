package com.clubhub.treasury.controller;

import com.clubhub.treasury.entity.Payment;
import com.clubhub.treasury.entity.Payment.PaymentStatus;
import com.clubhub.treasury.service.PaymentService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/treasury/{clubId}/payments")
@RequiredArgsConstructor
@Tag(name = "Payments", description = "Gestion des paiements et statuts")
public class PaymentController {

    private final PaymentService paymentService;

    @GetMapping
    @Operation(summary = "Lister tous les paiements du club")
    public ResponseEntity<List<Payment>> getAll(
            @PathVariable Long clubId,
            @RequestParam(required = false) PaymentStatus status) {
        if (status != null) return ResponseEntity.ok(paymentService.getByClubAndStatus(clubId, status));
        return ResponseEntity.ok(paymentService.getByClub(clubId));
    }

    @GetMapping("/member/{memberId}")
    @Operation(summary = "Paiements d'un membre")
    public ResponseEntity<List<Payment>> getByMember(
            @PathVariable Long clubId,
            @PathVariable Long memberId) {
        return ResponseEntity.ok(paymentService.getByMember(memberId, clubId));
    }

    @GetMapping("/{paymentId}")
    @Operation(summary = "Détail d'un paiement")
    public ResponseEntity<Payment> getOne(@PathVariable Long clubId, @PathVariable Long paymentId) {
        return ResponseEntity.ok(paymentService.getOrThrow(paymentId));
    }

    @PatchMapping("/{paymentId}/confirm")
    @Operation(summary = "Confirmer un paiement (appelé par webhook Stripe)")
    public ResponseEntity<Payment> confirm(
            @PathVariable Long clubId,
            @PathVariable Long paymentId,
            @RequestBody Map<String, String> body,
            @RequestHeader(value = "X-Actor-Id", defaultValue = "1") Long actorId,
            @RequestHeader(value = "X-Actor-Email", defaultValue = "dev@clubhub.tn") String actorEmail) {
        return ResponseEntity.ok(paymentService.confirmPayment(
                paymentId,
                body.get("stripeIntentId"),
                body.get("receiptUrl"),
                actorId, actorEmail));
    }

    @PatchMapping("/{paymentId}/refund")
    @Operation(summary = "Marquer un paiement comme remboursé")
    public ResponseEntity<Payment> refund(
            @PathVariable Long clubId,
            @PathVariable Long paymentId,
            @RequestHeader(value = "X-Actor-Id", defaultValue = "1") Long actorId,
            @RequestHeader(value = "X-Actor-Email", defaultValue = "dev@clubhub.tn") String actorEmail) {
        return ResponseEntity.ok(paymentService.markRefunded(paymentId, actorId, actorEmail));
    }

    @PatchMapping("/{paymentId}/exempt")
    @Operation(summary = "Exempter un membre de paiement")
    public ResponseEntity<Payment> exempt(
            @PathVariable Long clubId,
            @PathVariable Long paymentId,
            @RequestHeader(value = "X-Actor-Id", defaultValue = "1") Long actorId,
            @RequestHeader(value = "X-Actor-Email", defaultValue = "dev@clubhub.tn") String actorEmail) {
        return ResponseEntity.ok(paymentService.markExempt(paymentId, actorId, actorEmail));
    }
}
