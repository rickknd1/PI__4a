package tn.esprit.virtual_event_management.service;

import com.sendgrid.Method;
import com.sendgrid.Request;
import com.sendgrid.SendGrid;
import com.sendgrid.helpers.mail.Mail;
import com.sendgrid.helpers.mail.objects.Content;
import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;
import tn.esprit.virtual_event_management.entity.Email;
import tn.esprit.virtual_event_management.entity.User;
import tn.esprit.virtual_event_management.repository.EmailRepository;
import tn.esprit.virtual_event_management.repository.UserRepository;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class EmailService {

    private final JavaMailSender mailSender;

    public String personalize(String template, Map<String, String> data) {
        String result = template;
        for (Map.Entry<String, String> entry : data.entrySet()) {
            String value = entry.getValue() == null ? "" : entry.getValue();
            result = result.replace("{{" + entry.getKey() + "}}", value);
        }
        return result;
    }

    public void sendHtmlEmail(String to, String subject, String htmlContent) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

            helper.setFrom("amenibelkir@gmail.com"); // doit être autorisé par Brevo
            helper.setTo(to);
            helper.setSubject(subject);
            helper.setText(htmlContent, true);

            mailSender.send(message);
            System.out.println("✅ Email envoyé à : " + to);
        } catch (Exception e) {
            System.err.println("❌ Erreur email: " + e.getMessage());
            throw new RuntimeException("Erreur lors de l'envoi de l'email : " + e.getMessage(), e);
        }
    }

    public void sendRegistrationConfirmation(String to, String userName,
                                             String eventTitle, String eventDate,
                                             String meetingLink) {
        Map<String, String> data = new HashMap<>();
        data.put("userName", userName);
        data.put("eventTitle", eventTitle);
        data.put("eventDate", eventDate);
        data.put("meetingLink", meetingLink);

        String template = """
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;
                        padding: 24px; border: 1px solid #e0e0e0; border-radius: 12px;">
              <h2 style="color: #4A90E2;">🎉 Inscription confirmée !</h2>
              <p>Bonjour <strong>{{userName}}</strong>,</p>
              <p>Vous êtes inscrit(e) à l'événement :</p>

              <div style="background: #f5f7ff; padding: 16px; border-radius: 8px; margin: 16px 0;">
                <h3 style="margin: 0; color: #333;">{{eventTitle}}</h3>
                <p style="margin: 6px 0; color: #666;">📅 {{eventDate}}</p>
              </div>

              <a href="{{meetingLink}}"
                 style="display: inline-block; background: #4A90E2; color: white;
                        padding: 12px 24px; border-radius: 6px; text-decoration: none;">
                Rejoindre l'événement
              </a>

              <p style="margin-top: 20px; color: #888; font-size: 12px;">
                Un rappel vous sera envoyé 5 minutes avant le début.
              </p>
            </div>
        """;

        sendHtmlEmail(to, "✅ Inscription : " + eventTitle, personalize(template, data));
    }

    public void sendEventReminder(String to, String userName,
                                  String eventTitle, String eventDate,
                                  String meetingLink) {
        Map<String, String> data = new HashMap<>();
        data.put("userName", userName);
        data.put("eventTitle", eventTitle);
        data.put("eventDate", eventDate);
        data.put("meetingLink", meetingLink);

        String template = """
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;
                        padding: 24px; border: 2px solid #FF9800; border-radius: 12px;">
              <h2 style="color: #FF9800;">⏰ Votre événement commence dans 5 minutes !</h2>
              <p>Bonjour <strong>{{userName}}</strong>,</p>
              <p>L'événement <strong>{{eventTitle}}</strong> démarre très bientôt.</p>

              <div style="background: #FFF3E0; padding: 16px; border-radius: 8px; margin: 16px 0;">
                <h3 style="margin: 0; color: #E65100;">{{eventTitle}}</h3>
                <p style="margin: 6px 0; color: #BF360C;">📅 {{eventDate}}</p>
              </div>

              <a href="{{meetingLink}}"
                 style="display: inline-block; background: #FF9800; color: white;
                        padding: 12px 24px; border-radius: 6px; text-decoration: none;">
                🚀 Rejoindre maintenant
              </a>
            </div>
        """;

        sendHtmlEmail(to, "⏰ Rappel : " + eventTitle + " dans 5 min !", personalize(template, data));
    }
}
