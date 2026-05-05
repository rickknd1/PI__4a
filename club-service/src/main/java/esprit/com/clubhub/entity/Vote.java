package esprit.com.clubhub.entity;

import java.time.LocalDateTime;

public class Vote {
    private String voterId;
    private String candidateId;
    private String subGroupId;   // Pour quel comité ce vote est émis
    private LocalDateTime voteDate;
    private String ipAddress;

    public Vote() {
        this.voteDate = LocalDateTime.now();
    }

    public Vote(String voterId, String candidateId) {
        this.voterId = voterId;
        this.candidateId = candidateId;
        this.voteDate = LocalDateTime.now();
    }

    // Getters
    public String getVoterId() { return voterId; }
    public String getCandidateId() { return candidateId; }
    public String getSubGroupId() { return subGroupId; }
    public LocalDateTime getVoteDate() { return voteDate; }
    public String getIpAddress() { return ipAddress; }

    // Setters
    public void setVoterId(String voterId) { this.voterId = voterId; }
    public void setCandidateId(String candidateId) { this.candidateId = candidateId; }
    public void setSubGroupId(String subGroupId) { this.subGroupId = subGroupId; }
    public void setVoteDate(LocalDateTime voteDate) { this.voteDate = voteDate; }
    public void setIpAddress(String ipAddress) { this.ipAddress = ipAddress; }
}