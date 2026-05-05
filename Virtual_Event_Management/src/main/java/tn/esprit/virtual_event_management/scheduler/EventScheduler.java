package tn.esprit.virtual_event_management.scheduler;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import tn.esprit.virtual_event_management.entity.User;
import tn.esprit.virtual_event_management.entity.VirtualEvent;
import tn.esprit.virtual_event_management.service.EmailService;
import tn.esprit.virtual_event_management.service.IVirtualEventService;
import tn.esprit.virtual_event_management.service.PdfService;

import java.io.File;
import java.io.FileOutputStream;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;

@Component
@RequiredArgsConstructor
public class EventScheduler {

    private final IVirtualEventService eventService;
    private final PdfService pdfService;
    private final EmailService emailService;

    // ⏰ Rappel 5 min avant — vérifie toutes les minutes
    @Scheduled(fixedRate = 60000)
    public void sendEventReminders() {

        List<VirtualEvent> events = eventService.getAllEvents();
        LocalDateTime now = LocalDateTime.now();

        for (VirtualEvent event : events) {

            // Ignorer si pas de date de début
            if (event.getScheduledAt() == null) continue;

            // Ignorer si rappel déjà envoyé
            if (Boolean.TRUE.equals(event.getReminderSent())) continue;

            // Ignorer les events annulés ou terminés
            if ("FINISHED".equalsIgnoreCase(event.getStatus()) ||
                    "CANCELLED".equalsIgnoreCase(event.getStatus())) continue;

            long minutesUntilStart = Duration.between(now, event.getScheduledAt()).toMinutes();

            // Fenêtre : entre 0 et 5 minutes avant le début
            if (minutesUntilStart >= 0 && minutesUntilStart <= 5) {

                List<User> participants = event.getParticipants();

                if (participants != null && !participants.isEmpty()) {
                    for (User user : participants) {
                        if (user.getEmail() == null) continue;

                        try {
                            emailService.sendEventReminder(
                                    user.getEmail(),
                                    user.getFirstName() + " " + user.getLastName(),
                                    event.getTitle(),
                                    event.getScheduledAt().toString(),
                                    event.getMeetingLink() != null
                                            ? event.getMeetingLink()
                                            : "https://ton-app.com/events/" + event.getId()
                            );
                            System.out.println("🔔 Rappel envoyé à : " + user.getEmail()
                                    + " pour : " + event.getTitle());

                        } catch (Exception e) {
                            System.out.println("❌ Erreur rappel pour " + user.getEmail()
                                    + " : " + e.getMessage());
                        }
                    }
                }

                // ✅ Marquer rappel comme envoyé pour éviter les doublons
                event.setReminderSent(true);
                eventService.updateEvent(event.getId(), event);
                System.out.println("✅ Rappels envoyés pour l'event : " + event.getTitle());
            }
        }
    }

    // 📄 Génération PDF à la fin de l'event (ton code existant)
    @Scheduled(fixedRate = 20000)
    public void generatePdfAuto() {

        List<VirtualEvent> events = eventService.getAllEvents();

        for (VirtualEvent event : events) {

            if (event.getEndAt() != null &&
                    event.getEndAt().isBefore(LocalDateTime.now()) &&
                    !"FINISHED".equalsIgnoreCase(event.getStatus())) {

                try {
                    event.setStatus("FINISHED");
                    eventService.updateEvent(event.getId(), event);

                    byte[] pdf = pdfService.generateEventPdf(event);

                    File folder = new File("generated-pdfs");
                    if (!folder.exists()) folder.mkdir();

                    FileOutputStream fos = new FileOutputStream(
                            "generated-pdfs/event-" + event.getId() + ".pdf");
                    fos.write(pdf);
                    fos.close();

                    System.out.println("✅ PDF généré : " + event.getTitle());

                } catch (Exception e) {
                    e.printStackTrace();
                }
            }
        }
    }
}
