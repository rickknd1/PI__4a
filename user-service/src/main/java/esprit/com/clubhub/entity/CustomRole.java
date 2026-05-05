package esprit.com.clubhub.entity;

import com.fasterxml.jackson.annotation.JsonProperty;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import java.util.List;

@Document(collection = "custom_roles")
public class CustomRole {
    
    @Id
    private String id;
    private String clubId;
    private String roleName;
    private String description;
    private List<String> permissions;
    
    @JsonProperty("isActive")
    private boolean isActive;

    public CustomRole() {}

    public CustomRole(String clubId, String roleName, String description, List<String> permissions) {
        this.clubId = clubId;
        this.roleName = roleName;
        this.description = description;
        this.permissions = permissions;
        this.isActive = true;
    }

    // Getters et Setters
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getClubId() { return clubId; }
    public void setClubId(String clubId) { this.clubId = clubId; }

    public String getRoleName() { return roleName; }
    public void setRoleName(String roleName) { this.roleName = roleName; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public List<String> getPermissions() { return permissions; }
    public void setPermissions(List<String> permissions) { this.permissions = permissions; }

    public boolean isActive() { return isActive; }
    public void setActive(boolean active) { isActive = active; }
    
    // Alias pour la compatibilité JSON
    public boolean getActive() { return isActive; }
}
