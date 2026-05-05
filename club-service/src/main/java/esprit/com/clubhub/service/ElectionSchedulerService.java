package esprit.com.clubhub.service;

import esprit.com.clubhub.entity.*;
import esprit.com.clubhub.repository.ClubRepository;
import esprit.com.clubhub.repository.ElectionRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class ElectionSchedulerService {

    @Autowired
    private ElectionRepository electionRepository;

    @Autowired
    private ClubRepository clubRepository;

    @Autowired
    private GmailEmailService emailService;

    @Autowired
    private VotingCodeService votingCodeService;

    @Autowired
    private QRCodeService qrCodeService;

    @Autowired
    private QRTokenService qrTokenService;

    @Scheduled(fixedDelay = 30000)
    public void checkElectionReminders() {
        List<Election> elections = electionRepository.findAll();
        LocalDateTime now = LocalDateTime.now();

        for (Election election : elections) {
            if (!"PLANNED".equals(election.getStatus())) continue;
            if (election.isReminderSent()) continue;
            if (election.getStartDate() == null) continue;

            LocalDateTime oneDayBefore = election.getStartDate().minusDays(1);

            if (now.isAfter(oneDayBefore) && now.isBefore(election.getStartDate())) {
                System.out.println("Élection J-1 détectée: " + election.getTitle());
                closeCandidaciesAndSendReminder(election);
            }
        }
    }

    private void closeCandidaciesAndSendReminder(Election election) {
        try {
            election.setCandidacyDeadline(LocalDateTime.now());
            sendElectionReminder(election);
        } catch (Exception e) {
            System.err.println("Erreur fermeture candidatures: " + e.getMessage());
        }
    }

    private void sendElectionReminder(Election election) {
        try {
            Club club = clubRepository.findById(election.getClubId()).orElse(null);
            if (club == null || club.getMembers() == null || club.getMembers().isEmpty()) return;

            Map<String, String> memberEmailsWithNames = new HashMap<>();
            Map<String, String> memberQRCodes = new HashMap<>();
            List<String> userIds = new ArrayList<>();
            List<String> emails = new ArrayList<>();

            for (Member member : club.getMembers()) {
                String email = member.getEmail();
                String name = member.getName();
                String userId = member.getUserId();
                String role = member.getRole();

                if (email == null || email.isEmpty() || name == null) continue;

                boolean shouldSendEmail;
                if ("PRESIDENT".equals(election.getElectionType())) {
                    shouldSendEmail = true;
                } else if ("BUREAU".equals(election.getElectionType())) {
                    shouldSendEmail = member.getCommitteeCount() > 0;
                } else {
                    shouldSendEmail = true;
                }

                if (!shouldSendEmail) continue;

                memberEmailsWithNames.put(email, name);

                if (userId != null) {
                    userIds.add(userId);

                    boolean isCandidate = election.getCandidates().stream()
                        .anyMatch(c -> c.getUserId().equals(userId) && "APPROVED".equals(c.getStatus()));

                    String finalSubGroupId;
                    String finalSubGroupName;

                    if (member.getCommitteeRoles() != null && !member.getCommitteeRoles().isEmpty()) {
                        finalSubGroupId = member.getCommitteeRoles().get(0).getSubGroupId();
                        finalSubGroupName = member.getCommitteeRoles().get(0).getSubGroupName();
                    } else if (member.getSubGroupId() != null) {
                        final String tempSubGroupId = member.getSubGroupId();
                        finalSubGroupId = tempSubGroupId;
                        finalSubGroupName = club.getSubGroups().stream()
                            .filter(sg -> sg.getId().equals(tempSubGroupId))
                            .map(SubGroup::getName)
                            .findFirst()
                            .orElse("");
                    } else {
                        finalSubGroupId = null;
                        finalSubGroupName = "";
                    }

                    QRToken qrToken = qrTokenService.createQRToken(
                        election.getId(), userId, email, name, role, isCandidate,
                        null, finalSubGroupId, finalSubGroupName
                    );

                    String qrCode = qrCodeService.generateElectionQRCodeWithUrl(qrToken.getToken());
                    if (qrCode != null) {
                        memberQRCodes.put(email, qrCode);
                    }
                }
                emails.add(email);
            }

            if (memberEmailsWithNames.isEmpty()) return;

            if ("IN_PERSON".equals(election.getType())) {
                List<VotingCode> votingCodes = votingCodeService.generateVotingCodes(userIds, emails);
                election.setVotingCodes(votingCodes);
            }

            Map<String, List<Candidate>> candidatesByCommittee = new HashMap<>();
            if (election.getCandidates() != null && !election.getCandidates().isEmpty()) {
                candidatesByCommittee = election.getCandidates().stream()
                    .filter(c -> "APPROVED".equals(c.getStatus()))
                    .collect(Collectors.groupingBy(
                        c -> c.getSubGroupTarget() != null ? c.getSubGroupTarget() : "Président",
                        Collectors.toList()
                    ));
            }

            String googleMapsLink = null;
            if (election.getLocation() != null) {
                googleMapsLink = qrCodeService.generateGoogleMapsLink(
                    election.getLocation().getLatitude(),
                    election.getLocation().getLongitude(),
                    election.getLocation().getPlaceName()
                );
            }

            emailService.sendElectionReminderEmail(
                election, memberEmailsWithNames, memberQRCodes,
                club.getName(), candidatesByCommittee, googleMapsLink
            );

            election.setReminderSent(true);
            electionRepository.save(election);

        } catch (Exception e) {
            System.err.println("Erreur envoi rappel: " + e.getMessage());
            e.printStackTrace();
        }
    }
}
