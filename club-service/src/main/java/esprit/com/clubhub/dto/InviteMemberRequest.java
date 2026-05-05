package esprit.com.clubhub.dto;

public class InviteMemberRequest {
    private String firstName;
    private String lastName;
    private String email;
    private String role;
    private String customRoleId;
    private String clubId;

    public String getFirstName() { return firstName; }
    public void setFirstName(String firstName) { this.firstName = firstName; }
    public String getLastName() { return lastName; }
    public void setLastName(String lastName) { this.lastName = lastName; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }
    public String getCustomRoleId() { return customRoleId; }
    public void setCustomRoleId(String customRoleId) { this.customRoleId = customRoleId; }
    public String getClubId() { return clubId; }
    public void setClubId(String clubId) { this.clubId = clubId; }
}
