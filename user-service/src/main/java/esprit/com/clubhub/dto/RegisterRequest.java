package esprit.com.clubhub.dto;
// ─── Register Request ───────────────────────────────────────────────────────
public class RegisterRequest {
    private String firstName;
    private String lastName;
    private String phoneNumber;
    private String email;
    private String password;
    private String role;    // e.g. "PRESIDENT" (rôle système)
    private String customRoleId;  // ID du rôle personnalisé (optionnel)
    private String clubId;  // MongoDB ObjectId of the club
    private String profilePhoto; // base64 encoded image

    public String getFirstName() { return firstName; }
    public void setFirstName(String firstName) { this.firstName = firstName; }

    public String getLastName() { return lastName; }
    public void setLastName(String lastName) { this.lastName = lastName; }

    public String getPhoneNumber() { return phoneNumber; }
    public void setPhoneNumber(String phoneNumber) { this.phoneNumber = phoneNumber; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }

    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }

    public String getCustomRoleId() { return customRoleId; }
    public void setCustomRoleId(String customRoleId) { this.customRoleId = customRoleId; }

    public String getClubId() { return clubId; }
    public void setClubId(String clubId) { this.clubId = clubId; }

    public String getProfilePhoto() { return profilePhoto; }
    public void setProfilePhoto(String profilePhoto) { this.profilePhoto = profilePhoto; }
}