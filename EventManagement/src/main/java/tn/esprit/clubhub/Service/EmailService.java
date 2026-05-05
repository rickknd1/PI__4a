package tn.esprit.clubhub.Service;

import jakarta.mail.internet.MimeMessage;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import tn.esprit.clubhub.Entity.Event;
import tn.esprit.clubhub.Entity.BorrowedItem;

@Slf4j
@Service
public class EmailService {

    @Autowired
    private JavaMailSender mailSender;

    @Autowired
    private QrCodeService qrCodeService;

    /**
     * Sender address announced in the From header. Defaults to the SMTP
     * username so replies come back to the same mailbox we authenticate
     * with (Gmail refuses messages whose From differs from the auth user
     * unless a "Send mail as" alias is configured).
     */
    @Value("${spring.mail.username:noreply@clubhub.local}")
    private String fromAddress;

    /**
     * Sends the RSVP confirmation email with the QR code embedded inline.
     *
     * Runs on the `mailExecutor` thread pool (see {@code AsyncMailConfig})
     * so the HTTP request that triggered the RSVP returns immediately —
     * a slow SMTP server can no longer block the user's browser.
     *
     * Errors are logged and then rethrown as a {@link RuntimeException}
     * so unit tests and any synchronous caller can detect the failure.
     * In the `createRsvp` flow we still wrap the call in a try/catch so a
     * dead SMTP server doesn't invalidate a valid RSVP, but the stack
     * trace is now loud enough to notice.
     */
    @Async("mailExecutor")
    public void sendRsvpConfirmation(String to, String name, Event event, String qrUrl) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

            byte[] qrImage = qrCodeService.generateQrImage(qrUrl);

            helper.setFrom(fromAddress, "ClubHub");
            helper.setTo(to);
            helper.setSubject("Your RSVP Confirmation — " + event.getTitle());
            helper.setText(buildEmailHtml(name, event), true);
            helper.addInline("qrcode", new ByteArrayResource(qrImage), "image/png");

            mailSender.send(message);
            log.info("RSVP email sent to {} for event '{}'", to, event.getTitle());
        } catch (Exception e) {
            log.error("Email failed for {} (event '{}'): {}", to, event.getTitle(), e.getMessage(), e);
            throw new RuntimeException("Failed to send RSVP email to " + to, e);
        }
    }

    @Async("mailExecutor")
    public void sendBorrowReminder(String to, BorrowedItem item, String eventName) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

            helper.setFrom(fromAddress, "ClubHub");
            helper.setTo(to);
            helper.setSubject("Reminder — Borrowed need return: " + safe(item.getItemName()));
            helper.setText(buildBorrowReminderHtml(item, eventName), true);

            mailSender.send(message);
            log.info("Borrowed-item reminder sent to {} for item '{}'", to, item.getItemName());
        } catch (Exception e) {
            log.error("Borrowed-item reminder failed for {} (item '{}'): {}", to, item.getItemName(), e.getMessage(), e);
            throw new RuntimeException("Failed to send borrowed-item reminder to " + to, e);
        }
    }

    private String buildEmailHtml(String name, Event event) {
        String location = event.getLocation() != null ? event.getLocation().getName() : "TBA";
        String date = event.getStartDate() != null ? event.getStartDate().toString() : "TBA";

        return """
            <div style="font-family:Arial,sans-serif;max-width:500px;margin:auto">
              <div style="background:#1A1A2E;padding:24px;border-radius:12px 12px 0 0;text-align:center">
                <h1 style="color:white;margin:0">ClubHub</h1>
              </div>
              <div style="padding:32px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px">
                <h2 style="color:#1A1A2E">You're confirmed! 🎉</h2>
                <p>Hi <strong>%s</strong>,</p>
                <p>Your RSVP for <strong>%s</strong> has been confirmed.</p>
                <table style="width:100%%;background:#f9fafb;border-radius:8px;padding:16px;margin:16px 0">
                  <tr><td style="color:#6b7280">Date</td><td><strong>%s</strong></td></tr>
                  <tr><td style="color:#6b7280">Location</td><td><strong>%s</strong></td></tr>
                </table>
                <p style="text-align:center;color:#6b7280;margin-top:24px">
                  Show this QR code at the entrance:
                </p>
                <div style="text-align:center;margin:16px 0">
                  <img src="cid:qrcode" width="200" height="200"
                       style="border:8px solid white;border-radius:12px;box-shadow:0 4px 12px rgba(0,0,0,0.1)"/>
                </div>
                <p style="color:#ef4444;font-size:12px;text-align:center">
                  This QR code is personal and can only be used once.
                </p>
              </div>
            </div>
        """.formatted(name, event.getTitle(), date, location);
    }

    private String buildBorrowReminderHtml(BorrowedItem item, String eventName) {
        String lenderName = safe(item.getLenderName());
        String title = safe(item.getItemName());
        String expectedReturn = item.getExpectedReturnDate() != null ? item.getExpectedReturnDate().toString() : "TBA";
        String event = safe(eventName);
        String contactPhone = safe(item.getLenderPhone());
        String notes = safe(item.getNotes());

        return """
            <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto">
              <div style="background:#1A1A2E;padding:22px;border-radius:12px 12px 0 0;text-align:center">
                <h1 style="color:white;margin:0">ClubHub</h1>
              </div>
              <div style="padding:28px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px">
                <h2 style="color:#1A1A2E;margin-top:0">Borrowed Need Reminder</h2>
                <p>Hello <strong>%s</strong>,</p>
                <p>This is a reminder regarding the borrowed need below:</p>
                <table style="width:100%%;background:#f9fafb;border-radius:8px;padding:16px;margin:14px 0">
                  <tr><td style="color:#6b7280">Need</td><td><strong>%s</strong></td></tr>
                  <tr><td style="color:#6b7280">Event</td><td><strong>%s</strong></td></tr>
                  <tr><td style="color:#6b7280">Expected return</td><td><strong>%s</strong></td></tr>
                  <tr><td style="color:#6b7280">Contact phone</td><td><strong>%s</strong></td></tr>
                </table>
                %s
                <p style="margin-top:16px;color:#6b7280;font-size:12px">
                  This email was sent automatically from ClubHub reminder workflow.
                </p>
              </div>
            </div>
        """.formatted(
                lenderName.isBlank() ? "partner" : lenderName,
                title,
                event.isBlank() ? "N/A" : event,
                expectedReturn,
                contactPhone.isBlank() ? "N/A" : contactPhone,
                notes.isBlank()
                        ? ""
                        : "<p style=\"margin-top:10px\"><strong>Notes:</strong> " + escapeHtml(notes) + "</p>"
        );
    }

    private String safe(String s) {
        return s == null ? "" : s.trim();
    }

    private String escapeHtml(String s) {
        return s
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;");
    }
}
