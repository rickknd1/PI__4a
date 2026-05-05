package esprit.com.clubhub.entity;

import java.util.ArrayList;
import java.util.List;

public class ClubRules {
    private String about;
    private List<String> rules;
    private boolean requiresApproval;
    private CommitteeMembershipMode committeeMembershipMode;  // ✅ NOUVEAU

    public ClubRules() {
        this.rules = new ArrayList<>();
        this.requiresApproval = true;
        this.committeeMembershipMode = CommitteeMembershipMode.MULTIPLE_ALLOWED;  // ✅ Par défaut: plusieurs comités autorisés
    }

    // Getters
    public String getAbout() { return about; }
    public List<String> getRules() { return rules; }
    public boolean isRequiresApproval() { return requiresApproval; }
    public CommitteeMembershipMode getCommitteeMembershipMode() { return committeeMembershipMode; }  // ✅ NOUVEAU

    // Setters
    public void setAbout(String about) { this.about = about; }
    public void setRules(List<String> rules) { this.rules = rules; }
    public void setRequiresApproval(boolean requiresApproval) { this.requiresApproval = requiresApproval; }
    public void setCommitteeMembershipMode(CommitteeMembershipMode committeeMembershipMode) { this.committeeMembershipMode = committeeMembershipMode; }  // ✅ NOUVEAU
}