package esprit.com.clubhub.entity;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

public class Candidate {
    private String userId;
    private String name;
    private String email;
    private String manifesto;
    private String status;           // "PENDING", "APPROVED", "REJECTED"
    private LocalDateTime applicationDate;

    // NOUVEAUX CHAMPS
    private String positionId;        // Pour quel poste il postule
    private String subGroupTarget;    // Pour quel sous-groupe (Media, Events, etc.)
    private int yearsInClub;          // Ancienneté
    private boolean isActiveMember;   // Membre actif ?
    private String motivation;        // Lettre de motivation
    private String cvUrl;             // URL du CV
    private List<String> skills;      // Compétences
    private boolean conditionsAccepted;
    private String rejectionReason;   // Raison du rejet

    public Candidate() {
        this.status = "PENDING";
        this.applicationDate = LocalDateTime.now();
        this.skills = new ArrayList<>();
        this.isActiveMember = true;
    }

    public Candidate(String userId, String name, String email) {
        this.userId = userId;
        this.name = name;
        this.email = email;
        this.status = "PENDING";
        this.applicationDate = LocalDateTime.now();
        this.skills = new ArrayList<>();
        this.isActiveMember = true;
    }

    // Getters
    public String getUserId() { return userId; }
    public String getName() { return name; }
    public String getEmail() { return email; }
    public String getManifesto() { return manifesto; }
    public String getStatus() { return status; }
    public LocalDateTime getApplicationDate() { return applicationDate; }
    public String getPositionId() { return positionId; }
    public String getSubGroupTarget() { return subGroupTarget; }
    public int getYearsInClub() { return yearsInClub; }
    public boolean isActiveMember() { return isActiveMember; }
    public String getMotivation() { return motivation; }
    public String getCvUrl() { return cvUrl; }
    public List<String> getSkills() { return skills; }
    public boolean isConditionsAccepted() { return conditionsAccepted; }
    public String getRejectionReason() { return rejectionReason; }

    // Setters
    public void setUserId(String userId) { this.userId = userId; }
    public void setName(String name) { this.name = name; }
    public void setEmail(String email) { this.email = email; }
    public void setManifesto(String manifesto) { this.manifesto = manifesto; }
    public void setStatus(String status) { this.status = status; }
    public void setApplicationDate(LocalDateTime applicationDate) { this.applicationDate = applicationDate; }
    public void setPositionId(String positionId) { this.positionId = positionId; }
    public void setSubGroupTarget(String subGroupTarget) { this.subGroupTarget = subGroupTarget; }
    public void setYearsInClub(int yearsInClub) { this.yearsInClub = yearsInClub; }
    public void setActiveMember(boolean activeMember) { isActiveMember = activeMember; }
    public void setMotivation(String motivation) { this.motivation = motivation; }
    public void setCvUrl(String cvUrl) { this.cvUrl = cvUrl; }
    public void setSkills(List<String> skills) { this.skills = skills; }
    public void setConditionsAccepted(boolean conditionsAccepted) { this.conditionsAccepted = conditionsAccepted; }
    public void setRejectionReason(String rejectionReason) { this.rejectionReason = rejectionReason; }
}