package esprit.com.clubhub.entity;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

public class ElectionResults {
    private int totalVotes;
    private Map<String, Integer> voteCount;
    private String winnerId;
    private Map<String, String> winnerBySubGroup; // subGroupName → userId gagnant
    private LocalDateTime calculatedAt;

    public ElectionResults() {
        this.voteCount = new HashMap<>();
        this.winnerBySubGroup = new HashMap<>();
    }

    public int getTotalVotes() { return totalVotes; }
    public Map<String, Integer> getVoteCount() { return voteCount; }
    public String getWinnerId() { return winnerId; }
    public Map<String, String> getWinnerBySubGroup() { return winnerBySubGroup; }
    public LocalDateTime getCalculatedAt() { return calculatedAt; }

    public void setTotalVotes(int totalVotes) { this.totalVotes = totalVotes; }
    public void setVoteCount(Map<String, Integer> voteCount) { this.voteCount = voteCount; }
    public void setWinnerId(String winnerId) { this.winnerId = winnerId; }
    public void setWinnerBySubGroup(Map<String, String> winnerBySubGroup) { this.winnerBySubGroup = winnerBySubGroup; }
    public void setCalculatedAt(LocalDateTime calculatedAt) { this.calculatedAt = calculatedAt; }
}