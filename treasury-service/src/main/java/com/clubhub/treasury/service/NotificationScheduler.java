package com.clubhub.treasury.service;

import com.clubhub.treasury.entity.Budget;
import com.clubhub.treasury.entity.Payment;
import com.clubhub.treasury.entity.Payment.PaymentStatus;
import com.clubhub.treasury.repository.BudgetRepository;
import com.clubhub.treasury.repository.PaymentRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class NotificationScheduler {

    private final PaymentRepository paymentRepository;
    private final PaymentService paymentService;
    private final NotificationService notificationService;
    private final BudgetRepository budgetRepository;

    /**
     * Chaque jour a 08:00 — marquer les paiements en retard comme LATE
     * Entite: Payment (status PENDING + dueDate < today)
     */
    @Scheduled(cron = "0 0 8 * * *")
    public void markOverduePayments() {
        int count = paymentService.markOverdueAsLate();
        log.info("[Scheduler 08h00] {} paiements marques LATE", count);

        // Notifier chaque membre en retard
        paymentRepository.findByStatusAndDueDateBefore(PaymentStatus.LATE, LocalDate.now())
                .forEach(p -> notificationService.notifyPaymentLate(
                        p.getClubId(), p.getMemberId(), p.getAmount().toPlainString()));
    }

    /**
     * Chaque jour a 09:00 — rappels cotisation J-7, J-3, J-0
     * Entite: Payment (status PENDING + dueDate = today+N)
     */
    @Scheduled(cron = "0 0 9 * * *")
    public void sendPaymentReminders() {
        LocalDate today = LocalDate.now();
        int[] daysAhead = {7, 3, 0};

        for (int days : daysAhead) {
            LocalDate targetDate = today.plusDays(days);
            List<Payment> pending = paymentRepository.findByStatusAndDueDateBefore(
                    PaymentStatus.PENDING, targetDate.plusDays(1));

            pending.stream()
                    .filter(p -> p.getDueDate().equals(targetDate))
                    .forEach(p -> {
                        String label = days == 0 ? "aujourd'hui" : "dans " + days + " jour(s)";
                        notificationService.notifyPaymentDue(
                                p.getClubId(), p.getMemberId(),
                                p.getAmount().toPlainString(), targetDate.toString());
                        log.info("[Rappel J-{}] Membre {} — {} TND due {}", days, p.getMemberId(), p.getAmount(), label);
                    });
        }
    }

    /**
     * Chaque jour a 10:00 — verifier les seuils budget (50/75/90/100%)
     * Entite: Budget (consumedAmount vs totalAmount)
     */
    @Scheduled(cron = "0 0 10 * * *")
    public void checkBudgetAlerts() {
        LocalDate today = LocalDate.now();
        List<Budget> activeBudgets = budgetRepository.findAll().stream()
                .filter(b -> !today.isBefore(b.getPeriodStart()) && !today.isAfter(b.getPeriodEnd()))
                .toList();

        for (Budget b : activeBudgets) {
            int pct = b.getConsumptionPercentage();

            if (pct >= 100 && !b.isAlert100Sent()) {
                notificationService.notifyBudgetAlert(b.getClubId(), b.getLabel(), 100);
                b.setAlert100Sent(true);
                budgetRepository.save(b);
                log.info("[Budget ALERT 100%] {} — {}%", b.getLabel(), pct);
            } else if (pct >= 90 && !b.isAlert90Sent()) {
                notificationService.notifyBudgetAlert(b.getClubId(), b.getLabel(), 90);
                b.setAlert90Sent(true);
                budgetRepository.save(b);
                log.info("[Budget ALERT 90%] {} — {}%", b.getLabel(), pct);
            } else if (pct >= 75 && !b.isAlert75Sent()) {
                notificationService.notifyBudgetAlert(b.getClubId(), b.getLabel(), 75);
                b.setAlert75Sent(true);
                budgetRepository.save(b);
                log.info("[Budget ALERT 75%] {} — {}%", b.getLabel(), pct);
            } else if (pct >= 50 && !b.isAlert50Sent()) {
                notificationService.notifyBudgetAlert(b.getClubId(), b.getLabel(), 50);
                b.setAlert50Sent(true);
                budgetRepository.save(b);
                log.info("[Budget ALERT 50%] {} — {}%", b.getLabel(), pct);
            }
        }
    }
}
