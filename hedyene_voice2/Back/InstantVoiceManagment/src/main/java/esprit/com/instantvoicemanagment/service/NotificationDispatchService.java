package esprit.com.instantvoicemanagment.service;

import esprit.com.instantvoicemanagment.entity.AudioReport;
import esprit.com.instantvoicemanagment.entity.Notification;
import esprit.com.instantvoicemanagment.repository.NotificationRepo;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class NotificationDispatchService {

    private final NotificationRepo notifRepo;
    private final RestTemplate restTemplate = new RestTemplate();

    public void notifyBureauOnNewReport(AudioReport report) {
        try {
            List<?> bureauMembers = restTemplate.getForObject(
                    "http://localhost:8081/api/users/bureau", List.class);
            if (bureauMembers == null) return;

            String msg = report.getReportedByUserName() + " reported an audio message from "
                    + report.getReportedUserName() + " in channel \""
                    + report.getChannelName() + "\".";

            for (Object obj : bureauMembers) {
                if (!(obj instanceof Map<?, ?> user)) continue;
                String userId = (String) user.get("id");
                if (userId == null) continue;
                Notification notif = new Notification();
                notif.setUserId(userId);
                notif.setMessage(msg);
                notif.setReportId(report.getId());
                notif.setReportedUserId(report.getReportedUserId());
                notifRepo.save(notif);
            }
        } catch (Exception ignored) {
        }
    }

    public void notifyReporterReviewed(AudioReport report, String decisionLabel, String decisionText) {
        String msg = "Your report about " + report.getReportedUserName()
                + " has been reviewed. Decision: " + decisionLabel
                + (decisionText != null && !decisionText.isBlank() ? " — " + decisionText : "");

        Notification notif = new Notification();
        notif.setUserId(report.getReportedByUserId());
        notif.setMessage(msg);
        notif.setReportId(report.getId());
        notif.setReportedUserId(report.getReportedUserId());
        notifRepo.save(notif);
    }

    public void notifyReporterDismissed(AudioReport report) {
        String msg = "Your report about " + report.getReportedUserName()
                + " in channel \"" + report.getChannelName() + "\" has been dismissed.";

        Notification notif = new Notification();
        notif.setUserId(report.getReportedByUserId());
        notif.setMessage(msg);
        notif.setReportId(report.getId());
        notif.setReportedUserId(report.getReportedUserId());
        notifRepo.save(notif);
    }
}
