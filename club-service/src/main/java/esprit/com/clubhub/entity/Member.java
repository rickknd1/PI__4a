package esprit.com.clubhub.entity;

import java.time.LocalDateTime;

public class Member {
    private String userId;
    private String email;
    private String name;
    private String role;        // Rôle global dans le club
    private String initialRole; // ✅ NOUVEAU: Rôle initial avant de devenir responsable
    private String subGroupId;
    private String subGroupRole; // Rôle dans le sous-groupe : RESPONSABLE, ASSISTANT, MEMBRE
    private String status;
    private LocalDateTime joinedDate;

    public Member() {
        this.joinedDate = LocalDateTime.now();

    }

    public Member(String userId) {
        this.userId = userId;
        this.joinedDate = LocalDateTime.now();
        this.status = "PENDING";
        this.role = "MEMBER";
    }

    // Derived helpers for scheduler compatibility
    public int getCommitteeCount() { return subGroupId != null ? 1 : 0; }
    public java.util.List<CommitteeRole> getCommitteeRoles() { return null; }

    // Getters
    public String getUserId() { return userId; }
    public String getEmail() { return email; }
    public String getName() { return name; }
    public String getRole() { return role; }
    public String getInitialRole() { return initialRole; }
    public String getSubGroupId() { return subGroupId; }
    public String getSubGroupRole() { return subGroupRole; }
    public String getStatus() { return status; }
    public LocalDateTime getJoinedDate() { return joinedDate; }

    // Setters
    public void setUserId(String userId) { this.userId = userId; }
    public void setEmail(String email) { this.email = email; }
    public void setName(String name) { this.name = name; }
    public void setRole(String role) { this.role = role; }
    public void setInitialRole(String initialRole) { this.initialRole = initialRole; }
    public void setSubGroupId(String subGroupId) { this.subGroupId = subGroupId; }
    public void setSubGroupRole(String subGroupRole) { this.subGroupRole = subGroupRole; }
    public void setStatus(String status) { this.status = status; }
    public void setJoinedDate(LocalDateTime joinedDate) { this.joinedDate = joinedDate; }
}