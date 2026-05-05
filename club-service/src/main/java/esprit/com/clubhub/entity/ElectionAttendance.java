package esprit.com.clubhub.entity;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Document(collection = "election_attendance")
public class ElectionAttendance {

    @Id
    private String id;
    private String electionId;
    private String userId;
    private String email;
    private String name;
    private LocalDateTime scannedAt;
    private String scannedBy;
    private String votingToken;
    private boolean hasVoted;
    private LocalDateTime votedAt;

    public ElectionAttendance() {
        this.scannedAt = LocalDateTime.now();
        this.hasVoted = false;
    }

    public ElectionAttendance(String electionId, String userId, String email, String name, String scannedBy) {
        this.electionId = electionId;
        this.userId = userId;
        this.email = email;
        this.name = name;
        this.scannedBy = scannedBy;
        this.scannedAt = LocalDateTime.now();
        this.hasVoted = false;
    }

    public String getId() { return id; }
    public String getElectionId() { return electionId; }
    public String getUserId() { return userId; }
    public String getEmail() { return email; }
    public String getName() { return name; }
    public LocalDateTime getScannedAt() { return scannedAt; }
    public String getScannedBy() { return scannedBy; }
    public String getVotingToken() { return votingToken; }
    public boolean isHasVoted() { return hasVoted; }
    public LocalDateTime getVotedAt() { return votedAt; }

    public void setId(String id) { this.id = id; }
    public void setElectionId(String electionId) { this.electionId = electionId; }
    public void setUserId(String userId) { this.userId = userId; }
    public void setEmail(String email) { this.email = email; }
    public void setName(String name) { this.name = name; }
    public void setScannedAt(LocalDateTime scannedAt) { this.scannedAt = scannedAt; }
    public void setScannedBy(String scannedBy) { this.scannedBy = scannedBy; }
    public void setVotingToken(String votingToken) { this.votingToken = votingToken; }
    public void setHasVoted(boolean hasVoted) { this.hasVoted = hasVoted; }
    public void setVotedAt(LocalDateTime votedAt) { this.votedAt = votedAt; }
}
