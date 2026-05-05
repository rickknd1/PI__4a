package com.clubhub.treasury.service;

import com.clubhub.treasury.entity.Payment;
import com.clubhub.treasury.exception.TreasuryException;
import com.stripe.Stripe;
import com.stripe.exception.StripeException;
import com.stripe.model.PaymentIntent;
import com.stripe.model.Refund;
import com.stripe.model.checkout.Session;
import com.stripe.param.PaymentIntentCreateParams;
import com.stripe.param.RefundCreateParams;
import com.stripe.param.checkout.SessionCreateParams;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.Map;

@Service
public class StripeService {

    private static final Logger log = LoggerFactory.getLogger(StripeService.class);

    @Value("${stripe.secret-key:sk_test_placeholder}")
    private String secretKey;

    @Value("${stripe.currency:tnd}")
    private String currency;

    // Compte Stripe FR ne supporte pas TND : on convertit TND -> EUR pour le checkout.
    // Taux fixe pour la demo (1 EUR ~= 3.3 TND => 1 TND ~= 0.303 EUR).
    // Si currency=tnd la conversion est neutre (1.0).
    @Value("${stripe.tnd-to-eur-rate:0.303}")
    private double tndToEurRate;

    @PostConstruct
    public void init() {
        Stripe.apiKey = secretKey;
    }

    public boolean isAvailable() {
        return secretKey != null && secretKey.startsWith("sk_") && !secretKey.contains("placeholder");
    }

    /**
     * Convertit le montant TND vers la devise envoyee a Stripe.
     * Si la devise cible est EUR, on applique le taux. Sinon (tnd, usd, etc.) on laisse tel quel.
     * Renvoie le montant en plus petite unite (cents pour EUR, millimes pour TND).
     */
    private long toStripeMinorUnits(java.math.BigDecimal amountTnd) {
        java.math.BigDecimal target = amountTnd;
        if ("eur".equalsIgnoreCase(currency)) {
            target = amountTnd.multiply(java.math.BigDecimal.valueOf(tndToEurRate))
                              .setScale(2, java.math.RoundingMode.HALF_UP);
        }
        // EUR/USD/etc utilisent 2 decimales (cents)
        return target.movePointRight(2).longValue();
    }

    public Map<String, String> createPaymentIntent(Payment payment, String memberName) {
        if (!isAvailable()) {
            return Map.of(
                    "clientSecret", "mock_secret_" + payment.getId(),
                    "paymentIntentId", "mock_pi_" + payment.getId(),
                    "mode", "MOCK"
            );
        }

        try {
            // Conversion TND -> EUR si compte Stripe FR (cf toStripeMinorUnits)
            long amountInMinorUnits = toStripeMinorUnits(payment.getAmount());

            PaymentIntentCreateParams params = PaymentIntentCreateParams.builder()
                    .setAmount(amountInMinorUnits)
                    .setCurrency(currency)
                    .setDescription("ClubHub - Cotisation #" + payment.getId() + " (" + payment.getAmount() + " TND)")
                    .putMetadata("payment_id", String.valueOf(payment.getId()))
                    .putMetadata("club_id", String.valueOf(payment.getClubId()))
                    .putMetadata("member_name", memberName)
                    .putMetadata("original_amount_tnd", payment.getAmount().toPlainString())
                    .setAutomaticPaymentMethods(
                        PaymentIntentCreateParams.AutomaticPaymentMethods.builder()
                            .setEnabled(true)
                            .build()
                    )
                    .build();

            PaymentIntent intent = PaymentIntent.create(params);

            return Map.of(
                    "clientSecret", intent.getClientSecret(),
                    "paymentIntentId", intent.getId(),
                    "mode", "LIVE"
            );
        } catch (StripeException e) {
            log.error("Stripe PaymentIntent creation failed: {}", e.getMessage());
            throw new TreasuryException("Erreur Stripe: " + e.getMessage(), 502);
        }
    }

    /**
     * Cree une Stripe Checkout Session — redirige le membre vers le portail Stripe.
     * Apres paiement, Stripe redirige vers successUrl avec ?session_id={CHECKOUT_SESSION_ID}
     */
    public Map<String, String> createCheckoutSession(Payment payment, String memberName,
                                                      String successUrl, String cancelUrl) {
        if (!isAvailable()) {
            return Map.of("url", successUrl + "?mock=true&paymentId=" + payment.getId(), "mode", "MOCK");
        }

        try {
            // Conversion TND -> EUR si compte Stripe FR (cf toStripeMinorUnits)
            long amountInCents = toStripeMinorUnits(payment.getAmount());

            SessionCreateParams params = SessionCreateParams.builder()
                    .setMode(SessionCreateParams.Mode.PAYMENT)
                    .setSuccessUrl(successUrl + "?session_id={CHECKOUT_SESSION_ID}&paymentId=" + payment.getId())
                    .setCancelUrl(cancelUrl)
                    .addLineItem(SessionCreateParams.LineItem.builder()
                            .setQuantity(1L)
                            .setPriceData(SessionCreateParams.LineItem.PriceData.builder()
                                    .setCurrency(currency)
                                    .setUnitAmount(amountInCents)
                                    .setProductData(SessionCreateParams.LineItem.PriceData.ProductData.builder()
                                            .setName("Cotisation ClubHub (" + payment.getAmount() + " TND)")
                                            .setDescription("Paiement cotisation - " + memberName)
                                            .build())
                                    .build())
                            .build())
                    .putMetadata("payment_id", payment.getId())
                    .putMetadata("club_id", String.valueOf(payment.getClubId()))
                    .putMetadata("member_name", memberName)
                    .putMetadata("original_amount_tnd", payment.getAmount().toPlainString())
                    .build();

            Session session = Session.create(params);

            return Map.of(
                    "sessionId", session.getId(),
                    "url", session.getUrl(),
                    "mode", "LIVE"
            );
        } catch (StripeException e) {
            log.error("Stripe Checkout Session creation failed: {}", e.getMessage());
            throw new TreasuryException("Erreur Stripe Checkout: " + e.getMessage(), 502);
        }
    }

    /**
     * Retrieve the PaymentIntent ID from a Checkout Session.
     * After Stripe Checkout redirects back with session_id, the frontend calls this
     * to get the real pi_xxx ID needed by confirmPayment.
     */
    public Map<String, String> getPaymentIntentFromSession(String sessionId) {
        if (!isAvailable()) {
            return Map.of("paymentIntentId", "mock_pi_" + sessionId, "status", "complete");
        }

        try {
            Session session = Session.retrieve(sessionId);
            return Map.of(
                    "paymentIntentId", session.getPaymentIntent() != null ? session.getPaymentIntent() : "",
                    "status", session.getPaymentStatus() != null ? session.getPaymentStatus() : "unknown"
            );
        } catch (StripeException e) {
            log.error("Failed to retrieve Checkout Session {}: {}", sessionId, e.getMessage());
            throw new TreasuryException("Erreur Stripe Session: " + e.getMessage(), 502);
        }
    }

    public Refund createRefund(String paymentIntentId) {
        if (!isAvailable()) {
            log.info("Stripe mock refund for intent: {}", paymentIntentId);
            return null;
        }

        try {
            RefundCreateParams params = RefundCreateParams.builder()
                    .setPaymentIntent(paymentIntentId)
                    .build();
            return Refund.create(params);
        } catch (StripeException e) {
            log.error("Stripe refund failed: {}", e.getMessage());
            throw new TreasuryException("Erreur remboursement Stripe: " + e.getMessage(), 502);
        }
    }
}
