package esprit.com.clubhub.entity;

import com.fasterxml.jackson.annotation.JsonProperty;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

@Document(collection = "users")
public class User {

    @Id
    private String id;

    @NotBlank(message = "Le prénom est obligatoire")
    private String firstName;

    @NotBlank(message = "Le nom est obligatoire")
    private String lastName;

    @NotBlank(message = "Le numéro de téléphone est obligatoire")
    @Pattern(regexp = "^[+]?[0-9]{8,15}$", message = "Numéro de téléphone invalide")
    private String phoneNumber;

    @NotBlank(message = "L'email est obligatoire")
    @Email(message = "Email invalide")
    private String email;

    // WRITE_ONLY: le hash bcrypt n'est jamais serialise dans les reponses HTTP.
    // Les controllers/services peuvent toujours le set/get via Java mais le client
    // ne le verra jamais dans le JSON. Avant: les responses leakaient les hashes.
    @NotBlank(message = "Le mot de passe est obligatoire")
    @JsonProperty(access = JsonProperty.Access.WRITE_ONLY)
    private String password;

    private String role;  // Peut être un rôle système (PRESIDENT, etc.) OU un rôle personnalisé (nom du rôle)
    private String customRoleId;  // ID du rôle personnalisé (si applicable) pour récupérer les permissions
    private String profilePhoto;
    private String post;

    // ===== CHAMPS POUR COMPATIBILITÉ =====
    private boolean active = true;
    private String clubId;  // Stocker simplement l'ID du club

    public User() {}

    // ===== Getters et Setters =====
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

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
    
    // Méthode helper pour vérifier si c'est un rôle système
    public boolean isSystemRole() {
        try {
            Role.valueOf(role);
            return true;
        } catch (Exception e) {
            return false;
        }
    }
    
    // Méthode helper pour obtenir le rôle système (si applicable)
    public Role getSystemRole() {
        try {
            return Role.valueOf(role);
        } catch (Exception e) {
            return null;
        }
    }

    public String getCustomRoleId() { return customRoleId; }
    public void setCustomRoleId(String customRoleId) { this.customRoleId = customRoleId; }

    public String getProfilePhoto() { return profilePhoto; }
    public void setProfilePhoto(String profilePhoto) { this.profilePhoto = profilePhoto; }

    public String getPost() { return post; }
    public void setPost(String post) { this.post = post; }

    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }

    public String getClubId() { return clubId; }
    public void setClubId(String clubId) { this.clubId = clubId; }

    // ===== Méthodes de compatibilité =====
    public String getName() {
        return firstName + " " + lastName;
    }

    public void setName(String name) {
        String[] parts = name.split(" ", 2);
        this.firstName = parts[0];
        this.lastName = parts.length > 1 ? parts[1] : "";
    }
}