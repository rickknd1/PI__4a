package esprit.com.instantvoicemanagment.controller;

import esprit.com.instantvoicemanagment.entity.AudioReport;
import esprit.com.instantvoicemanagment.entity.Notification;
import esprit.com.instantvoicemanagment.repository.AudioMessageRepo;
import esprit.com.instantvoicemanagment.repository.AudioReportRepo;
import esprit.com.instantvoicemanagment.repository.NotificationRepo;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import org.springframework.web.client.RestTemplate;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/reports")
@RequiredArgsConstructor
public class ReportController {
    private static final Logger log = LoggerFactory.getLogger(ReportController.class);

    private final AudioReportRepo reportRepo;
    private final NotificationRepo notifRepo;
    private final AudioMessageRepo audioMessageRepo;
    private final RestTemplate restTemplate = new RestTemplate();

    @PostMapping
    public ResponseEntity<AudioReport> createReport(@RequestBody AudioReport report) {
        report.setStatus("PENDING");
        report.setCreatedAt(LocalDateTime.now());
        AudioReport saved = reportRepo.save(report);

        // Notify all bureau members (non-simple) so they can treat the report
        try {
            List<?> bureauMembers = restTemplate.getForObject(
                    "http://localhost:8081/api/users/bureau", List.class);
            if (bureauMembers != null) {
                String msg = saved.getReportedByUserName() + " reported an audio message from "
                        + saved.getReportedUserName() + " in channel \""
                        + saved.getChannelName() + "\".";
                for (Object obj : bureauMembers) {
                    if (!(obj instanceof Map<?, ?> user)) continue;
                    String userId = valueAsString(user.get("id"));
                    if (userId == null || userId.isBlank()) {
                        userId = valueAsString(user.get("userId"));
                    }
                    if (userId == null) continue;
                    saveNotification(userId, "REPORT_CREATED", msg, saved.getId(), saved.getReportedUserId());
                }
            }
        } catch (Exception ex) {
            log.warn("Failed to notify bureau members for report {}: {}", saved.getId(), ex.getMessage());
        }

        return ResponseEntity.ok(saved);
    }

    @GetMapping
    public List<AudioReport> getReports(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String reportedByUserId) {
        if (reportedByUserId != null && !reportedByUserId.isBlank()) {
            return reportRepo.findByReportedByUserIdOrderByCreatedAtDesc(reportedByUserId);
        }
        if (status != null && !status.isBlank() && !status.equals("ALL")) {
            return reportRepo.findByStatusOrderByCreatedAtDesc(status);
        }
        return reportRepo.findAllByOrderByCreatedAtDesc();
    }

    @PatchMapping("/{id}/status")
    public ResponseEntity<AudioReport> updateStatus(
            @PathVariable String id,
            @RequestBody Map<String, String> body) {
        return reportRepo.findById(id).map(report -> {
            String newStatus = body.get("status");
            report.setStatus(newStatus);

            String decisionType = body.get("decisionType");
            String decisionText = body.get("decisionText");

            if (decisionType != null && !decisionType.isBlank()) {
                report.setDecisionType(decisionType);
                report.setDecisionText(decisionText);
                report.setTreatedAt(LocalDateTime.now());

                // If DELETE_AUDIO is among the decisions, hide the audio from normal members
                if (decisionType.contains("DELETE_AUDIO")) {
                    if (report.getAudioMessageId() != null) {
                        audioMessageRepo.findById(report.getAudioMessageId()).ifPresent(audio -> {
                            audio.setHidden(true);
                            audioMessageRepo.save(audio);
                        });
                    }
                }
            }

            AudioReport saved = reportRepo.save(report);

            // Notify the reporter when their report is reviewed with a decision
            if ("REVIEWED".equals(newStatus) && decisionType != null && !decisionType.isBlank()) {
                String decisionLabel = decisionTypeLabel(decisionType);
                String msg = "Your report about " + report.getReportedUserName()
                        + " has been reviewed. Decision: " + decisionLabel
                        + (decisionText != null && !decisionText.isBlank() ? " — " + decisionText : "");

                saveNotification(report.getReportedByUserId(), "REPORT_DECISION", msg, report.getId(), report.getReportedUserId());
            }

            // Notify the reporter when their report is dismissed
            if ("DISMISSED".equals(newStatus)) {
                String msg = "Your report about " + report.getReportedUserName()
                        + " in channel \"" + report.getChannelName() + "\" has been dismissed.";

                saveNotification(report.getReportedByUserId(), "REPORT_DECISION", msg, report.getId(), report.getReportedUserId());
            }

            return ResponseEntity.ok(saved);
        }).orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteReport(@PathVariable String id) {
        reportRepo.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    private String decisionTypeLabel(String type) {
        return java.util.Arrays.stream(type.split(","))
                .map(t -> switch (t.trim()) {
                    case "WARNING" -> "Warning issued";
                    case "DELETE_AUDIO" -> "Audio hidden";
                    default -> t;
                })
                .collect(java.util.stream.Collectors.joining(" + "));
    }

    private void saveNotification(String userId, String type, String message, String reportId, String reportedUserId) {
        if (userId == null || userId.isBlank()) {
            log.warn("Skip notification because recipient userId is blank (reportId={})", reportId);
            return;
        }
        Notification notif = new Notification();
        notif.setUserId(userId);
        notif.setType(type);
        notif.setMessage(message);
        notif.setReportId(reportId);
        notif.setReportedUserId(reportedUserId);
        notifRepo.save(notif);
    }

    private String valueAsString(Object value) {
        return value == null ? null : String.valueOf(value);
    }
}
