package esprit.com.clubhub.entity;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class SubGroup {
    private String id;
    private String name;
    private String description;
    private List<String> memberIds;
    private String responsableId;  // ✅ ID du responsable du comité
    private Map<String, String> memberRoles;  // ✅ userId -> "MEMBRE_COMITE" ou "RESPONSABLE"

    public SubGroup() {
        this.memberIds = new ArrayList<>();
        this.memberRoles = new HashMap<>();
    }

    public SubGroup(String name, String description) {
        this.name = name;
        this.description = description;
        this.memberIds = new ArrayList<>();
        this.memberRoles = new HashMap<>();
    }

    // Getters
    public String getId() { return id; }
    public String getName() { return name; }
    public String getDescription() { return description; }
    public List<String> getMemberIds() { return memberIds; }
    public String getResponsableId() { return responsableId; }
    public Map<String, String> getMemberRoles() { return memberRoles; }

    // Setters
    public void setId(String id) { this.id = id; }
    public void setName(String name) { this.name = name; }
    public void setDescription(String description) { this.description = description; }
    public void setMemberIds(List<String> memberIds) { this.memberIds = memberIds; }
    public void setResponsableId(String responsableId) { this.responsableId = responsableId; }
    public void setMemberRoles(Map<String, String> memberRoles) { this.memberRoles = memberRoles; }
}