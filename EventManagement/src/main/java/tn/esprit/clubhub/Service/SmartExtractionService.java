package tn.esprit.clubhub.Service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import tn.esprit.clubhub.DTO.ExtractedDataV2DTO;
import tn.esprit.clubhub.DTO.ExtractedDataV2DTO.ItemExtractDTO;
import tn.esprit.clubhub.DTO.ExtractedDataV2DTO.OfferDTO;
import tn.esprit.clubhub.DTO.ExtractedDataV2DTO.StaffDTO;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * V2 extractor:
 * - multi-items
 * - multi-offers
 * - offer scoring
 * - supplier auto-detection
 */
@Service
public class SmartExtractionService {

    @Autowired
    private OfferScoringService offerScoringService;

    public ExtractedDataV2DTO extract(String text) {
        String t = text == null ? "" : text.replaceAll("[ \\t]+", " ").trim();
        ExtractedDataV2DTO out = new ExtractedDataV2DTO();

        out.setEventNameRaw(first(t,
                "(?:event|événement|event name|nom[\\s_]?événement|occasion|activité)\\s*[:\\-]\\s*([^|;,\\n]{3,100})"
        ));

        out.setDeliveryMethod(detectDelivery(t));
        out.setNotes(first(t,
                "(?:notes?|remarques?|commentaires?)\\s*[:\\-]\\s*([^\\n]{3,300})"
        ));

        // Items (table-like + labeled fallback)
        List<ItemExtractDTO> items = extractItems(t);
        if (items.isEmpty()) {
            ItemExtractDTO single = extractSingleItemFallback(t);
            if (single.getItemName() != null) items.add(single);
        }
        out.setItems(items);

        // Location
        out.getLocation().setAllocationLocation(first(t,
                "(?:allocation[\\s_]?location|lieu|venue|salle|local)\\s*[:\\-]\\s*([^|;,\\n]{3,100})"
        ));
        out.getLocation().setAllocationPeriodStart(firstDate(t,
                "(?:period[\\s_]?start|début[\\s_]?période|from[\\s_]?date)\\s*[:\\-]\\s*"
        ));
        out.getLocation().setAllocationPeriodEnd(firstDate(t,
                "(?:period[\\s_]?end|fin[\\s_]?période|to[\\s_]?date|until)\\s*[:\\-]\\s*"
        ));
        out.getLocation().setLocationBudget(parseAmountOrNull(first(t,
                "(?:location[\\s_]?budget|venue[\\s_]?cost|coût[\\s_]?lieu)\\s*[:\\-]\\s*([0-9][0-9 .,]*)"
        )));

        // Staff
        out.setStaff(extractStaff(t));

        // Offers
        List<OfferDTO> globalOffers = extractOffers(t, "global", null);
        assignOffers(items, globalOffers);

        // Separate location/staff offers if tagged in text
        out.setLocationOffers(extractOffers(t, "location", null));
        out.setStaffOffers(extractOffers(t, "staff", null));

        // Score all offers
        for (ItemExtractDTO i : out.getItems()) offerScoringService.scoreOffers(i.getOffers());
        offerScoringService.scoreOffers(out.getLocationOffers());
        offerScoringService.scoreOffers(out.getStaffOffers());

        return out;
    }

    private void assignOffers(List<ItemExtractDTO> items, List<OfferDTO> offers) {
        if (offers.isEmpty()) return;
        if (items.isEmpty()) return;

        // simple strategy:
        // if only one item => all offers to that item
        // if many items => keep all as offers for first item unless text has targetRef
        if (items.size() == 1) {
            items.get(0).getOffers().addAll(offers);
            return;
        }

        for (OfferDTO o : offers) {
            if (o.getTargetRef() != null) {
                int idx = parseIndex(o.getTargetRef());
                if (idx >= 0 && idx < items.size()) {
                    items.get(idx).getOffers().add(o);
                    continue;
                }
            }
            items.get(0).getOffers().add(o);
        }
    }

    private int parseIndex(String ref) {
        try { return Integer.parseInt(ref.trim()); } catch (Exception e) { return -1; }
    }

    private List<ItemExtractDTO> extractItems(String text) {
        List<ItemExtractDTO> out = new ArrayList<>();

        // Pattern: "item: X | qty: 2 | fee: 500"
        Pattern p = Pattern.compile(
                "(?:item|article|matériel|equipment)\\s*[:\\-]\\s*([^|;\\n]{2,80})" +
                        "(?:[^\\n]*?(?:qty|quantity|qte|quantité)\\s*[:\\-]\\s*(\\d+))?" +
                        "(?:[^\\n]*?(?:rental[\\s_]?fee|item[\\s_]?cost|frais|prix)\\s*[:\\-]\\s*([0-9][0-9 .,]*))?",
                Pattern.CASE_INSENSITIVE
        );
        Matcher m = p.matcher(text);
        while (m.find()) {
            ItemExtractDTO i = new ItemExtractDTO();
            i.setItemName(safe(m.group(1)));
            i.setQuantity(parseIntOrDefault(m.group(2), 1));
            i.setRentalFee(parseAmountOrNull(m.group(3)));
            i.setCategory(detectCategory(i.getItemName() + " " + text));
            i.setExpectedReturnDate(firstDate(text, "(?:expected[\\s_]?return[\\s_]?date|return[\\s_]?by|due[\\s_]?date)\\s*[:\\-]\\s*"));
            i.setExpectedReturnTime(defaultIfBlank(first(text, "(?:return[\\s_]?time|heure[\\s_]?retour|heure)\\s*[:\\-]\\s*(\\d{1,2}:\\d{2})"), "12:00"));
            out.add(i);
        }

        return out;
    }

    private ItemExtractDTO extractSingleItemFallback(String t) {
        ItemExtractDTO i = new ItemExtractDTO();
        i.setItemName(first(t, "(?:item[\\s_]?name|item|article|matériel|équipement)\\s*[:\\-]\\s*([^|;,\\n]{3,80})"));
        i.setCategory(detectCategory((i.getItemName() == null ? "" : i.getItemName()) + " " + t));
        i.setQuantity(parseIntOrDefault(first(t, "(?:quantity|qty|qte|quantité)\\s*[:\\-]\\s*(\\d+)"), 1));
        i.setExpectedReturnDate(firstDate(t, "(?:expected[\\s_]?return[\\s_]?date|return[\\s_]?by|due[\\s_]?date)\\s*[:\\-]\\s*"));
        i.setExpectedReturnTime(defaultIfBlank(first(t, "(?:return[\\s_]?time|heure[\\s_]?retour|heure)\\s*[:\\-]\\s*(\\d{1,2}:\\d{2})"), "12:00"));
        i.setRentalFee(parseAmountOrNull(first(t, "(?:rental[\\s_]?fee|item[\\s_]?cost|frais|prix)\\s*[:\\-]\\s*([0-9][0-9 .,]*)")));
        i.setNotes(first(t, "(?:notes?|remarques?)\\s*[:\\-]\\s*([^\\n]{3,250})"));
        return i;
    }

    private List<OfferDTO> extractOffers(String text, String defaultScope, String targetRef) {
        List<OfferDTO> out = new ArrayList<>();

        // Generic supplier blocks
        Pattern p = Pattern.compile(
                "(?:supplier|fournisseur|vendor|offer|devis)\\s*(?:#?\\d+)?\\s*[:\\-]\\s*([^|;,\\n]{2,80})" +
                        "(?:[^\\n]*?(?:amount|montant|price|prix)\\s*[:\\-]\\s*([0-9][0-9 .,]*))?" +
                        "(?:[^\\n]*?(?:valid[\\s_]?until|validité|expire)\\s*[:\\-]\\s*(\\d{4}-\\d{2}-\\d{2}|\\d{1,2}[/\\-.]\\d{1,2}[/\\-.]\\d{2,4}))?" +
                        "(?:[^\\n]*?(?:phone|tel|mobile)\\s*[:\\-]\\s*([+0-9][\\s\\-()0-9]{6,24}))?" +
                        "(?:[^\\n]*?(?:email|mail)\\s*[:\\-]\\s*([A-Z0-9._%+\\-]+@[A-Z0-9.\\-]+\\.[A-Z]{2,}))?",
                Pattern.CASE_INSENSITIVE
        );

        Matcher m = p.matcher(text);
        while (m.find()) {
            OfferDTO o = new OfferDTO();
            o.setScope(defaultScope);
            o.setTargetRef(targetRef);
            o.setSupplierName(safe(m.group(1)));
            o.setAmount(parseAmountOrNull(m.group(2)));
            o.setValidUntil(normalizeDate(m.group(3)));
            o.setContactPhone(safe(m.group(4)));
            o.setContactEmail(safe(m.group(5)));
            if (o.getSupplierName() != null) out.add(o);
        }

        return out;
    }

    private List<StaffDTO> extractStaff(String text) {
        List<StaffDTO> staff = new ArrayList<>();
        Pattern p = Pattern.compile(
                "([A-Za-zÀ-ÖØ-öø-ÿ .'-]{2,40})\\s*[,|;]\\s*([A-Za-zÀ-ÖØ-öø-ÿ .'-]{2,40})\\s*[,|;]\\s*([0-9]+(?:[.,][0-9]+)?)",
                Pattern.MULTILINE
        );
        Matcher m = p.matcher(text);
        while (m.find()) {
            StaffDTO s = new StaffDTO();
            s.setName(safe(m.group(1)));
            s.setRole(safe(m.group(2)));
            s.setBudget(parseAmountOrNull(m.group(3)));
            if (s.getName() != null && s.getRole() != null) staff.add(s);
        }
        return staff;
    }

    private String detectDelivery(String text) {
        String v = first(text, "(?:delivery[\\s_]?method|mode[\\s_]?livraison|delivery|livraison|transport)\\s*[:\\-]\\s*(\\w+(?:[\\s\\-]\\w+)?)");
        if (v == null) return "pickup";
        return v.toLowerCase().matches(".*(livr|deliv|transport|ship).*") ? "delivery" : "pickup";
    }

    private String detectCategory(String text) {
        String lower = text == null ? "" : text.toLowerCase();
        if (lower.matches(".*(projector|camera|audio|sound|microphone|speaker|video|screen|laptop|sono|projecteur|caméra|écran).*")) return "audio_visual";
        if (lower.matches(".*(chair|table|furniture|sofa|desk|chaise|mobilier|bureau).*")) return "furniture";
        if (lower.matches(".*(decor|decoration|banner|flower|balloon|décor|bannière).*")) return "decoration";
        if (lower.matches(".*(food|catering|plate|cup|kitchen|restauration|traiteur).*")) return "catering";
        if (lower.matches(".*(tool|drill|hammer|wrench|screwdriver|outil|perceuse).*")) return "tools";
        if (lower.matches(".*(equipment|generator|tent|stand|générateur|tente|podium).*")) return "equipment";
        if (lower.matches(".*(car|truck|van|vehicle|voiture|camion|véhicule|bus).*")) return "vehicles";
        return "other";
    }

    private String first(String text, String... patterns) {
        for (String p : patterns) {
            if (p == null) continue;
            Matcher m = Pattern.compile(p, Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE).matcher(text);
            if (m.find()) return safe(m.group(1));
        }
        return null;
    }

    private String firstDate(String text, String labelPrefix) {
        Matcher m1 = Pattern.compile(labelPrefix + "(\\d{4}-\\d{2}-\\d{2})", Pattern.CASE_INSENSITIVE).matcher(text);
        if (m1.find()) return m1.group(1);
        Matcher m2 = Pattern.compile(labelPrefix + "(\\d{1,2}[/\\-.]\\d{1,2}[/\\-.]\\d{2,4})", Pattern.CASE_INSENSITIVE).matcher(text);
        if (m2.find()) return normalizeDate(m2.group(1));
        return null;
    }

    private String normalizeDate(String raw) {
        if (raw == null || raw.isBlank()) return null;
        String d = raw.trim();
        if (d.matches("\\d{4}-\\d{2}-\\d{2}")) return d;

        String[] parts = d.split("[/\\-.]");
        if (parts.length != 3) return d;
        if (parts[0].length() == 4) return d;

        String day = String.format("%02d", Integer.parseInt(parts[0]));
        String month = String.format("%02d", Integer.parseInt(parts[1]));
        String year = parts[2].length() == 2 ? "20" + parts[2] : parts[2];
        return year + "-" + month + "-" + day;
    }

    private Integer parseIntOrDefault(String raw, int def) {
        try { return raw == null ? def : Integer.parseInt(raw.trim()); } catch (Exception e) { return def; }
    }

    private Double parseAmountOrNull(String raw) {
        if (raw == null || raw.isBlank()) return null;
        try {
            String cleaned = raw.trim().replaceAll("\\s", "").replace(",", ".");
            int lastDot = cleaned.lastIndexOf('.');
            if (lastDot >= 0) {
                cleaned = cleaned.substring(0, lastDot).replace(".", "") + cleaned.substring(lastDot);
            }
            return Double.parseDouble(cleaned);
        } catch (Exception e) {
            return null;
        }
    }

    private String safe(String s) {
        if (s == null) return null;
        String v = s.trim();
        return v.isEmpty() ? null : v;
    }

    private String defaultIfBlank(String v, String fallback) {
        return (v == null || v.isBlank()) ? fallback : v;
    }
}