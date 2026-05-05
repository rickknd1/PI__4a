package esprit.com.instantvoicemanagment.controller;

import esprit.com.instantvoicemanagment.entity.AudioMessage;
import esprit.com.instantvoicemanagment.repository.AudioMessageRepo;
import esprit.com.instantvoicemanagment.service.ModerationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/channels")
@RequiredArgsConstructor
public class AudioController {

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
        if ("MEMBRE_SIMPLE".equals(role)) {
            return messages.stream()
                    .filter(msg -> !msg.isHidden())
                    .collect(Collectors.toList());
        }
        return messages;
    }
}
