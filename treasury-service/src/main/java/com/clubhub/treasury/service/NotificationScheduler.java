package com.clubhub.treasury.service;

import com.clubhub.treasury.entity.Payment;
import com.clubhub.treasury.entity.Payment.PaymentStatus;
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

    /**
     * Every day at 08:00 — mark overdue payments as LATE
     */
    @Scheduled(cron = "0 0 8 * * *")
    public void markOverduePayments() {
        int count = paymentService.markOverdueAsLate();
        log.info("[Scheduler] Marked {} payments as LATE", count);
    }

    /**
     * Every day at 09:00 — send reminders J-7, J-3, J-0
     */
    @Scheduled(cron = "0 0 9 * * *")
    public void sendPaymentReminders() {
        LocalDate today = LocalDate.now();
        int[] daysAhead = {7, 3, 0};

        for (int days : daysAhead) {
            LocalDate targetDate = today.plusDays(days);
            List<Payment> due = paymentRepository.findByStatusAndDueDateBefore(
                    PaymentStatus.PENDING, targetDate.plusDays(1));

            due.stream()
                .filter(p -> p.getDueDate().equals(targetDate))
                .forEach(p -> sendReminder(p, days));
        }
    }

    private void sendReminder(Payment payment, int daysLeft) {
        // TODO: integrate with notification-service or email
        String msg = daysLeft == 0
                ? "Rappel : votre cotisation de " + payment.getAmount() + " TND est due aujourd'hui."
                : "Rappel : votre cotisation de " + payment.getAmount() + " TND est due dans " + daysLeft + " jour(s).";
        log.info("[Reminder J-{}] Member {} — {}", daysLeft, payment.getMemberId(), msg);
        // Future: notificationService.send(payment.getMemberId(), msg);
    }
}
