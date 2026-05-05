package esprit.com.clubhub.controller;

import esprit.com.clubhub.dto.EligibilityResult;
import esprit.com.clubhub.entity.*;
import esprit.com.clubhub.service.ElectionService;
import esprit.com.clubhub.service.GmailEmailService;
import esprit.com.clubhub.service.VotingCodeService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/elections")
@CrossOrigin(origins = "*")
public class ElectionController {

    @Autowired
    private ElectionService electionService;

    @Autowired
    private VotingCodeService votingCodeService;

    @Autowired
    private GmailEmailService emailService;

    // ========== CRUD ==========

    @GetMapping
    public List<Election> getAllElections() {
        return electionService.getAllElections();
    }

    @GetMapping("/{id}")
    public ResponseEntity<Election> getElectionById(@PathVariable String id) {
        return electionService.getElectionById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/club/{clubId}")
    public List<Election> getElectionsByClub(@PathVariable String clubId) {
        return electionService.getElectionsByClub(clubId);
    }

    @PostMapping
    public ResponseEntity<Election> createElection(@RequestBody Election election) {
        try {
            return new ResponseEntity<>(electionService.createElection(election), HttpStatus.CREATED);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<Election> updateElection(@PathVariable String id, @RequestBody Election election) {
        try {
            return ResponseEntity.ok(electionService.updateElection(id, election));
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteElection(@PathVariable String id) {
        electionService.deleteElection(id);
        return ResponseEntity.noContent().build();
    }

    // ========== Opérations spécifiques ==========

    @PostMapping("/{id}/start")
    public ResponseEntity<Election> startElection(@PathVariable String id) {
        try {
            return ResponseEntity.ok(electionService.startElection(id));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @PostMapping("/{id}/close")
    public ResponseEntity<Election> closeElection(@PathVariable String id) {
        try {
            return ResponseEntity.ok(electionService.closeElection(id));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @PostMapping("/{id}/votes")
    public ResponseEntity<Election> castVote(@PathVariable String id, @RequestBody Vote vote) {
        try {
            return ResponseEntity.ok(electionService.castVote(id, vote));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(null);
        }
    }

    @GetMapping("/{id}/results")
    public ResponseEntity<ElectionResults> getResults(@PathVariable String id) {
        return electionService.getElectionById(id)
                .map(election -> ResponseEntity.ok(election.getResults()))
                .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/{id}/candidates/{candidateId}/validate")
    public ResponseEntity<Election> validateCandidate(@PathVariable String id, @PathVariable String candidateId) {
        try {
            return ResponseEntity.ok(electionService.validateCandidate(id, candidateId));
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    // ========== Gestion des Candidats ==========

    @PostMapping("/{electionId}/candidates")
    public ResponseEntity<Election> addCandidate(@PathVariable String electionId, @RequestBody Candidate candidate) {
        try {
            Election election = electionService.getElectionById(electionId)
                    .orElseThrow(() -> new RuntimeException("Élection non trouvée"));
            candidate.setStatus("PENDING");
            candidate.setApplicationDate(LocalDateTime.now());
            election.getCandidates().add(candidate);
            return ResponseEntity.ok(electionService.updateElection(electionId, election));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @GetMapping("/{electionId}/candidates")
    public ResponseEntity<List<Candidate>> getCandidates(@PathVariable String electionId) {
        return electionService.getElectionById(electionId)
                .map(election -> ResponseEntity.ok(election.getCandidates()))
                .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/{electionId}/candidates/{candidateId}/reject")
    public ResponseEntity<Election> rejectCandidate(
            @PathVariable String electionId,
            @PathVariable String candidateId,
            @RequestBody Map<String, String> request) {
        try {
            String rejectionReason = request.get("rejectionReason");
            if (rejectionReason == null || rejectionReason.trim().isEmpty()) {
                return ResponseEntity.badRequest().body(null);
            }

            Election election = electionService.getElectionById(electionId)
                    .orElseThrow(() -> new RuntimeException("Élection non trouvée"));

            Candidate rejected = election.getCandidates().stream()
                    .filter(c -> c.getUserId().equals(candidateId)).findFirst().orElse(null);
            if (rejected == null) return ResponseEntity.notFound().build();

            rejected.setStatus("REJECTED");
            rejected.setRejectionReason(rejectionReason);

            Election updated = electionService.updateElection(electionId, election);

            try {
                emailService.sendCandidacyRejectionEmail(rejected.getEmail(), rejected.getName(), updated, rejectionReason);
            } catch (Exception e) {
                System.err.println("Erreur email rejet candidature: " + e.getMessage());
            }

            return ResponseEntity.ok(updated);
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @DeleteMapping("/{electionId}/candidates/{candidateId}")
    public ResponseEntity<Election> removeCandidate(@PathVariable String electionId, @PathVariable String candidateId) {
        try {
            Election election = electionService.getElectionById(electionId)
                    .orElseThrow(() -> new RuntimeException("Élection non trouvée"));
            election.getCandidates().removeIf(c -> c.getUserId().equals(candidateId));
            return ResponseEntity.ok(electionService.updateElection(electionId, election));
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    // ========== NOUVELLES MÉTHODES ==========

    @PostMapping("/{id}/candidacy")
    public ResponseEntity<?> submitCandidacy(@PathVariable String id, @RequestBody Candidate candidate) {
        try {
            EligibilityResult result = electionService.submitCandidacy(id, candidate);
            return ResponseEntity.ok(result);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/{id}/promote-winner")
    public ResponseEntity<?> promoteWinner(@PathVariable String id) {
        try {
            electionService.promoteWinnerToCEO(id);
            return ResponseEntity.ok(Map.of("message", "Le gagnant a été promu CEO"));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/{id}/eligibility-criteria")
    public ResponseEntity<?> getEligibilityCriteria(@PathVariable String id) {
        try {
            return ResponseEntity.ok(electionService.getEligibilityCriteria(id));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/{id}/available-committees/{userId}")
    public ResponseEntity<?> getAvailableCommittees(@PathVariable String id, @PathVariable String userId) {
        try {
            return ResponseEntity.ok(electionService.getAvailableCommitteesForVoting(id, userId));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/{id}/vote-with-code")
    public ResponseEntity<?> voteWithCode(@PathVariable String id, @RequestBody Map<String, String> request) {
        try {
            String email = request.get("email");
            String code = request.get("code");
            String candidateId = request.get("candidateId");

            if (email == null || code == null || candidateId == null) {
                return ResponseEntity.badRequest().body(Map.of("error", "Email, code et candidateId requis"));
            }

            Election election = electionService.getElectionById(id)
                    .orElseThrow(() -> new RuntimeException("Élection non trouvée"));
            if (!"IN_PERSON".equals(election.getType())) {
                return ResponseEntity.badRequest().body(Map.of("error", "Cette élection n'est pas présentielle"));
            }
            if (!votingCodeService.validateVotingCode(election.getVotingCodes(), email, code)) {
                return ResponseEntity.badRequest().body(Map.of("error", "Code invalide ou déjà utilisé"));
            }

            VotingCode votingCode = election.getVotingCodes().stream()
                    .filter(vc -> vc.getEmail().equals(email) && vc.getCode().equals(code))
                    .findFirst().orElseThrow(() -> new RuntimeException("Code non trouvé"));

            Vote vote = new Vote();
            vote.setVoterId(votingCode.getUserId());
            vote.setCandidateId(candidateId);
            votingCodeService.markCodeAsUsed(election.getVotingCodes(), email, code);

            return ResponseEntity.ok(Map.of("message", "Vote enregistré", "election", electionService.castVote(id, vote)));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/{id}/candidacy-status")
    public ResponseEntity<Map<String, Object>> getCandidacyStatus(@PathVariable String id) {
        try {
            Election election = electionService.getElectionById(id)
                    .orElseThrow(() -> new RuntimeException("Élection non trouvée"));
            LocalDateTime now = LocalDateTime.now();
            boolean isOpen = election.getCandidacyDeadline() == null || now.isBefore(election.getCandidacyDeadline());

            Map<String, Object> response = new HashMap<>();
            response.put("isOpen", isOpen);
            response.put("candidacyDeadline", election.getCandidacyDeadline());
            response.put("startDate", election.getStartDate());
            response.put("message", isOpen ? "Candidatures ouvertes" : "Candidatures fermées");
            return ResponseEntity.ok(response);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/{id}/vote-with-token")
    public ResponseEntity<?> voteWithToken(@PathVariable String id, @RequestBody Map<String, String> request) {
        try {
            String voterId = request.get("voterId");
            String candidateId = request.get("candidateId");
            String token = request.get("token");

            if (voterId == null || candidateId == null || token == null) {
                return ResponseEntity.badRequest().body(Map.of("error", "voterId, candidateId et token requis"));
            }

            Vote vote = new Vote();
            vote.setVoterId(voterId);
            vote.setCandidateId(candidateId);
            if (request.get("subGroupId") != null) vote.setSubGroupId(request.get("subGroupId"));

            Election updated = electionService.castVoteWithToken(id, vote, token);
            return ResponseEntity.ok(Map.of("success", true, "message", "Vote enregistré", "election", updated));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "error", e.getMessage()));
        }
    }
}
