package tn.esprit.virtual_event_management.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import tn.esprit.virtual_event_management.entity.Email;
import tn.esprit.virtual_event_management.repository.EmailRepository;
import tn.esprit.virtual_event_management.service.EmailService;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/email")
@RequiredArgsConstructor
public class EmailController {
    private final EmailService emailService;

    @GetMapping("/test")
    public ResponseEntity<String> testEmail(@RequestParam String to) {
        emailService.sendHtmlEmail(
                to,
                "🔥 Test Email ",
                """
                <div style="font-family: Arial, sans-serif; padding: 24px;">
                    <h1 style="color:#4A90E2;">Email fonctionne !</h1>
                    <p>Brevo est bien configuré ✅</p>
                </div>
                """
        );
        return ResponseEntity.ok("Email envoyé à : " + to);
    }

    @PostMapping("/test-confirmation")
    public ResponseEntity<String> testConfirmation(@RequestBody Map<String, String> body) {
        emailService.sendRegistrationConfirmation(
                body.get("to"),
                body.get("userName"),
                body.get("eventTitle"),
                body.get("eventDate"),
                body.get("meetingLink")
        );
        return ResponseEntity.ok("Email de confirmation envoyé à : " + body.get("to"));
    }

    @PostMapping("/test-reminder")
    public ResponseEntity<String> testReminder(@RequestBody Map<String, String> body) {
        emailService.sendEventReminder(
                body.get("to"),
                body.get("userName"),
                body.get("eventTitle"),
                body.get("eventDate"),
                body.get("meetingLink")
        );
        return ResponseEntity.ok("Email de rappel envoyé à : " + body.get("to"));
    }
}
