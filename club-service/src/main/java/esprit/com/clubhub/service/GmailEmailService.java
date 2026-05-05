package esprit.com.clubhub.service;

import esprit.com.clubhub.entity.Candidate;
import esprit.com.clubhub.entity.Election;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.thymeleaf.TemplateEngine;
import org.thymeleaf.context.Context;

import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;

@Service("gmailEmailService")
public class GmailEmailService {

    @Autowired
    private GmailService gmailService;

    @Autowired
    private TemplateEngine templateEngine;

    @Value("${app.frontend.url:http://localhost:4200}")
    private String frontendUrl;

    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("dd/MM/yyyy à HH:mm");
    private static final int DELAY_BETWEEN_EMAILS_MS = 2000;

    public void sendElectionCreatedEmail(Election election, List<String> memberEmails, String clubName) {
        Context context = new Context();
        context.setVariable("clubName", clubName);
        context.setVariable("electionTitle", election.getTitle());
        context.setVariable("electionDescription", election.getDescription());
        context.setVariable("electionType", election.getType().equals("IN_PERSON") ? "Présentiel" : "Virtuel");
        context.setVariable("startDate", election.getStartDate().format(DATE_FORMATTER));
        context.setVariable("endDate", election.getEndDate().format(DATE_FORMATTER));
        context.setVariable("candidacyDeadline", election.getCandidacyDeadline().format(DATE_FORMATTER));
        context.setVariable("applyLink", frontendUrl + "/elections/" + election.getId());

        if (election.getLocation() != null) {
            context.setVariable("hasLocation", true);
            context.setVariable("location", election.getLocation().getAddress());
        } else {
            context.setVariable("hasLocation", false);
        }

        String htmlContent = templateEngine.process("election-created", context);
        sendEmailsWithDelay(memberEmails, "🗳️ Nouvelle élection: " + election.getTitle(), htmlContent);
    }

    public void sendCandidacyConfirmationEmail(String email, String candidateName, Election election) {
        Context context = new Context();
        context.setVariable("candidateName", candidateName);
        context.setVariable("electionTitle", election.getTitle());
        context.setVariable("electionLink", frontendUrl + "/elections/" + election.getId());

        String htmlContent = templateEngine.process("candidacy-confirmation", context);
        sendSingleEmail(email, "✅ Candidature confirmée: " + election.getTitle(), htmlContent);
    }

    public void sendElectionReminderEmail(Election election, Map<String, String> memberEmailsWithNames,
                                          Map<String, String> memberQRCodes, String clubName,
                                          Map<String, List<Candidate>> candidatesByCommittee,
                                          String googleMapsLink) {
        int count = 0;
        int total = memberEmailsWithNames.size();

        for (Map.Entry<String, String> entry : memberEmailsWithNames.entrySet()) {
            String email = entry.getKey();
            String name = entry.getValue();

            Context context = new Context();
            context.setVariable("memberName", name);
            context.setVariable("clubName", clubName);
            context.setVariable("electionTitle", election.getTitle());
            context.setVariable("startDate", election.getStartDate().format(DATE_FORMATTER));
            context.setVariable("endDate", election.getEndDate().format(DATE_FORMATTER));
            context.setVariable("isInPerson", election.getType().equals("IN_PERSON"));

            if (election.getType().equals("IN_PERSON")) {
                String qrCode = memberQRCodes.get(email);
                if (qrCode != null) {
                    context.setVariable("qrCode", qrCode);
                    context.setVariable("hasQRCode", true);
                } else {
                    context.setVariable("hasQRCode", false);
                }

                if (election.getLocation() != null) {
                    context.setVariable("location", election.getLocation().getAddress());
                    context.setVariable("hasLocation", true);
                    if (googleMapsLink != null) {
                        context.setVariable("googleMapsLink", googleMapsLink);
                        context.setVariable("hasGoogleMapsLink", true);
                    } else {
                        context.setVariable("hasGoogleMapsLink", false);
                    }
                } else {
                    context.setVariable("hasLocation", false);
                    context.setVariable("hasGoogleMapsLink", false);
                }

                context.setVariable("voteLink", frontendUrl + "/elections/" + election.getId() + "/vote");
            } else {
                context.setVariable("voteLink", frontendUrl + "/elections/" + election.getId());
            }

            context.setVariable("candidatesByCommittee", candidatesByCommittee);

            String htmlContent = templateEngine.process("election-reminder", context);
            sendSingleEmail(email, "⏰ Rappel: Élection demain - " + election.getTitle(), htmlContent);

            count++;
            if (count < total) {
                sleep(DELAY_BETWEEN_EMAILS_MS);
            }
        }
    }

    public void sendVoteConfirmationEmail(String email, String voterName, Election election) {
        Context context = new Context();
        context.setVariable("voterName", voterName);
        context.setVariable("electionTitle", election.getTitle());
        context.setVariable("electionLink", frontendUrl + "/elections/" + election.getId());

        String htmlContent = templateEngine.process("vote-confirmation", context);
        sendSingleEmail(email, "✅ Vote enregistré: " + election.getTitle(), htmlContent);
    }

    public void sendElectionResultsEmail(Election election, List<String> memberEmails, String clubName,
                                         Map<String, String> winners) {
        Context context = new Context();
        context.setVariable("clubName", clubName);
        context.setVariable("electionTitle", election.getTitle());
        context.setVariable("electionType", election.getElectionType());
        context.setVariable("winners", winners);
        context.setVariable("electionLink", frontendUrl + "/elections/" + election.getId());

        if (election.getResults() != null) {
            context.setVariable("totalVotes", election.getResults().getTotalVotes());
            context.setVariable("results", election.getResults().getVoteCount());
        }

        String htmlContent = templateEngine.process("election-results", context);
        sendEmailsWithDelay(memberEmails, "🏆 Résultats: " + election.getTitle(), htmlContent);
    }

    public void sendVotingLinkEmail(String email, String voterName, Election election, String votingToken) {
        Context context = new Context();
        context.setVariable("voterName", voterName);
        context.setVariable("electionTitle", election.getTitle());
        context.setVariable("voteLink", frontendUrl + "/elections/" + election.getId() + "/vote?token=" + votingToken);
        context.setVariable("expiryTime", "24 heures");

        String htmlContent = templateEngine.process("voting-link", context);
        sendSingleEmail(email, "🗳️ Lien de vote: " + election.getTitle(), htmlContent);
    }

    public void sendPresenceValidatedEmail(String email, String memberName, Election election, String votingToken) {
        Context context = new Context();
        context.setVariable("memberName", memberName);
        context.setVariable("electionTitle", election.getTitle());
        context.setVariable("voteLink", frontendUrl + "/elections/" + election.getId() + "/vote?token=" + votingToken);
        context.setVariable("expiryTime", "24 heures");
        context.setVariable("startDate", election.getStartDate().format(DATE_FORMATTER));

        String htmlContent = templateEngine.process("presence-validated", context);
        sendSingleEmail(email, "✅ Présence validée: " + election.getTitle(), htmlContent);
    }

    public void sendPresenceRejectedEmail(String email, String memberName, Election election, String reason) {
        Context context = new Context();
        context.setVariable("memberName", memberName);
        context.setVariable("electionTitle", election.getTitle());
        context.setVariable("reason", reason != null ? reason : "Non spécifiée");

        String htmlContent = templateEngine.process("presence-rejected", context);
        sendSingleEmail(email, "❌ Présence non validée: " + election.getTitle(), htmlContent);
    }

    public void sendCandidacyRejectionEmail(String email, String candidateName, Election election, String rejectionReason) {
        Context context = new Context();
        context.setVariable("candidateName", candidateName);
        context.setVariable("electionTitle", election.getTitle());
        context.setVariable("rejectionReason", rejectionReason != null ? rejectionReason : "Non spécifiée");
        context.setVariable("electionLink", frontendUrl + "/elections/" + election.getId());

        String htmlContent = templateEngine.process("candidacy-rejection", context);
        sendSingleEmail(email, "❌ Rejet de votre candidature - " + election.getTitle(), htmlContent);
    }

    public boolean isInitialized() {
        return gmailService != null && gmailService.isInitialized();
    }

    public void sendEmail(String to, String subject, String htmlContent) throws Exception {
        gmailService.sendEmail(to, subject, htmlContent);
    }

    private void sendSingleEmail(String to, String subject, String htmlContent) {
        try {
            gmailService.sendEmail(to, subject, htmlContent);
        } catch (Exception e) {
            System.err.println("❌ Erreur envoi email à " + to + ": " + e.getMessage());
            e.printStackTrace();
        }
    }

    private void sendEmailsWithDelay(List<String> emails, String subject, String htmlContent) {
        int count = 0;
        for (String email : emails) {
            sendSingleEmail(email, subject, htmlContent);
            count++;
            if (count < emails.size()) {
                sleep(DELAY_BETWEEN_EMAILS_MS);
            }
        }
    }

    private void sleep(int milliseconds) {
        try {
            System.out.println("   ⏳ Attente de " + (milliseconds / 1000) + "s avant le prochain envoi...");
            Thread.sleep(milliseconds);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
