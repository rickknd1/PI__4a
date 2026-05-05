package esprit.com.instantvoicemanagment.service;

import esprit.com.instantvoicemanagment.entity.AudioMessage;
import esprit.com.instantvoicemanagment.entity.AudioReport;
import esprit.com.instantvoicemanagment.entity.ModerationResult;
import esprit.com.instantvoicemanagment.repository.AudioMessageRepo;
import esprit.com.instantvoicemanagment.repository.AudioReportRepo;
import esprit.com.instantvoicemanagment.repository.ChannelRepo;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

@Service
@RequiredArgsConstructor
public class ModerationService {

    private final AudioMessageRepo audioRepo;
    private final AudioReportRepo reportRepo;
    private final ChannelRepo channelRepo;
    private final RestTemplate restTemplate = new RestTemplate();

    @Value("${ai.moderation.base-url:http://localhost:8001}")
    private String moderationBaseUrl;

    public void moderateAsync(AudioMessage message) {
        CompletableFuture.runAsync(() -> doModerate(message));
    }

    public void scanHistory() {
        List<AudioMessage> unmoderated = audioRepo.findUnmoderated();
        System.out.println("[AI Moderation] Scanning " + unmoderated.size() + " historical audio messages...");
        for (AudioMessage message : unmoderated) {
            CompletableFuture.runAsync(() -> doModerate(message));
        }
    }

    private void doModerate(AudioMessage message) {
        System.out.println("[AI Moderation] Analyzing message: " + message.getId());
        try {
            String moderationUrl = moderationBaseUrl.replaceAll("/+$", "") + "/analyze";
            Map<String, String> payload = Map.of(
                    "audioData", message.getAudioData() != null ? message.getAudioData() : "",
                    "contentType", message.getContentType() != null ? message.getContentType() : "audio/webm"
            );
            ModerationResult result = restTemplate.postForObject(moderationUrl, payload, ModerationResult.class);
            System.out.println("[AI Moderation] Result: " + (result != null
                    ? "label=" + result.getLabel() + " confidence=" + result.getConfidence() + " flagged=" + result.isFlagged() + " transcript='" + result.getTranscript() + "'"
                    : "null"));

            message.setAiModerated(true);
            audioRepo.save(message);

            if (result == null || !result.isFlagged()) return;

            String channelName = channelRepo.findById(message.getChannelId())
                    .map(c -> c.getName())
                    .orElse(message.getChannelId());

            AudioReport report = new AudioReport();
            report.setAudioMessageId(message.getId());
            report.setChannelId(message.getChannelId());
            report.setChannelName(channelName);
            report.setReportedUserId(message.getUserId());
            report.setReportedUserName(message.getUserName());
            report.setReportedByUserId("AI_SYSTEM");
            report.setReportedByUserName("AI Moderation");
            report.setAudioData(message.getAudioData());
            report.setContentType(message.getContentType());
            report.setReason(mapLabel(result.getLabel()));
            report.setDetails(String.format("AI flagged with %.0f%% confidence. Transcript: %s",
                    result.getConfidence() * 100, result.getTranscript()));
            report.setAiGenerated(true);
            report.setAiConfidence(result.getConfidence());
            report.setAiTranscript(result.getTranscript());
            reportRepo.save(report);

        } catch (Exception e) {
            System.err.println("[AI Moderation] ERROR for message " + message.getId() + ": " + e.getMessage());
        }
    }

    private String mapLabel(String aiLabel) {
        return switch (aiLabel) {
            case "PROFANITY" -> "INAPPROPRIATE";
            case "HARASSMENT" -> "HARASSMENT";
            default -> "OTHER";
        };
    }
}
