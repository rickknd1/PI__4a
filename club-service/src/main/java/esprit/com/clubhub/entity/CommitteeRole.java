package esprit.com.clubhub.entity;

import java.time.LocalDateTime;

public class CommitteeRole {
    private String subGroupId;
    private String subGroupName;
    private String role;
    private LocalDateTime joinedDate;

    public CommitteeRole() { this.joinedDate = LocalDateTime.now(); }

    public CommitteeRole(String subGroupId, String subGroupName, String role) {
        this.subGroupId = subGroupId;
        this.subGroupName = subGroupName;
        this.role = role;
        this.joinedDate = LocalDateTime.now();
    }

    public String getSubGroupId() { return subGroupId; }
    public String getSubGroupName() { return subGroupName; }
    public String getRole() { return role; }
    public LocalDateTime getJoinedDate() { return joinedDate; }

    public void setSubGroupId(String subGroupId) { this.subGroupId = subGroupId; }
    public void setSubGroupName(String subGroupName) { this.subGroupName = subGroupName; }
    public void setRole(String role) { this.role = role; }
    public void setJoinedDate(LocalDateTime joinedDate) { this.joinedDate = joinedDate; }
}
