package esprit.com.clubhub.service;

import esprit.com.clubhub.dto.EligibilityResult;
import esprit.com.clubhub.entity.*;
import esprit.com.clubhub.repository.ElectionRepository;
import esprit.com.clubhub.repository.ClubRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import java.time.LocalDateTime;
import java.util.*;

@Service
public class ElectionService {

    @Autowired
    private ElectionRepository electionRepository;

    @Autowired
    private ClubRepository clubRepository;

    @Autowired
    private EligibilityService eligibilityService;

    @Autowired
    private RestTemplate restTemplate;

    @Autowired
    private GmailEmailService emailService;

    @Autowired
    private VotingCodeService votingCodeService;

    @Autowired
    private ElectionAttendanceService attendanceService;

    @Autowired
    private QRTokenService qrTokenService;

    private String userServiceUrl = "http://localhost:8081/api/users";

    // ========== CRUD ==========

    public List<Election> getAllElections() {
        return electionRepository.findAll();
    }

    public Optional<Election> getElectionById(String id) {
        return electionRepository.findById(id);
    }

    public List<Election> getElectionsByClub(String clubId) {
        return electionRepository.findByClubId(clubId);
    }

    public Election createElection(Election election) {
        System.out.println("=== CREATE ELECTION ===");

        if (election.getStartDate() == null) throw new RuntimeException("La date de début est requise");
        if (election.getEndDate() == null) throw new RuntimeException("La date de fin est requise");
        if (election.getStartDate().isBefore(LocalDateTime.now().minusMinutes(1))) {
            throw new RuntimeException("La date de début doit être aujourd'hui ou dans le futur");
        }

        if (election.getPositions() == null) election.setPositions(new ArrayList<>());
        if (election.getCandidates() == null) election.setCandidates(new ArrayList<>());
        if (election.getVotes() == null) election.setVotes(new ArrayList<>());
        if (election.getStatus() == null) election.setStatus("PLANNED");
        if (election.getElectionType() == null) election.setElectionType("PRESIDENT");

        // Calculer la date limite de candidature (J-1)
        election.setCandidacyDeadline(election.getStartDate().minusHours(24));

        Election saved = electionRepository.save(election);
        System.out.println("Élection créée: " + saved.getId());

        // ÉTAPE 1: Envoyer email de création aux membres
        try {
            Club club = clubRepository.findById(saved.getClubId()).orElse(null);
            if (club == null || club.getMembers() == null || club.getMembers().isEmpty()) return saved;

            List<String> memberEmails;
            if ("PRESIDENT".equals(saved.getElectionType())) {
                memberEmails = club.getMembers().stream()
                    .map(Member::getEmail)
                    .filter(e -> e != null && !e.isEmpty())
                    .toList();
            } else if ("BUREAU".equals(saved.getElectionType())) {
                memberEmails = club.getMembers().stream()
                    .filter(m -> m.getCommitteeCount() > 0)
                    .map(Member::getEmail)
                    .filter(e -> e != null && !e.isEmpty())
                    .toList();
            } else {
                memberEmails = club.getMembers().stream()
                    .map(Member::getEmail)
                    .filter(e -> e != null && !e.isEmpty())
                    .toList();
            }

            if (!memberEmails.isEmpty()) {
                emailService.sendElectionCreatedEmail(saved, memberEmails, club.getName());
                System.out.println("Emails de création envoyés à " + memberEmails.size() + " membres");
            }
        } catch (Exception e) {
            System.err.println("Erreur envoi emails de création: " + e.getMessage());
        }

        return saved;
    }

    public Election updateElection(String id, Election electionDetails) {
        Election election = electionRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Élection non trouvée"));

        if (electionDetails.getTitle() != null) election.setTitle(electionDetails.getTitle());
        if (electionDetails.getDescription() != null) election.setDescription(electionDetails.getDescription());
        if (electionDetails.getStartDate() != null) election.setStartDate(electionDetails.getStartDate());
        if (electionDetails.getEndDate() != null) election.setEndDate(electionDetails.getEndDate());
        if (electionDetails.getType() != null) election.setType(electionDetails.getType());
        if (electionDetails.getElectionType() != null) election.setElectionType(electionDetails.getElectionType());
        if (electionDetails.getPositions() != null) election.setPositions(electionDetails.getPositions());

        if (electionDetails.getCandidates() != null && !electionDetails.getCandidates().isEmpty()) {
            election.setCandidates(electionDetails.getCandidates());
        }
        if (electionDetails.getVotes() != null && !electionDetails.getVotes().isEmpty()) {
            election.setVotes(electionDetails.getVotes());
        }

        return electionRepository.save(election);
    }

    public void deleteElection(String id) {
        electionRepository.deleteById(id);
    }

    // ========== Opérations spécifiques ==========

    public Election startElection(String id) {
        Election election = electionRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Élection non trouvée"));
        if (!election.getStatus().equals("PLANNED")) throw new RuntimeException("L'élection ne peut pas être démarrée");
        election.setStatus("OPEN");
        return electionRepository.save(election);
    }

    public Election closeElection(String id) {
        Election election = electionRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Élection non trouvée"));
        if (!election.getStatus().equals("OPEN")) throw new RuntimeException("L'élection n'est pas ouverte");

        election.setStatus("CLOSED");
        ElectionResults results = calculateResults(election);
        election.setResults(results);
        Election saved = electionRepository.save(election);

        if ("PRESIDENT".equals(election.getElectionType())) {
            applyPresidentRoleChange(saved);
        } else if ("BUREAU".equals(election.getElectionType())) {
            applyBureauRoleChange(saved);
        }

        // ÉTAPE 5: Envoyer les résultats par email
        try {
            Club club = clubRepository.findById(saved.getClubId()).orElse(null);
            if (club != null && saved.getResults() != null) {
                List<String> memberEmails = club.getMembers().stream()
                    .map(Member::getEmail)
                    .filter(e -> e != null && !e.isEmpty())
                    .toList();

                Map<String, String> winners = new HashMap<>();
                if ("PRESIDENT".equals(saved.getElectionType())) {
                    String winnerId = saved.getResults().getWinnerId();
                    saved.getCandidates().stream()
                        .filter(c -> c.getUserId().equals(winnerId))
                        .findFirst()
                        .ifPresent(w -> winners.put("Président", w.getName()));
                } else {
                    Map<String, String> winnerBySubGroup = saved.getResults().getWinnerBySubGroup();
                    if (winnerBySubGroup != null) {
                        winnerBySubGroup.forEach((committee, winnerId) ->
                            saved.getCandidates().stream()
                                .filter(c -> c.getUserId().equals(winnerId))
                                .findFirst()
                                .ifPresent(w -> winners.put(committee, w.getName()))
                        );
                    }
                }

                if (!memberEmails.isEmpty() && !winners.isEmpty()) {
                    emailService.sendElectionResultsEmail(saved, memberEmails, club.getName(), winners);
                }
            }
        } catch (Exception e) {
            System.err.println("Erreur envoi emails résultats: " + e.getMessage());
        }

        return saved;
    }

    private void applyPresidentRoleChange(Election election) {
        if (election.getResults() == null || election.getResults().getWinnerId() == null) return;

        String winnerId = election.getResults().getWinnerId();
        Club club = clubRepository.findById(election.getClubId())
                .orElseThrow(() -> new RuntimeException("Club non trouvé"));

        Candidate winner = election.getCandidates().stream()
                .filter(c -> c.getUserId().equals(winnerId)).findFirst().orElse(null);
        if (winner == null) return;

        String oldPresidentId = null;
        for (Member m : club.getMembers()) {
            if ("PRESIDENT".equals(m.getRole())) { oldPresidentId = m.getUserId(); break; }
        }

        club.getMembers().forEach(m -> {
            if (m.getUserId().equals(winnerId)) m.setRole("PRESIDENT");
            else if ("PRESIDENT".equals(m.getRole())) m.setRole("MEMBRE_SIMPLE");
        });
        clubRepository.save(club);

        try {
            String url = userServiceUrl + "/" + winnerId + "/role";
            Map<String, String> roleUpdate = new HashMap<>();
            roleUpdate.put("role", "PRESIDENT");
            restTemplate.exchange(url, HttpMethod.PUT, new HttpEntity<>(roleUpdate), String.class);

            if (oldPresidentId != null && !oldPresidentId.equals(winnerId)) {
                url = userServiceUrl + "/" + oldPresidentId + "/role";
                roleUpdate = new HashMap<>();
                roleUpdate.put("role", "MEMBRE_SIMPLE");
                restTemplate.exchange(url, HttpMethod.PUT, new HttpEntity<>(roleUpdate), String.class);
            }
        } catch (Exception e) {
            System.err.println("Erreur mise à jour rôle User Service: " + e.getMessage());
        }
    }

    private void applyBureauRoleChange(Election election) {
        if (election.getResults() == null) return;

        Club club = clubRepository.findById(election.getClubId())
                .orElseThrow(() -> new RuntimeException("Club non trouvé"));

        Map<String, String> winnerBySubGroup = election.getResults().getWinnerBySubGroup();
        if (winnerBySubGroup == null || winnerBySubGroup.isEmpty()) return;

        winnerBySubGroup.forEach((subGroupName, winnerId) -> {
            SubGroup targetSg = club.getSubGroups().stream()
                    .filter(sg -> sg.getName().equalsIgnoreCase(subGroupName) ||
                            subGroupName.toLowerCase().contains(sg.getName().toLowerCase()) ||
                            sg.getName().toLowerCase().contains(subGroupName.toLowerCase()))
                    .findFirst().orElse(null);

            if (targetSg == null) return;

            String targetSgId = targetSg.getId();
            String oldResponsableId = targetSg.getResponsableId();

            if (oldResponsableId != null && !oldResponsableId.equals(winnerId)) {
                club.getMembers().stream()
                        .filter(m -> m.getUserId().equals(oldResponsableId))
                        .findFirst()
                        .ifPresent(oldResp -> {
                            oldResp.setSubGroupRole("MEMBRE_COMITE");
                            String restoredRole = oldResp.getInitialRole();
                            if (restoredRole != null) {
                                oldResp.setRole(restoredRole);
                                oldResp.setInitialRole(null);
                                try {
                                    String url = userServiceUrl + "/" + oldResponsableId + "/role";
                                    restTemplate.exchange(url, HttpMethod.PUT,
                                        new HttpEntity<>(Map.of("role", restoredRole)), String.class);
                                } catch (Exception e) {
                                    System.err.println("Erreur mise à jour User Service: " + e.getMessage());
                                }
                            }
                        });
                if (targetSg.getMemberRoles() != null) {
                    targetSg.getMemberRoles().put(oldResponsableId, "MEMBRE_COMITE");
                }
            }

            club.getSubGroups().stream()
                    .filter(sg -> !sg.getId().equals(targetSgId))
                    .forEach(otherSg -> {
                        otherSg.getMemberIds().remove(winnerId);
                        if (otherSg.getMemberRoles() != null) otherSg.getMemberRoles().remove(winnerId);
                        if (winnerId.equals(otherSg.getResponsableId())) otherSg.setResponsableId(null);
                    });

            club.getMembers().stream()
                    .filter(m -> m.getUserId().equals(winnerId))
                    .findFirst()
                    .ifPresent(winner -> {
                        if (winner.getInitialRole() == null) winner.setInitialRole(winner.getRole());
                        winner.setSubGroupId(targetSgId);
                        winner.setSubGroupRole("RESPONSABLE");
                        String newRole = "Responsable " + targetSg.getName();
                        winner.setRole(newRole);
                        try {
                            String url = userServiceUrl + "/" + winnerId + "/role";
                            restTemplate.exchange(url, HttpMethod.PUT,
                                new HttpEntity<>(Map.of("role", newRole)), String.class);
                        } catch (Exception e) {
                            System.err.println("Erreur mise à jour User Service: " + e.getMessage());
                        }
                    });

            targetSg.setResponsableId(winnerId);
            if (!targetSg.getMemberIds().contains(winnerId)) targetSg.getMemberIds().add(winnerId);
            if (targetSg.getMemberRoles() == null) targetSg.setMemberRoles(new HashMap<>());
            targetSg.getMemberRoles().put(winnerId, "RESPONSABLE");
        });

        clubRepository.save(club);
    }

    public Election castVote(String electionId, Vote vote) {
        Election election = electionRepository.findById(electionId)
                .orElseThrow(() -> new RuntimeException("Élection non trouvée"));
        if (!election.getStatus().equals("OPEN")) throw new RuntimeException("L'élection n'est pas ouverte");

        Club club = clubRepository.findById(election.getClubId())
                .orElseThrow(() -> new RuntimeException("Club non trouvé"));

        Member voter = club.getMembers().stream()
                .filter(m -> m.getUserId().equals(vote.getVoterId())).findFirst().orElse(null);
        if (voter == null) throw new RuntimeException("Vous devez être membre du club pour voter");

        boolean canVote = "PRESIDENT".equals(voter.getRole()) || "APPROVED".equals(voter.getStatus());
        if (!canVote) throw new RuntimeException("Votre adhésion doit être approuvée pour voter");

        Candidate candidate = election.getCandidates().stream()
                .filter(c -> c.getUserId().equals(vote.getCandidateId()) && "APPROVED".equals(c.getStatus()))
                .findFirst()
                .orElseThrow(() -> new RuntimeException("Candidat invalide ou non approuvé"));

        String subGroupTarget = candidate.getSubGroupTarget();
        String subGroupId = findSubGroupId(club, subGroupTarget);
        if (subGroupId == null && election.getElectionType().equals("BUREAU")) {
            throw new RuntimeException("Comité non trouvé pour ce candidat");
        }
        vote.setSubGroupId(subGroupId);

        VotingMode votingMode = election.getVotingMode() != null ? election.getVotingMode() : VotingMode.ALL_CLUB_MEMBERS;

        if (election.getElectionType().equals("BUREAU")) {
            if (votingMode == VotingMode.COMMITTEE_MEMBERS_ONLY) {
                boolean isPresident = "PRESIDENT".equals(voter.getRole());
                boolean isInSubGroup = isVoterInSubGroup(club, vote.getVoterId(), subGroupId);
                if (!isPresident && !isInSubGroup) {
                    throw new RuntimeException("Vous ne pouvez voter que pour votre propre comité");
                }
                boolean alreadyVoted = election.getVotes().stream()
                        .anyMatch(v -> v.getVoterId().equals(vote.getVoterId()) && subGroupId.equals(v.getSubGroupId()));
                if (alreadyVoted) throw new RuntimeException("Vous avez déjà voté pour ce comité");
            } else {
                boolean alreadyVoted = election.getVotes().stream()
                        .anyMatch(v -> v.getVoterId().equals(vote.getVoterId()) && subGroupId.equals(v.getSubGroupId()));
                if (alreadyVoted) throw new RuntimeException("Vous avez déjà voté pour ce comité");
            }
        } else {
            boolean alreadyVoted = election.getVotes().stream()
                    .anyMatch(v -> v.getVoterId().equals(vote.getVoterId()));
            if (alreadyVoted) throw new RuntimeException("Vous avez déjà voté");
        }

        election.getVotes().add(vote);
        Election saved = electionRepository.save(election);

        // ÉTAPE 4: Email de confirmation de vote
        try {
            emailService.sendVoteConfirmationEmail(voter.getEmail(), voter.getName(), saved);
        } catch (Exception e) {
            System.err.println("Erreur email confirmation vote: " + e.getMessage());
        }

        return saved;
    }

    private String findSubGroupId(Club club, String subGroupTarget) {
        if (subGroupTarget == null) return null;
        return club.getSubGroups().stream()
                .filter(sg -> sg.getName().equalsIgnoreCase(subGroupTarget) ||
                        subGroupTarget.toLowerCase().contains(sg.getName().toLowerCase()) ||
                        sg.getName().toLowerCase().contains(subGroupTarget.toLowerCase()))
                .map(SubGroup::getId)
                .findFirst().orElse(null);
    }

    private boolean isVoterInSubGroup(Club club, String voterId, String subGroupId) {
        return club.getSubGroups().stream()
                .filter(sg -> sg.getId().equals(subGroupId))
                .anyMatch(sg -> sg.getMemberIds() != null && sg.getMemberIds().contains(voterId));
    }

    public ElectionResults calculateResults(Election election) {
        Map<String, Integer> voteCount = new HashMap<>();
        for (Vote vote : election.getVotes()) {
            voteCount.put(vote.getCandidateId(), voteCount.getOrDefault(vote.getCandidateId(), 0) + 1);
        }

        String winnerId = null;
        int maxVotes = 0;
        for (Map.Entry<String, Integer> entry : voteCount.entrySet()) {
            if (entry.getValue() > maxVotes) { maxVotes = entry.getValue(); winnerId = entry.getKey(); }
        }

        ElectionResults results = new ElectionResults();
        results.setTotalVotes(election.getVotes().size());
        results.setVoteCount(voteCount);
        results.setWinnerId(winnerId);
        results.setCalculatedAt(LocalDateTime.now());

        if ("BUREAU".equals(election.getElectionType())) {
            Map<String, String> winnerBySubGroup = new HashMap<>();
            Map<String, Integer> maxVotesBySubGroup = new HashMap<>();
            for (Candidate c : election.getCandidates()) {
                if (!"APPROVED".equals(c.getStatus())) continue;
                String sg = c.getSubGroupTarget();
                if (sg == null) continue;
                int votes = voteCount.getOrDefault(c.getUserId(), 0);
                if (votes > maxVotesBySubGroup.getOrDefault(sg, -1)) {
                    maxVotesBySubGroup.put(sg, votes);
                    winnerBySubGroup.put(sg, c.getUserId());
                }
            }
            results.setWinnerBySubGroup(winnerBySubGroup);
        }

        election.setResults(results);
        electionRepository.save(election);
        return results;
    }

    public Election validateCandidate(String electionId, String candidateId) {
        Election election = electionRepository.findById(electionId)
                .orElseThrow(() -> new RuntimeException("Élection non trouvée"));
        election.getCandidates().stream()
                .filter(c -> c.getUserId().equals(candidateId))
                .findFirst()
                .ifPresent(c -> c.setStatus("APPROVED"));
        return electionRepository.save(election);
    }

    // ========== NOUVELLES MÉTHODES ==========

    public EligibilityResult submitCandidacy(String electionId, Candidate candidate) {
        Election election = electionRepository.findById(electionId)
                .orElseThrow(() -> new RuntimeException("Élection non trouvée"));

        // Vérifier si les candidatures sont encore ouvertes
        LocalDateTime now = LocalDateTime.now();
        if (election.getCandidacyDeadline() != null && now.isAfter(election.getCandidacyDeadline())) {
            EligibilityResult closedResult = new EligibilityResult();
            closedResult.setEligible(false);
            closedResult.addReason("Les candidatures sont fermées depuis le " +
                election.getCandidacyDeadline().format(java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy à HH:mm")));
            return closedResult;
        }

        EligibilityResult result;
        if ("PRESIDENT".equals(election.getElectionType())) {
            result = eligibilityService.checkPresidentEligibility(election.getClubId(), candidate.getUserId(), candidate);
        } else {
            result = eligibilityService.checkBureauEligibility(election.getClubId(), candidate.getUserId(), candidate);
        }

        if (result.isEligible()) {
            candidate.setStatus("PENDING");
            candidate.setApplicationDate(LocalDateTime.now());
            election.getCandidates().add(candidate);
            electionRepository.save(election);
            result.addReason("Candidature soumise avec succès ! En attente de validation par le président.");

            // ÉTAPE 2: Email de confirmation de candidature
            try {
                emailService.sendCandidacyConfirmationEmail(candidate.getEmail(), candidate.getName(), election);
            } catch (Exception e) {
                System.err.println("Erreur email confirmation candidature: " + e.getMessage());
            }
        }

        return result;
    }

    public void promoteWinnerToCEO(String electionId) {
        Election election = electionRepository.findById(electionId)
                .orElseThrow(() -> new RuntimeException("Élection non trouvée"));
        if (!"PRESIDENT".equals(election.getElectionType())) {
            throw new RuntimeException("Disponible uniquement pour les élections présidentielles");
        }
        if (election.getStatus().equals("CLOSED") && election.getResults() != null) {
            String winnerId = election.getResults().getWinnerId();
            Candidate winner = election.getCandidates().stream()
                    .filter(c -> c.getUserId().equals(winnerId)).findFirst().orElse(null);
            if (winner != null) {
                Club club = clubRepository.findById(election.getClubId())
                        .orElseThrow(() -> new RuntimeException("Club non trouvé"));
                club.getMembers().stream()
                        .filter(m -> m.getUserId().equals(winnerId)).findFirst()
                        .ifPresent(m -> m.setRole("CEO"));
                club.getMembers().stream()
                        .filter(m -> "CEO".equals(m.getRole()) && !m.getUserId().equals(winnerId)).findFirst()
                        .ifPresent(m -> m.setRole("MEMBER"));
                clubRepository.save(club);
            }
        }
    }

    public Map<String, Object> getEligibilityCriteria(String electionId) {
        Election election = electionRepository.findById(electionId)
                .orElseThrow(() -> new RuntimeException("Élection non trouvée"));
        Map<String, Object> criteria = new HashMap<>();
        criteria.put("electionType", election.getElectionType());
        if ("PRESIDENT".equals(election.getElectionType())) {
            criteria.put("minYearsInClub", 1);
            criteria.put("mustBeActive", true);
            criteria.put("mustBeApproved", true);
        } else {
            criteria.put("mustBeActive", true);
            criteria.put("mustBeApproved", true);
            criteria.put("mustBeInSubGroup", true);
        }
        return criteria;
    }

    public Map<String, Object> getAvailableCommitteesForVoting(String electionId, String userId) {
        Election election = electionRepository.findById(electionId)
                .orElseThrow(() -> new RuntimeException("Élection non trouvée"));
        Club club = clubRepository.findById(election.getClubId())
                .orElseThrow(() -> new RuntimeException("Club non trouvé"));

        Map<String, Object> result = new HashMap<>();
        result.put("votingMode", election.getVotingMode() != null ? election.getVotingMode() : VotingMode.ALL_CLUB_MEMBERS);

        Member member = club.getMembers().stream()
                .filter(m -> m.getUserId().equals(userId)).findFirst().orElse(null);
        if (member == null) {
            result.put("canVote", false); result.put("reason", "Vous devez être membre du club");
            result.put("availableCommittees", new ArrayList<>()); return result;
        }

        boolean canVote = "PRESIDENT".equals(member.getRole()) || "APPROVED".equals(member.getStatus());
        if (!canVote) {
            result.put("canVote", false); result.put("reason", "Votre adhésion doit être approuvée");
            result.put("availableCommittees", new ArrayList<>()); return result;
        }

        result.put("canVote", true);
        VotingMode votingMode = election.getVotingMode() != null ? election.getVotingMode() : VotingMode.ALL_CLUB_MEMBERS;

        Map<String, List<Candidate>> candidatesByCommittee = new HashMap<>();
        for (Candidate candidate : election.getCandidates()) {
            if ("APPROVED".equals(candidate.getStatus())) {
                candidatesByCommittee.computeIfAbsent(candidate.getSubGroupTarget(), k -> new ArrayList<>()).add(candidate);
            }
        }

        List<Map<String, Object>> availableCommittees = new ArrayList<>();
        for (Map.Entry<String, List<Candidate>> entry : candidatesByCommittee.entrySet()) {
            String committeeName = entry.getKey();
            String subGroupId = findSubGroupId(club, committeeName);
            if (subGroupId == null) continue;

            boolean canVoteForThis;
            String reason;

            if (votingMode == VotingMode.ALL_CLUB_MEMBERS) {
                boolean alreadyVoted = election.getVotes().stream()
                        .anyMatch(v -> v.getVoterId().equals(userId) && subGroupId.equals(v.getSubGroupId()));
                canVoteForThis = !alreadyVoted;
                reason = alreadyVoted ? "Déjà voté" : "Vous pouvez voter";
            } else {
                boolean isPresident = "PRESIDENT".equals(member.getRole());
                boolean isInSubGroup = isVoterInSubGroup(club, userId, subGroupId);
                if (!isPresident && !isInSubGroup) {
                    canVoteForThis = false; reason = "Vous devez être membre de ce comité";
                } else {
                    boolean alreadyVoted = election.getVotes().stream()
                            .anyMatch(v -> v.getVoterId().equals(userId) && subGroupId.equals(v.getSubGroupId()));
                    canVoteForThis = !alreadyVoted;
                    reason = alreadyVoted ? "Déjà voté" : "Vous pouvez voter";
                }
            }

            Map<String, Object> info = new HashMap<>();
            info.put("committeeName", committeeName);
            info.put("subGroupId", subGroupId);
            info.put("candidates", entry.getValue());
            info.put("canVote", canVoteForThis);
            info.put("reason", reason);
            availableCommittees.add(info);
        }

        result.put("availableCommittees", availableCommittees);
        return result;
    }

    public Election castVoteWithToken(String electionId, Vote vote, String votingToken) {
        if (!qrTokenService.isVotingTokenValid(votingToken)) {
            throw new RuntimeException("Token invalide ou expiré");
        }
        Election election = castVote(electionId, vote);
        qrTokenService.markVotingTokenAsUsed(votingToken);
        return election;
    }
}
