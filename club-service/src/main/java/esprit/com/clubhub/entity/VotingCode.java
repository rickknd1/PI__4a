package esprit.com.clubhub.entity;

import java.time.LocalDateTime;

public class VotingCode {
    private String userId;
    private String email;
    private String code;
    private boolean used;
    private LocalDateTime generatedAt;
    private LocalDateTime usedAt;

    public VotingCode() {
        this.used = false;
        this.generatedAt = LocalDateTime.now();
    }

    public VotingCode(String userId, String email, String code) {
        this.userId = userId;
        this.email = email;
        this.code = code;
        this.used = false;
        this.generatedAt = LocalDateTime.now();
    }

    public String getUserId() { return userId; }
    public String getEmail() { return email; }
    public String getCode() { return code; }
    public boolean isUsed() { return used; }
    public LocalDateTime getGeneratedAt() { return generatedAt; }
    public LocalDateTime getUsedAt() { return usedAt; }

    public void setUserId(String userId) { this.userId = userId; }
    public void setEmail(String email) { this.email = email; }
    public void setCode(String code) { this.code = code; }
    public void setUsed(boolean used) { this.used = used; }
    public void setGeneratedAt(LocalDateTime generatedAt) { this.generatedAt = generatedAt; }
    public void setUsedAt(LocalDateTime usedAt) { this.usedAt = usedAt; }
}
