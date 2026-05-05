package esprit.com.instantvoicemanagment.controller;

import esprit.com.instantvoicemanagment.entity.AudioReport;
import esprit.com.instantvoicemanagment.repository.AudioMessageRepo;
import esprit.com.instantvoicemanagment.repository.AudioReportRepo;
import esprit.com.instantvoicemanagment.service.NotificationDispatchService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/reports")
@RequiredArgsConstructor
public class ReportController {

    private final AudioReportRepo reportRepo;
    private final AudioMessageRepo audioMessageRepo;
    private final NotificationDispatchService notificationDispatchService;

    @PostMapping
    public ResponseEntity<AudioReport> createReport(@RequestBody AudioReport report) {
        report.setStatus("PENDING");
        report.setCreatedAt(LocalDateTime.now());
        AudioReport saved = reportRepo.save(report);
        notificationDispatchService.notifyBureauOnNewReport(saved);

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
                notificationDispatchService.notifyReporterReviewed(report, decisionLabel, decisionText);
            }

            // Notify the reporter when their report is dismissed
            if ("DISMISSED".equals(newStatus)) {
                notificationDispatchService.notifyReporterDismissed(report);
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
}
