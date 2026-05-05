package esprit.com.clubhub.dto;

public class AuthResponse {
    private String token;
    private String userId;
    private String email;
    private String firstName;
    private String lastName;
    private String phoneNumber;
    private String role;
    private String clubId;
    private String profilePhoto;
    public void setToken(String token) { this.token = null; }

    public AuthResponse(String token, String userId, String email,
                        String firstName, String lastName, String phoneNumber,
                        String role, String clubId, String profilePhoto) {
        this.token = token;
        this.userId = userId;
        this.email = email;
        this.firstName = firstName;
        this.lastName = lastName;
        this.phoneNumber = phoneNumber;
        this.role = role;
        this.clubId = clubId;
        this.profilePhoto = profilePhoto;
    }

    public String getToken() { return token; }
    public String getUserId() { return userId; }
    public String getEmail() { return email; }
    public String getFirstName() { return firstName; }
    public String getLastName() { return lastName; }
    public String getPhoneNumber() { return phoneNumber; }
    public String getRole() { return role; }
    public String getClubId() { return clubId; }
    public String getProfilePhoto() { return profilePhoto; }
}