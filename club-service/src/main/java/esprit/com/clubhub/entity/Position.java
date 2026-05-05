package esprit.com.clubhub.entity;

public class Position {
    private String id;
    private String title;
    private String description;
    private int maxCandidates;
    private String subGroupId;    // ID du comité
    private String subGroupName;  // Nom du comité
    private String voteScope;     // OWN_SUBGROUP | ALL_SUBGROUPS

    public Position() { this.maxCandidates = 5; }

    public String getId() { return id; }
    public String getTitle() { return title; }
    public String getDescription() { return description; }
    public int getMaxCandidates() { return maxCandidates; }
    public String getSubGroupId() { return subGroupId; }
    public String getSubGroupName() { return subGroupName; }
    public String getVoteScope() { return voteScope; }

    public void setId(String id) { this.id = id; }
    public void setTitle(String title) { this.title = title; }
    public void setDescription(String description) { this.description = description; }
    public void setMaxCandidates(int maxCandidates) { this.maxCandidates = maxCandidates; }
    public void setSubGroupId(String subGroupId) { this.subGroupId = subGroupId; }
    public void setSubGroupName(String subGroupName) { this.subGroupName = subGroupName; }
    public void setVoteScope(String voteScope) { this.voteScope = voteScope; }
}