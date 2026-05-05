package esprit.com.clubhub.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import esprit.com.clubhub.entity.Election;
import esprit.com.clubhub.entity.ElectionAttendance;
import esprit.com.clubhub.repository.ClubRepository;
import esprit.com.clubhub.repository.ElectionAttendanceRepository;
import esprit.com.clubhub.repository.ElectionRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
public class ElectionAttendanceService {

    @Autowired
    private ElectionAttendanceRepository attendanceRepository;

    @Autowired
    private ElectionRepository electionRepository;

    @Autowired
    private ClubRepository clubRepository;

    @Autowired
    private GmailEmailService emailService;

    private static final SecureRandom random = new SecureRandom();
    private final ObjectMapper objectMapper = new ObjectMapper();

    public ElectionAttendance validateQRCode(String electionId, String qrData, String scannedBy) {
        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> data = objectMapper.readValue(qrData, Map.class);

            String userId = (String) data.get("userId");
            String name = (String) data.get("name");
            String email = (String) data.get("email");
            String qrElectionId = (String) data.get("electionId");

            if (!electionId.equals(qrElectionId)) {
                throw new RuntimeException("Ce QR code n'est pas valide pour cette élection");
            }

            Election election = electionRepository.findById(electionId)
                    .orElseThrow(() -> new RuntimeException("Élection non trouvée"));

            if (!"OPEN".equals(election.getStatus())) {
                throw new RuntimeException("L'élection n'est pas ouverte");
            }

            if (attendanceRepository.existsByElectionIdAndUserId(electionId, userId)) {
                throw new RuntimeException("Ce membre a déjà été enregistré comme présent");
            }

            ElectionAttendance attendance = new ElectionAttendance(electionId, userId, email, name, scannedBy);
            attendance.setVotingToken(generateVotingToken());

            ElectionAttendance saved = attendanceRepository.save(attendance);
            sendVotingLinkEmail(saved, election);

            return saved;

        } catch (Exception e) {
            throw new RuntimeException("Erreur lors de la validation du QR code: " + e.getMessage());
        }
    }

    private String generateVotingToken() {
        byte[] tokenBytes = new byte[32];
        random.nextBytes(tokenBytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(tokenBytes);
    }

    private void sendVotingLinkEmail(ElectionAttendance attendance, Election election) {
        try {
            emailService.sendVotingLinkEmail(attendance.getEmail(), attendance.getName(), election, attendance.getVotingToken());
        } catch (Exception e) {
            System.err.println("Erreur envoi email lien de vote: " + e.getMessage());
        }
    }

    public boolean isTokenValid(String token) {
        Optional<ElectionAttendance> attendance = attendanceRepository.findByVotingToken(token);
        if (attendance.isEmpty()) return false;
        if (attendance.get().isHasVoted()) return false;
        LocalDateTime expiryTime = attendance.get().getScannedAt().plusHours(24);
        return LocalDateTime.now().isBefore(expiryTime);
    }

    public Optional<ElectionAttendance> getByToken(String token) {
        return attendanceRepository.findByVotingToken(token);
    }

    public void markAsVoted(String token) {
        attendanceRepository.findByVotingToken(token).ifPresent(att -> {
            att.setHasVoted(true);
            att.setVotedAt(LocalDateTime.now());
            attendanceRepository.save(att);
        });
    }

    public List<ElectionAttendance> getAttendanceList(String electionId) {
        return attendanceRepository.findByElectionId(electionId);
    }

    public Map<String, Object> getAttendanceStats(String electionId) {
        long totalPresent = attendanceRepository.countByElectionId(electionId);
        long totalVoted = attendanceRepository.countByElectionIdAndHasVoted(electionId, true);
        return Map.of("totalPresent", totalPresent, "totalVoted", totalVoted, "pendingVotes", totalPresent - totalVoted);
    }

    public boolean canScanQRCodes(String clubId, String userId) {
        return clubRepository.findById(clubId)
                .map(club -> club.getMembers().stream()
                        .filter(m -> m.getUserId().equals(userId))
                        .anyMatch(m -> {
                            if ("PRESIDENT".equals(m.getRole())) return true;
                            if (m.getSubGroupId() != null) {
                                return club.getSubGroups().stream()
                                        .filter(sg -> sg.getId().equals(m.getSubGroupId()))
                                        .anyMatch(sg -> sg.getName().toLowerCase().contains("event"));
                            }
                            return false;
                        }))
                .orElse(false);
    }
}
