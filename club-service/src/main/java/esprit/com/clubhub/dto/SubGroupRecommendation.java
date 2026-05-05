package esprit.com.clubhub.dto;

public class SubGroupRecommendation {
    private String subGroupId;
    private String subGroupName;
    private String suggestedRole;
    private String reason;

    public SubGroupRecommendation() {
    }

    // Getters
    public String getSubGroupId() {
        return subGroupId;
    }

    public String getSubGroupName() {
        return subGroupName;
    }

    public String getSuggestedRole() {
        return suggestedRole;
    }

    public String getReason() {
        return reason;
    }

    // Setters
    public void setSubGroupId(String subGroupId) {
        this.subGroupId = subGroupId;
    }

    public void setSubGroupName(String subGroupName) {
        this.subGroupName = subGroupName;
    }

    public void setSuggestedRole(String suggestedRole) {
        this.suggestedRole = suggestedRole;
    }

    public void setReason(String reason) {
        this.reason = reason;
    }
}