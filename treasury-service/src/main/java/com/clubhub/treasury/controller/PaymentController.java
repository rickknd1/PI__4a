package com.clubhub.treasury.controller;

import com.clubhub.treasury.entity.Payment;
import com.clubhub.treasury.entity.Payment.PaymentStatus;
import com.clubhub.treasury.entity.User;
import com.clubhub.treasury.security.CurrentUser;
import com.clubhub.treasury.security.Roles;
import com.clubhub.treasury.service.NotificationService;
import com.clubhub.treasury.service.PaymentService;
import com.clubhub.treasury.service.ReceiptService;
import com.clubhub.treasury.service.UserContextService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@RestController
@RequestMapping("/api/v1/treasury/{clubId}/payments")
@RequiredArgsConstructor
@Tag(name = "Payments", description = "Gestion des paiements et statuts")
public class PaymentController {

    private final PaymentService paymentService;
    private final ReceiptService receiptService;
    private final NotificationService notificationService;
    private final UserContextService userContextService;

    @GetMapping
    @Operation(summary = "Lister tous les paiements du club")
    @PreAuthorize(Roles.READ_REPORTS)
    public ResponseEntity<List<Map<String, Object>>> getAll(
            @PathVariable String clubId,
            @RequestParam(required = false) PaymentStatus status) {
        List<Payment> payments = status != null
                ? paymentService.getByClubAndStatus(clubId, status)
                : paymentService.getByClub(clubId);
        return ResponseEntity.ok(enrichWithNames(payments));
    }

    @GetMapping("/member/{memberId}")
    @Operation(summary = "Paiements d'un membre — un membre ne voit que les siens")
    // MEMBRE_SIMPLE / MEMBRE / COMMITTEE_MEMBER / MEMBER : roles non-bureau, le user ne peut voir
    // que ses propres paiements (#memberId == son userId du JWT). Bureau (TRESORIER/PRESIDENT/...)
    // voit tout. Avant: COMMITTEE_MEMBER recevait 403 (role manquant dans la whitelist).
    @PreAuthorize("hasAnyRole('TRESORIER','PRESIDENT','VICE_PRESIDENT','SECRETAIRE_GENERALE','RH') "
                + "or ((hasAnyRole('MEMBRE_SIMPLE','MEMBRE','COMMITTEE_MEMBER','MEMBER')) "
                + "    and #memberId == authentication.details)")
    public ResponseEntity<List<Map<String, Object>>> getByMember(
            @PathVariable String clubId,
            @PathVariable String memberId) {
        return ResponseEntity.ok(enrichWithNames(paymentService.getByMember(memberId, clubId)));
    }

    @PatchMapping("/{paymentId}/request-cash")
    @Operation(summary = "Demande de paiement en especes — le tresorier devra valider")
    @PreAuthorize(Roles.AUTHENTICATED)
    public ResponseEntity<Payment> requestCash(@PathVariable String clubId, @PathVariable String paymentId) {
        Payment payment = paymentService.getOrThrow(paymentId);
        if (payment.getStatus() == Payment.PaymentStatus.PAID) {
            return ResponseEntity.badRequest().build();
        }
        payment.setStatus(Payment.PaymentStatus.PENDING_CASH);
        payment.setUpdatedAt(java.time.LocalDateTime.now());
        // Save via repository directly since PaymentService doesn't have this method
        return ResponseEntity.ok(paymentService.save(payment));
    }

    /** Enrichit chaque paiement avec memberName resolu depuis la base users */
    private List<Map<String, Object>> enrichWithNames(List<Payment> payments) {
        // Collecter tous les memberIds uniques
        Set<String> memberIds = payments.stream().map(Payment::getMemberId).filter(Objects::nonNull).collect(Collectors.toSet());
        // Resoudre les noms
        Map<String, String> nameMap = new HashMap<>();
        for (String mid : memberIds) {
            try {
                User u = userContextService.getUser(mid);
                nameMap.put(mid, u.getFirstName() + " " + u.getLastName());
            } catch (Exception e) {
                nameMap.put(mid, "Membre");
            }
        }
        // Construire la reponse enrichie
        return payments.stream().map(p -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", p.getId());
            m.put("memberId", p.getMemberId());
            m.put("memberName", nameMap.getOrDefault(p.getMemberId(), "Membre"));
            m.put("clubId", p.getClubId());
            m.put("cotisationRuleId", p.getCotisationRuleId());
            m.put("amount", p.getAmount());
            m.put("status", p.getStatus());
            m.put("dueDate", p.getDueDate());
            m.put("paidAt", p.getPaidAt());
            m.put("stripePaymentIntentId", p.getStripePaymentIntentId());
            m.put("stripeReceiptUrl", p.getStripeReceiptUrl());
            m.put("installmentNumber", p.getInstallmentNumber());
            m.put("totalInstallments", p.getTotalInstallments());
            m.put("createdAt", p.getCreatedAt());
            m.put("updatedAt", p.getUpdatedAt());
            return m;
        }).collect(Collectors.toList());
    }

    @GetMapping("/{paymentId}")
    @Operation(summary = "Détail d'un paiement")
    @PreAuthorize(Roles.AUTHENTICATED)
    public ResponseEntity<Payment> getOne(@PathVariable String clubId, @PathVariable String paymentId) {
        return ResponseEntity.ok(paymentService.getOrThrow(paymentId));
    }

    @PatchMapping("/{paymentId}/confirm")
    @Operation(summary = "Confirmer un paiement + generer recu PDF + envoyer email (tresorier ou membre proprietaire)")
    @PreAuthorize(Roles.AUTHENTICATED)
    public ResponseEntity<Payment> confirm(
            @PathVariable String clubId,
            @PathVariable String paymentId,
            @RequestBody Map<String, String> body,
            @RequestHeader(value = "X-Actor-Id", defaultValue = "1") String actorId,
            @RequestHeader(value = "X-Actor-Email", defaultValue = "dev@clubhub.tn") String actorEmail) {

        // Recupere l'email reel du membre connecte (JWT) — pas la base locale
        String callerEmail = CurrentUser.email();
        String callerId = CurrentUser.userId();
        String memberName = body.getOrDefault("memberName", "Membre");
        String clubName = body.getOrDefault("clubName", "Club ClubHub");

        // 1. Marque le paiement comme PAID en BDD + audit log
        Payment paid = paymentService.confirmPayment(
                paymentId,
                body.get("stripeIntentId"),
                body.get("receiptUrl"),
                callerId != null ? callerId : actorId,
                callerEmail != null ? callerEmail : actorEmail);

        // 2. Essaie de recuperer le nom du membre dans la base locale (sinon utilise le body)
        try {
            User member = userContextService.getUser(paid.getMemberId());
            memberName = member.getFirstName() + " " + member.getLastName();
        } catch (Exception e) {
            log.info("Membre {} pas dans base locale, utilise memberName du body: {}", paid.getMemberId(), memberName);
        }

        // 3. Genere le recu PDF
        byte[] receiptPdf = null;
        try {
            receiptPdf = receiptService.generatePdfBytes(paymentId, memberName, clubName);
            log.info("Recu PDF genere pour payment {} ({} bytes)", paymentId, receiptPdf.length);
        } catch (Exception e) {
            log.warn("Echec generation recu PDF pour {} : {}", paymentId, e.getMessage());
        }

        // 4. Envoie email directement a l'adresse reelle du membre (pas via recipientId lookup)
        try {
            String recipientEmail = callerEmail != null ? callerEmail : "unknown@clubhub.tn";
            if (receiptPdf != null) {
                notificationService.sendDirectEmailWithPdf(
                        recipientEmail,
                        "Paiement confirme - Recu joint",
                        "Votre paiement de " + paid.getAmount().toPlainString() + " TND a ete confirme.\nVotre recu est en piece jointe.",
                        receiptPdf, "recu-paiement.pdf");
                log.info("Email + recu envoye a {}", recipientEmail);
            } else {
                notificationService.sendDirectEmail(
                        recipientEmail,
                        "Paiement confirme",
                        "Votre paiement de " + paid.getAmount().toPlainString() + " EUR a ete confirme. Merci !");
            }
        } catch (Exception e) {
            log.warn("Echec envoi email pour payment {} : {}", paymentId, e.getMessage());
        }

        return ResponseEntity.ok(paid);
    }

    @PatchMapping("/{paymentId}/refund")
    @Operation(summary = "Marquer un paiement comme remboursé")
    @PreAuthorize(Roles.TRESORIER_ONLY)
    public ResponseEntity<Payment> refund(
            @PathVariable String clubId,
            @PathVariable String paymentId,
            @RequestHeader(value = "X-Actor-Id", defaultValue = "1") String actorId,
            @RequestHeader(value = "X-Actor-Email", defaultValue = "dev@clubhub.tn") String actorEmail) {
        return ResponseEntity.ok(paymentService.markRefunded(paymentId, actorId, actorEmail));
    }

    @PatchMapping("/{paymentId}/exempt")
    @Operation(summary = "Exempter un membre de paiement")
    @PreAuthorize(Roles.TRESORIER_ONLY)
    public ResponseEntity<Payment> exempt(
            @PathVariable String clubId,
            @PathVariable String paymentId,
            @RequestHeader(value = "X-Actor-Id", defaultValue = "1") String actorId,
            @RequestHeader(value = "X-Actor-Email", defaultValue = "dev@clubhub.tn") String actorEmail) {
        return ResponseEntity.ok(paymentService.markExempt(paymentId, actorId, actorEmail));
    }
}
