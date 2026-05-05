package esprit.com.clubhub.dto;

import java.util.ArrayList;
import java.util.List;

public class EligibilityResult {
    private boolean eligible;
    private List<String> reasons;

    public EligibilityResult() {
        this.reasons = new ArrayList<>();
        this.eligible = true;
    }

    public boolean isEligible() {
        return eligible;
    }

    public void setEligible(boolean eligible) {
        this.eligible = eligible;
    }

    public List<String> getReasons() {
        return reasons;
    }

    public void setReasons(List<String> reasons) {
        this.reasons = reasons;
    }

    public void addReason(String reason) {
        this.reasons.add(reason);
    }

    public String getReasonsAsString() {
        return String.join("\n", reasons);
    }
}