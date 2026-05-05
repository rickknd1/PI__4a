package tn.esprit.clubhub.Service;

import org.springframework.stereotype.Service;
import tn.esprit.clubhub.DTO.ExtractedDataV2DTO;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

@Service
public class OfferScoringService {

    public void scoreOffers(List<ExtractedDataV2DTO.OfferDTO> offers) {
        if (offers == null || offers.isEmpty()) return;

        double minAmount = offers.stream()
                .map(ExtractedDataV2DTO.OfferDTO::getAmount)
                .filter(v -> v != null && v > 0)
                .min(Comparator.naturalOrder())
                .orElse(0.0);

        for (ExtractedDataV2DTO.OfferDTO o : offers) {
            List<String> risks = new ArrayList<>();
            double score = 0.0;

            // 1) Price (max 50)
            if (o.getAmount() != null && o.getAmount() > 0 && minAmount > 0) {
                double ratio = minAmount / o.getAmount(); // cheapest => 1.0
                score += Math.max(0, Math.min(50, ratio * 50));
            } else {
                risks.add("Missing amount");
            }

            // 2) Validity date (max 20)
            if (o.getValidUntil() != null) {
                try {
                    LocalDate vu = LocalDate.parse(o.getValidUntil());
                    long days = LocalDate.now().until(vu).getDays();
                    if (days >= 7) score += 20;
                    else if (days >= 3) score += 12;
                    else if (days >= 0) {
                        score += 5;
                        risks.add("Offer validity is very short");
                    } else {
                        risks.add("Offer expired");
                    }
                } catch (Exception ignored) {
                    risks.add("Invalid validity date");
                }
            } else {
                risks.add("No validity date");
            }

            // 3) Delivery included (max 10)
            if (Boolean.TRUE.equals(o.getDeliveryIncluded())) score += 10;

            // 4) Contact completeness (max 10)
            int contactPoints = 0;
            if (notBlank(o.getContactName())) contactPoints++;
            if (notBlank(o.getContactPhone())) contactPoints++;
            if (notBlank(o.getContactEmail())) contactPoints++;
            score += Math.min(10, contactPoints * 3.5);

            // 5) Notes quality (max 10)
            if (notBlank(o.getNotes())) {
                String n = o.getNotes().toLowerCase();
                if (n.contains("warranty") || n.contains("garantie")) score += 4;
                if (n.contains("support") || n.contains("maintenance")) score += 3;
                if (n.contains("payment") || n.contains("paiement")) score += 3;
            }

            o.setScore(Math.round(score * 100.0) / 100.0);
            o.setRiskFlags(risks);

            if (score >= 75) o.setRecommendation("Best value");
            else if (score >= 55) o.setRecommendation("Good option");
            else o.setRecommendation("Needs review");
        }
    }

    private boolean notBlank(String s) {
        return s != null && !s.trim().isEmpty();
    }
}