package com.clubhub.treasury.service;

import com.clubhub.treasury.entity.Payment;
import com.clubhub.treasury.entity.Payment.PaymentStatus;
import com.clubhub.treasury.exception.TreasuryException;
import com.clubhub.treasury.repository.PaymentRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class PaymentService {

    private final PaymentRepository paymentRepository;
    private final AuditService auditService;

    public List<Payment> getByClub(Long clubId) {
        return paymentRepository.findByClubIdOrderByCreatedAtDesc(clubId);
    }

    public List<Payment> getByClubAndStatus(Long clubId, PaymentStatus status) {
        return paymentRepository.findByClubIdAndStatus(clubId, status);
    }

    public List<Payment> getByMember(Long memberId, Long clubId) {
        return paymentRepository.findByMemberIdAndClubId(memberId, clubId);
    }

    public Payment getOrThrow(Long id) {
        return paymentRepository.findById(id)
                .orElseThrow(() -> new TreasuryException("Payment not found: " + id, 404));
    }

    /**
     * Called by Stripe webhook after successful payment
     */
    @Transactional
    public Payment confirmPayment(Long paymentId, String stripeIntentId, String receiptUrl,
                                   Long actorId, String actorEmail) {
        Payment payment = getOrThrow(paymentId);
        if (payment.getStatus() == PaymentStatus.PAID) {
            log.warn("Payment {} already marked as PAID — idempotent skip", paymentId);
            return payment;
        }
        String before = payment.getStatus().name();
        payment.setStatus(PaymentStatus.PAID);
        payment.setPaidAt(LocalDateTime.now());
        payment.setStripePaymentIntentId(stripeIntentId);
        payment.setStripeReceiptUrl(receiptUrl);
        Payment saved = paymentRepository.save(payment);
        auditService.log(actorId, actorEmail, payment.getClubId(),
                "PAYMENT_UPDATED", "Payment", paymentId, before, "PAID", payment.getAmount());
        return saved;
    }

    /**
     * Mark payment as refunded after Stripe processes it
     */
    @Transactional
    public Payment markRefunded(Long paymentId, Long actorId, String actorEmail) {
        Payment payment = getOrThrow(paymentId);
        if (payment.getStatus() != PaymentStatus.PAID) {
            throw new TreasuryException("Only PAID payments can be refunded", 400);
        }
        payment.setStatus(PaymentStatus.REFUNDED);
        Payment saved = paymentRepository.save(payment);
        auditService.log(actorId, actorEmail, payment.getClubId(),
                "PAYMENT_REFUNDED", "Payment", paymentId, "PAID", "REFUNDED", payment.getAmount());
        return saved;
    }

    /**
     * Scheduled: mark PENDING payments past due date as LATE
     */
    @Transactional
    public int markOverdueAsLate() {
        List<Payment> overdue = paymentRepository.findByStatusAndDueDateBefore(
                PaymentStatus.PENDING, LocalDate.now());
        overdue.forEach(p -> p.setStatus(PaymentStatus.LATE));
        paymentRepository.saveAll(overdue);
        log.info("Marked {} payments as LATE", overdue.size());
        return overdue.size();
    }

    /**
     * Mark a payment as exempt (e.g., scholarship)
     */
    @Transactional
    public Payment markExempt(Long paymentId, Long actorId, String actorEmail) {
        Payment payment = getOrThrow(paymentId);
        String before = payment.getStatus().name();
        payment.setStatus(PaymentStatus.EXEMPT);
        Payment saved = paymentRepository.save(payment);
        auditService.log(actorId, actorEmail, payment.getClubId(),
                "PAYMENT_UPDATED", "Payment", paymentId, before, "EXEMPT", payment.getAmount());
        return saved;
    }
}
