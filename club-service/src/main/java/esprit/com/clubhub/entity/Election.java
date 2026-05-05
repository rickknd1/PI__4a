package esprit.com.clubhub.entity;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Document(collection = "elections")
public class Election {

    @Id
    private String id;
    private String clubId;
    private String title;
    private String description;
    private String type;                    // "IN_PERSON", "VIRTUAL"
    private LocalDateTime startDate;
    private LocalDateTime endDate;
    private String status;                  // "PLANNED", "OPEN", "CLOSED", "CANCELLED"
    private boolean anonymous;
    private List<Candidate> candidates;
    private List<Vote> votes;
    private List<Position> positions;       // Postes à pourvoir (élections de bureau)
    private ElectionResults results;
    private String electionType;            // "PRESIDENT" ou "BUREAU"
    private VotingMode votingMode;
    private ElectionLocation location;      // Localisation pour élections présentielles
    private List<VotingCode> votingCodes;   // Codes de vote pour élections présentielles
    private LocalDateTime candidacyDeadline; // Date limite de candidature (J-1)
    private boolean reminderSent;           // Email de rappel J-1 envoyé


    public Election() {
        this.candidates = new ArrayList<>();
        this.votes = new ArrayList<>();
        this.positions = new ArrayList<>();
        this.votingCodes = new ArrayList<>();
        this.status = "PLANNED";
        this.anonymous = true;
        this.reminderSent = false;
    }

    // Getters
    public String getId() { return id; }
    public String getClubId() { return clubId; }
    public String getTitle() { return title; }
    public String getDescription() { return description; }
    public String getType() { return type; }
    public LocalDateTime getStartDate() { return startDate; }
    public LocalDateTime getEndDate() { return endDate; }
    public String getStatus() { return status; }
    public boolean isAnonymous() { return anonymous; }
    public List<Candidate> getCandidates() { return candidates; }
    public List<Vote> getVotes() { return votes; }
    public List<Position> getPositions() { return positions; }
    public ElectionResults getResults() { return results; }
    public String getElectionType() { return electionType; }
    public VotingMode getVotingMode() { return votingMode; }
    public ElectionLocation getLocation() { return location; }
    public List<VotingCode> getVotingCodes() { return votingCodes; }
    public LocalDateTime getCandidacyDeadline() { return candidacyDeadline; }
    public boolean isReminderSent() { return reminderSent; }

    // Setters
    public void setId(String id) { this.id = id; }
    public void setClubId(String clubId) { this.clubId = clubId; }
    public void setTitle(String title) { this.title = title; }
    public void setDescription(String description) { this.description = description; }
    public void setType(String type) { this.type = type; }
    public void setStartDate(LocalDateTime startDate) { this.startDate = startDate; }
    public void setEndDate(LocalDateTime endDate) { this.endDate = endDate; }
    public void setStatus(String status) { this.status = status; }
    public void setAnonymous(boolean anonymous) { this.anonymous = anonymous; }
    public void setCandidates(List<Candidate> candidates) { this.candidates = candidates; }
    public void setVotes(List<Vote> votes) { this.votes = votes; }
    public void setPositions(List<Position> positions) { this.positions = positions; }
    public void setResults(ElectionResults results) { this.results = results; }
    public void setElectionType(String electionType) { this.electionType = electionType; }
    public void setVotingMode(VotingMode votingMode) { this.votingMode = votingMode; }
    public void setLocation(ElectionLocation location) { this.location = location; }
    public void setVotingCodes(List<VotingCode> votingCodes) { this.votingCodes = votingCodes; }
    public void setCandidacyDeadline(LocalDateTime candidacyDeadline) { this.candidacyDeadline = candidacyDeadline; }
    public void setReminderSent(boolean reminderSent) { this.reminderSent = reminderSent; }
}
