package esprit.com.instantvoicemanagment.controller;

import esprit.com.instantvoicemanagment.entity.Notification;
import esprit.com.instantvoicemanagment.repository.NotificationRepo;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationRepo notifRepo;

    @GetMapping
    public List<Notification> getForUser(@RequestParam String userId) {
        return notifRepo.findByUserIdOrderByCreatedAtDesc(userId);
    }

    @PatchMapping("/{id}/read")
    public ResponseEntity<Notification> markRead(@PathVariable String id) {
        return notifRepo.findById(id).map(n -> {
            n.setRead(true);
            return ResponseEntity.ok(notifRepo.save(n));
        }).orElse(ResponseEntity.notFound().build());
    }
}
