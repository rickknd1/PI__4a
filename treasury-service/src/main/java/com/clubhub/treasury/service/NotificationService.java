package com.clubhub.treasury.service;

import com.clubhub.treasury.entity.Notification;
import com.clubhub.treasury.entity.Notification.NotificationType;
import com.clubhub.treasury.entity.User;
import com.clubhub.treasury.repository.NotificationRepository;
import com.clubhub.treasury.repository.UserRepository;
import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class NotificationService {

    private static final Logger log = LoggerFactory.getLogger(NotificationService.class);

    private final NotificationRepository notificationRepository;
    private final UserRepository userRepository;
    private final JavaMailSender mailSender;

    @Value("${spring.mail.username:clubhub-noreply@localhost}")
    private String fromEmail;

    @Value("${notification.email-enabled:false}")
    private boolean emailEnabled;

    // === CRUD Notifications ===

    public List<Notification> getByUser(String userId) {
        return notificationRepository.findByRecipientIdOrderByCreatedAtDesc(userId);
    }

    public List<Notification> getByClub(Long clubId) {
        return notificationRepository.findByClubIdOrderByCreatedAtDesc(clubId);
    }

    public List<Notification> getUnread(String userId) {
        return notificationRepository.findByRecipientIdAndReadFalseOrderByCreatedAtDesc(userId);
    }

    public long countUnread(String userId) {
        return notificationRepository.countByRecipientIdAndReadFalse(userId);
    }

    @Transactional
    public void markAsRead(String notificationId) {
        notificationRepository.findById(notificationId).ifPresent(n -> {
            n.setRead(true);
            notificationRepository.save(n);
        });
    }

    @Transactional
    public void markAllAsRead(String userId) {
        notificationRepository.findByRecipientIdAndReadFalseOrderByCreatedAtDesc(userId)
                .forEach(n -> { n.setRead(true); notificationRepository.save(n); });
    }

    // === Envoi de notifications ===

    @Transactional
    public Notification notify(Long clubId, String recipientId, NotificationType type, String title, String message) {
        return notifyWithAttachment(clubId, recipientId, type, title, message, null, null);
    }

    @Transactional
    public Notification notifyWithAttachment(Long clubId, String recipientId, NotificationType type,
                                              String title, String message,
                                              byte[] pdfAttachment, String pdfFilename) {
        User user = userRepository.findById(recipientId).orElse(null);
        String email = user != null ? user.getEmail() : "unknown@clubhub.tn";

        Notification notif = Notification.builder()
                .clubId(clubId)
                .recipientId(recipientId)
                .recipientEmail(email)
                .type(type)
                .title(title)
                .message(message)
                .build();

        notif = notificationRepository.save(notif);

        if (emailEnabled) {
            try {
                if (pdfAttachment != null && pdfFilename != null) {
                    sendEmailWithPdf(email, title, message, pdfAttachment, pdfFilename);
                } else {
                    sendEmail(email, title, message);
                }
                notif.setEmailSent(true);
                notificationRepository.save(notif);
            } catch (Exception e) {
                log.warn("Email non envoye a {}: {}", email, e.getMessage());
            }
        } else {
            log.info("[NOTIFICATION] {} -> {} : {} - {}", type, email, title, message);
        }

        return notif;
    }

    // === Notifications metier ===

    public void notifyPaymentDue(Long clubId, String memberId, String amount, String dueDate) {
        notify(clubId, memberId, NotificationType.PAYMENT_DUE,
                "Cotisation a payer",
                "Vous avez une cotisation de " + amount + " TND a payer avant le " + dueDate + ".");
    }

    public void notifyPaymentConfirmed(Long clubId, String memberId, String amount) {
        notify(clubId, memberId, NotificationType.PAYMENT_CONFIRMED,
                "Paiement confirme",
                "Votre paiement de " + amount + " TND a ete confirme. Merci !");
    }

    public void notifyPaymentConfirmedWithReceipt(Long clubId, String memberId, String amount, byte[] receiptPdf) {
        notifyWithAttachment(clubId, memberId, NotificationType.PAYMENT_CONFIRMED,
                "Paiement confirme - Recu joint",
                "Votre paiement de " + amount + " TND a ete confirme.\nVotre recu est en piece jointe.",
                receiptPdf, "recu-paiement.pdf");
    }

    public void notifyPaymentLate(Long clubId, String memberId, String amount) {
        notify(clubId, memberId, NotificationType.PAYMENT_LATE,
                "Paiement en retard",
                "Votre paiement de " + amount + " TND est en retard. Veuillez regulariser rapidement.");
    }

    public void notifyExpenseSubmitted(Long clubId, String submitterId, String title, String amount) {
        userRepository.findByClubIdAndRole(clubId, User.UserRole.TRESORIER)
                .forEach(t -> notify(clubId, t.getId(), NotificationType.EXPENSE_SUBMITTED,
                        "Nouvelle depense a valider",
                        "Depense '" + title + "' de " + amount + " TND soumise. A valider."));
    }

    public void notifyExpenseValidated(Long clubId, String submitterId, String title) {
        userRepository.findByClubIdAndRole(clubId, User.UserRole.PRESIDENT)
                .forEach(p -> notify(clubId, p.getId(), NotificationType.EXPENSE_VALIDATED,
                        "Depense a approuver",
                        "Depense '" + title + "' validee par le tresorier. En attente de votre approbation."));
    }

    public void notifyExpenseApproved(Long clubId, String submitterId, String title, String amount) {
        notify(clubId, submitterId, NotificationType.EXPENSE_APPROVED,
                "Depense approuvee",
                "Votre depense '" + title + "' de " + amount + " TND a ete approuvee.");
    }

    public void notifyExpenseApprovedWithInvoice(Long clubId, String submitterId, String title, String amount, byte[] invoicePdf) {
        notifyWithAttachment(clubId, submitterId, NotificationType.EXPENSE_APPROVED,
                "Depense approuvee - Facture jointe",
                "Votre depense '" + title + "' de " + amount + " TND a ete approuvee.\nLa facture est en piece jointe.",
                invoicePdf, "facture-depense.pdf");
    }

    public void notifyExpenseRejected(Long clubId, String submitterId, String title, String reason) {
        notify(clubId, submitterId, NotificationType.EXPENSE_REJECTED,
                "Depense rejetee",
                "Votre depense '" + title + "' a ete rejetee. Motif: " + reason);
    }

    public void notifyBudgetAlert(Long clubId, String budgetLabel, int percentage) {
        userRepository.findByClubIdAndRole(clubId, User.UserRole.PRESIDENT)
                .forEach(p -> notify(clubId, p.getId(), NotificationType.BUDGET_ALERT,
                        "Alerte budget " + percentage + "%",
                        "Le budget '" + budgetLabel + "' a atteint " + percentage + "% de consommation."));
        userRepository.findByClubIdAndRole(clubId, User.UserRole.TRESORIER)
                .forEach(t -> notify(clubId, t.getId(), NotificationType.BUDGET_ALERT,
                        "Alerte budget " + percentage + "%",
                        "Le budget '" + budgetLabel + "' a atteint " + percentage + "% de consommation."));
    }

    public void notifyReportGenerated(Long clubId, String recipientId, String reportName, byte[] reportPdf) {
        notifyWithAttachment(clubId, recipientId, NotificationType.REPORT_GENERATED,
                "Bilan financier genere",
                "Le bilan '" + reportName + "' a ete genere. Consultez le document en piece jointe.",
                reportPdf, reportName + ".pdf");
    }

    // === Email direct (vers adresse reelle, sans lookup en BDD) ===

    public void sendDirectEmail(String to, String subject, String body) {
        sendEmail(to, subject, body);
    }

    public void sendDirectEmailWithPdf(String to, String subject, String body, byte[] pdf, String filename) {
        sendEmailWithPdf(to, subject, body, pdf, filename);
    }

    // === Email ===

    private void sendEmail(String to, String subject, String body) {
        try {
            MimeMessage mime = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(mime, false, "UTF-8");
            helper.setFrom(fromEmail);
            helper.setTo(to);
            helper.setSubject("[ClubHub] " + subject);
            helper.setText(buildHtmlBody(subject, body), true);
            mailSender.send(mime);
            log.info("Email envoye a {}: {}", to, subject);
        } catch (Exception e) {
            throw new RuntimeException("Erreur envoi email: " + e.getMessage(), e);
        }
    }

    private void sendEmailWithPdf(String to, String subject, String body, byte[] pdf, String filename) {
        try {
            MimeMessage mime = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(mime, true, "UTF-8");
            helper.setFrom(fromEmail);
            helper.setTo(to);
            helper.setSubject("[ClubHub] " + subject);
            helper.setText(buildHtmlBody(subject, body), true);
            helper.addAttachment(filename, new ByteArrayResource(pdf), "application/pdf");
            mailSender.send(mime);
            log.info("Email + PDF envoye a {}: {} ({})", to, subject, filename);
        } catch (Exception e) {
            throw new RuntimeException("Erreur envoi email+PDF: " + e.getMessage(), e);
        }
    }

    private String buildHtmlBody(String title, String message) {
        return """
                <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
                  <div style="background:#3b82f6;color:white;padding:20px;border-radius:12px 12px 0 0;text-align:center">
                    <h1 style="margin:0;font-size:20px">ClubHub Treasury</h1>
                    <p style="margin:5px 0 0;opacity:0.9;font-size:13px">Module Tresorerie</p>
                  </div>
                  <div style="background:#fff;border:1px solid #e2e8f0;border-top:none;padding:25px;border-radius:0 0 12px 12px">
                    <h2 style="color:#1e293b;margin-top:0">%s</h2>
                    <p style="color:#475569;line-height:1.6;white-space:pre-line">%s</p>
                    <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0">
                    <p style="color:#94a3b8;font-size:12px;text-align:center">
                      Ce message est genere automatiquement par ClubHub Treasury.<br>
                      Ne repondez pas a cet email.
                    </p>
                  </div>
                </div>
                """.formatted(title, message);
    }
}
