package esprit.com.clubhub.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Service
public class EmailService {

    @Autowired
    private GmailService gmailService;

    public void sendHtml(String to, String subject, String htmlBody) {
        try {
            gmailService.sendEmail(to, subject, htmlBody);
            System.out.println("✅ Email envoyé à " + to);
        } catch (Exception e) {
            System.err.println("❌ Erreur envoi email: " + e.getMessage());
        }
    }
}
