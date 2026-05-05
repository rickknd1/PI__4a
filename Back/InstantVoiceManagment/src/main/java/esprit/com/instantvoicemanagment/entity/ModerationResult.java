package esprit.com.instantvoicemanagment.entity;

import lombok.Data;

import java.util.Map;

@Data
public class ModerationResult {
    private String label;
    private double confidence;
    private String transcript;
    private Map<String, Double> scores;
    private boolean flagged;
}
