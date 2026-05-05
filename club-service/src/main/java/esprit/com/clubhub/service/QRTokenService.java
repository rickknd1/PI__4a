package esprit.com.clubhub.service;

import esprit.com.clubhub.entity.Election;
import esprit.com.clubhub.entity.QRToken;
import esprit.com.clubhub.repository.ElectionRepository;
import esprit.com.clubhub.repository.QRTokenRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.Optional;

@Service
public class QRTokenService {

    @Autowired
    private QRTokenRepository qrTokenRepository;

    @Autowired
    private ElectionRepository electionRepository;

    @Autowired
    private QRCodeService qrCodeService;

    @Autowired
    private GmailEmailService emailService;

    @Autowired
    private VotingCodeService votingCodeService;

    public QRToken createQRToken(String electionId, String userId, String email, String name,
                                  String role, boolean isCandidate, String photoUrl,
                                  String subGroupId, String subGroupName) {
        Optional<QRToken> existing = qrTokenRepository.findByElectionIdAndUserId(electionId, userId);
        if (existing.isPresent()) {
            return existing.get();
        }

        String token = qrCodeService.generateQRToken();
        QRToken qrToken = new QRToken(token, electionId, userId, email, name, role, isCandidate);
        qrToken.setPhotoUrl(photoUrl);
        qrToken.setSubGroupId(subGroupId);
        qrToken.setSubGroupName(subGroupName);

        return qrTokenRepository.save(qrToken);
    }

    public Optional<QRToken> getQRTokenInfo(String token) {
        return qrTokenRepository.findByToken(token);
    }

    public Map<String, Object> validatePresence(String token, String validatedBy) {
        Optional<QRToken> qrTokenOpt = qrTokenRepository.findByToken(token);

        if (qrTokenOpt.isEmpty()) {
            return Map.of("success", false, "message", "Token QR invalide");
        }

        QRToken qrToken = qrTokenOpt.get();

        if (LocalDateTime.now().isAfter(qrToken.getExpiresAt())) {
            return Map.of("success", false, "message", "Token QR expiré");
        }

        if ("VALIDATED".equals(qrToken.getStatus()) || "USED".equals(qrToken.getStatus())) {
            return Map.of("success", false, "message", "Présence déjà validée");
        }

        if ("REJECTED".equals(qrToken.getStatus())) {
            return Map.of("success", false, "message", "Présence rejetée précédemment");
        }

        Election election = electionRepository.findById(qrToken.getElectionId())
                .orElseThrow(() -> new RuntimeException("Élection non trouvée"));

        String votingToken = votingCodeService.generateUniqueCode();
        qrToken.setVotingToken(votingToken);
        qrToken.setStatus("VALIDATED");
        qrToken.setValidatedAt(LocalDateTime.now());
        qrToken.setValidatedBy(validatedBy);

        qrTokenRepository.save(qrToken);

        try {
            emailService.sendPresenceValidatedEmail(qrToken.getEmail(), qrToken.getName(), election, votingToken);
        } catch (Exception e) {
            System.err.println("Erreur envoi email validation: " + e.getMessage());
        }

        return Map.of(
            "success", true,
            "message", "Présence validée avec succès",
            "memberName", qrToken.getName(),
            "votingToken", votingToken
        );
    }

    public Map<String, Object> rejectPresence(String token, String validatedBy, String reason) {
        Optional<QRToken> qrTokenOpt = qrTokenRepository.findByToken(token);

        if (qrTokenOpt.isEmpty()) {
            return Map.of("success", false, "message", "Token QR invalide");
        }

        QRToken qrToken = qrTokenOpt.get();

        if ("VALIDATED".equals(qrToken.getStatus()) || "USED".equals(qrToken.getStatus())) {
            return Map.of("success", false, "message", "Présence déjà validée, impossible de rejeter");
        }

        Election election = electionRepository.findById(qrToken.getElectionId())
                .orElseThrow(() -> new RuntimeException("Élection non trouvée"));

        qrToken.setStatus("REJECTED");
        qrToken.setValidatedAt(LocalDateTime.now());
        qrToken.setValidatedBy(validatedBy);

        qrTokenRepository.save(qrToken);

        try {
            emailService.sendPresenceRejectedEmail(qrToken.getEmail(), qrToken.getName(), election, reason);
        } catch (Exception e) {
            System.err.println("Erreur envoi email rejet: " + e.getMessage());
        }

        return Map.of("success", true, "message", "Présence rejetée", "memberName", qrToken.getName());
    }

    public boolean isVotingTokenValid(String votingToken) {
        Optional<QRToken> qrToken = qrTokenRepository.findByVotingToken(votingToken);
        if (qrToken.isEmpty()) return false;
        QRToken token = qrToken.get();
        return "VALIDATED".equals(token.getStatus()) && LocalDateTime.now().isBefore(token.getExpiresAt());
    }

    public Optional<QRToken> getVotingTokenInfo(String votingToken) {
        Optional<QRToken> qrToken = qrTokenRepository.findByVotingToken(votingToken);
        if (qrToken.isEmpty()) return Optional.empty();
        QRToken token = qrToken.get();
        if (!"VALIDATED".equals(token.getStatus()) || LocalDateTime.now().isAfter(token.getExpiresAt())) {
            return Optional.empty();
        }
        return qrToken;
    }

    public void markVotingTokenAsUsed(String votingToken) {
        qrTokenRepository.findByVotingToken(votingToken).ifPresent(token -> {
            token.setStatus("USED");
            qrTokenRepository.save(token);
        });
    }

    public Map<String, Object> getPresenceStats(String electionId) {
        long total = qrTokenRepository.findByElectionId(electionId).size();
        long validated = qrTokenRepository.countByElectionIdAndStatus(electionId, "VALIDATED");
        long rejected = qrTokenRepository.countByElectionIdAndStatus(electionId, "REJECTED");
        long used = qrTokenRepository.countByElectionIdAndStatus(electionId, "USED");
        long pending = total - validated - rejected - used;

        return Map.of("total", total, "validated", validated, "rejected", rejected, "used", used, "pending", pending);
    }
}
