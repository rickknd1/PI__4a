package tn.esprit.virtual_event_management.service;
import lombok.RequiredArgsConstructor;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import tn.esprit.virtual_event_management.Dto.UserDto;
import tn.esprit.virtual_event_management.entity.EventRegistration;
import tn.esprit.virtual_event_management.entity.VirtualEvent;
import tn.esprit.virtual_event_management.repository.EventRegistrationRepository;
import tn.esprit.virtual_event_management.repository.VirtualEventRepository;

@Service
@RequiredArgsConstructor
public class EventRegistrationService implements IEventRegistrationService{
    private final EventRegistrationRepository repo;
    private final VirtualEventRepository eventRepository;
    private final EmailService emailService;
    private final RestTemplate restTemplate;

    @Override
    public EventRegistration register(String eventId, String userId) {

        VirtualEvent event = eventRepository.findById(eventId)
                .orElseThrow(() -> new RuntimeException("Event introuvable"));

        if (repo.findByEventIdAndUserId(eventId, userId).isPresent()) {
            throw new RuntimeException("Déjà inscrit");
        }

        if (event.getMaxParticipants() != null &&
                event.getCurrentParticipants() != null &&
                event.getCurrentParticipants() >= event.getMaxParticipants()) {
            throw new RuntimeException("Event complet");
        }

        EventRegistration reg = new EventRegistration();
        reg.setEventId(eventId);
        reg.setUserId(userId);
        reg.setPaid(!Boolean.TRUE.equals(event.getIsPaid()));

        if (event.getCurrentParticipants() == null) {
            event.setCurrentParticipants(0);
        }
        event.setCurrentParticipants(event.getCurrentParticipants() + 1);
        eventRepository.save(event);

        EventRegistration saved = repo.save(reg);

        try {
            String url = "http://localhost:8081/api/users/" + userId;

            HttpHeaders headers = new HttpHeaders();
            headers.setAccept(java.util.List.of(MediaType.APPLICATION_JSON));

            HttpEntity<Void> entity = new HttpEntity<>(headers);

            ResponseEntity<UserDto> response = restTemplate.exchange(
                    url,
                    HttpMethod.GET,
                    entity,
                    UserDto.class
            );

            UserDto user = response.getBody();

            if (user != null && user.getEmail() != null && !user.getEmail().isBlank()) {
                String fullName = ((user.getFirstName() != null ? user.getFirstName() : "") +
                        (user.getLastName() != null ? " " + user.getLastName() : "")).trim();

                emailService.sendRegistrationConfirmation(
                        user.getEmail(),
                        fullName.isBlank() ? "Participant" : fullName,
                        event.getTitle(),
                        event.getScheduledAt() != null ? event.getScheduledAt().toString() : "Date à confirmer",
                        event.getMeetingLink() != null
                                ? event.getMeetingLink()
                                : "https://ton-app.com/events/" + event.getId()
                );

                System.out.println("✅ Email de confirmation envoyé à : " + user.getEmail());
            } else {
                System.out.println("⚠️ Email non envoyé : email utilisateur introuvable");
            }

        } catch (Exception e) {
            System.out.println("⚠️ Email non envoyé : " + e.getMessage());
        }

        return saved;
    }

    @Override
    public EventRegistration markAsPaid(String eventId, String userId) {

        EventRegistration reg = repo.findByEventIdAndUserId(eventId, userId)
                .orElseThrow(() -> new RuntimeException("Inscription requise"));

        reg.setPaid(true);

        return repo.save(reg);
    }

    @Override
    public VirtualEvent joinEvent(String eventId, String userId) {

        VirtualEvent event = eventRepository.findById(eventId)
                .orElseThrow(() -> new RuntimeException("Event introuvable"));

        EventRegistration reg = repo.findByEventIdAndUserId(eventId, userId)
                .orElseThrow(() -> new RuntimeException("Inscription requise"));

        if (event.getIsPaid() && !reg.isPaid()) {
            throw new RuntimeException("Paiement requis");
        }

        if ("FINISHED".equals(event.getStatus())) {
            throw new RuntimeException("Event terminé");
        }

        if (event.getMaxParticipants() != null &&
                event.getCurrentParticipants() >= event.getMaxParticipants()) {
            throw new RuntimeException("Event complet");
        }

        if (reg.isJoined()) {
            throw new RuntimeException("Déjà rejoint");
        }

        reg.setJoined(true);
        repo.save(reg);

        return event;
    }

    @Override
    public boolean canJoin(String eventId, String userId) {

        VirtualEvent event = eventRepository.findById(eventId).orElse(null);
        if (event == null) return false;

        EventRegistration reg = repo.findByEventIdAndUserId(eventId, userId).orElse(null);
        if (reg == null) return false;

        if ("FINISHED".equals(event.getStatus())) return false;

        if (event.getMaxParticipants() != null &&
                event.getCurrentParticipants() >= event.getMaxParticipants()) return false;

        if (event.getIsPaid() && !reg.isPaid()) return false;

        return true;
    }
}
