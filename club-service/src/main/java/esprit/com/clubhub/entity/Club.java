package esprit.com.clubhub.entity;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Document(collection = "clubs")
public class Club {

    @Id
    private String id;
    private String name;
    private String description;
    private String category;
    private String visibility;
    private LocalDateTime creationDate;
    private String createdBy;

    // NOUVEAUX CHAMPS
    private String logoUrl;
    private String colorPalette;
    private ClubRules rules;
    private List<Member> members;
    private List<SubGroup> subGroups;

    public Club() {
        this.creationDate = LocalDateTime.now();
        this.visibility = "PUBLIC";
        this.members = new ArrayList<>();
        this.subGroups = new ArrayList<>();
        this.rules = new ClubRules();
    }

    // Getters
    public String getId() { return id; }
    public String getName() { return name; }
    public String getDescription() { return description; }
    public String getCategory() { return category; }
    public String getVisibility() { return visibility; }
    public LocalDateTime getCreationDate() { return creationDate; }
    public String getCreatedBy() { return createdBy; }
    public String getLogoUrl() { return logoUrl; }
    public String getColorPalette() { return colorPalette; }
    public ClubRules getRules() { return rules; }
    public List<Member> getMembers() { return members; }
    public List<SubGroup> getSubGroups() { return subGroups; }

    // Setters
    public void setId(String id) { this.id = id; }
    public void setName(String name) { this.name = name; }
    public void setDescription(String description) { this.description = description; }
    public void setCategory(String category) { this.category = category; }
    public void setVisibility(String visibility) { this.visibility = visibility; }
    public void setCreationDate(LocalDateTime creationDate) { this.creationDate = creationDate; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }
    public void setLogoUrl(String logoUrl) { this.logoUrl = logoUrl; }
    public void setColorPalette(String colorPalette) { this.colorPalette = colorPalette; }
    public void setRules(ClubRules rules) { this.rules = rules; }
    public void setMembers(List<Member> members) { this.members = members; }
    public void setSubGroups(List<SubGroup> subGroups) { this.subGroups = subGroups; }
}