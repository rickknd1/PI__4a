package esprit.com.instantvoicemanagment.controller;

import esprit.com.instantvoicemanagment.entity.AudioMessage;
import esprit.com.instantvoicemanagment.repository.AudioMessageRepo;
import esprit.com.instantvoicemanagment.service.ModerationService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.Set;
import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/channels")
@RequiredArgsConstructor
public class AudioController {
    private static final Set<String> BUREAU_AUTHORITIES = Set.of(
            "ROLE_PRESIDENT",
            "ROLE_VICE_PRESIDENT",
            "ROLE_RH",
            "ROLE_SECRETAIRE_GENERALE",
            "ROLE_SECRETAIRE_GENERAL",
            "ROLE_TRESORIER",
            "ROLE_TREASURER",
            "ROLE_BUREAU",
            "ROLE_SUPER_ADMIN"
    );

    private final AudioMessageRepo audioRepo;
    private final ModerationService moderationService;

    @PostMapping("/{channelId}/audio")
    public ResponseEntity<AudioMessage> saveAudio(
            @PathVariable String channelId,
            @RequestBody AudioMessage message) {
        message.setChannelId(channelId);
        message.setCreatedAt(LocalDateTime.now());
        message.setAiModerated(false);
        AudioMessage saved = audioRepo.save(message);
        moderationService.moderateAsync(saved);
        return ResponseEntity.ok(saved);
    }

    @GetMapping("/{channelId}/audio")
    public List<AudioMessage> getAudio(
            @PathVariable String channelId,
            @RequestParam(required = false) String role) {
        List<AudioMessage> messages = audioRepo.findByChannelIdOrderByCreatedAtDesc(channelId);
        String normalizedRole = role == null ? "" : role.trim().toUpperCase();
        boolean isBureau = isBureauRole(normalizedRole);

        // Enforce visibility from JWT-authenticated role as source of truth.
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.getAuthorities() != null) {
            isBureau = isBureau || authentication.getAuthorities().stream()
                    .map(a -> a.getAuthority() == null ? "" : a.getAuthority().trim().toUpperCase())
                    .anyMatch(BUREAU_AUTHORITIES::contains);
        }

        // Non-bureau users must never receive hidden audios.
        if (!isBureau) {
            return messages.stream()
                    .filter(msg -> !msg.isHidden())
                    .collect(Collectors.toList());
        }
        return messages;
    }

    private boolean isBureauRole(String role) {
        return switch (role) {
            case "PRESIDENT", "VICE_PRESIDENT", "RH", "SECRETAIRE_GENERALE", "SECRETAIRE_GENERAL",
                    "TRESORIER", "TREASURER", "BUREAU", "SUPER_ADMIN" -> true;
            default -> false;
        };
    }
}
