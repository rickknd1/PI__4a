package tn.esprit.clubhub.Service;

import org.springframework.stereotype.Service;
import tn.esprit.clubhub.DTO.ExtractedDataDTO;
import tn.esprit.clubhub.DTO.ExtractedDataDTO.StaffDTO;
import tn.esprit.clubhub.DTO.ExtractedDataDTO.DevisDTO;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Smart extraction service.
 * Handles French/English documents, structured (key:value) and
 * semi-structured (table-like / paragraph) formats.
 */
@Service
public class AIExtractorService {

    public ExtractedDataDTO extract(String text) {
        ExtractedDataDTO data = new ExtractedDataDTO();

        // Normalise: collapse runs of blanks, keep newlines
        String t = text.replaceAll("[ \\t]+", " ").trim();

        // ── Event ──────────────────────────────────────────────────────────
        data.setEventName(first(t,
                "(?:event|événement|event name|nom[\\s_]?événement|occasion|for event|activité|manifestation)\\s*[:\\-]\\s*([^|;,\\n]{3,80})"
        ));

        // ── Item ───────────────────────────────────────────────────────────
        data.setItemName(first(t,
                "(?:item[\\s_]?name|item|article|product|objet|matériel|équipement|bien|ressource)\\s*[:\\-]\\s*([^|;,\\n]{3,80})"
        ));

        String qtyStr = first(t,
                "(?:quantity|qty|qte|quantité|nombre|nb|count)\\s*[:\\-]\\s*(\\d+)"
        );
        if (qtyStr != null) {
            try { data.setQuantity(Integer.parseInt(qtyStr)); } catch (NumberFormatException ignored) {}
        }

        data.setCategory(detectCategory(t + (data.getItemName() != null ? " " + data.getItemName() : "")));

        data.setNotes(first(t,
                "(?:notes?|remarques?|commentaires?|observations?|description|détails?)\\s*[:\\-]\\s*([^|;\\n]{5,300})"
        ));

        // ── Location / Allocation ──────────────────────────────────────────
        data.setAllocationLocation(first(t,
                "(?:allocation[\\s_]?location|lieu[\\s_]?affectation|salle|emplacement|lieu|assigned[\\s_]?to|affecté[\\s_]?à|venue|local)\\s*[:\\-]\\s*([^|;,\\n]{3,100})"
        ));

        String allocStr = first(t,
                "(?:is[\\s_]?allocated|allocated|affecté|alloué)\\s*[:\\-]\\s*(yes|oui|true|non|no|false)"
        );
        if (allocStr != null) data.setIsAllocated(allocStr.matches("(?i)yes|oui|true"));

        // Allocation period start
        String periodStart = firstDate(t,
                "(?:period[\\s_]?start|début[\\s_]?période|allocation[\\s_]?start|date[\\s_]?début|from[\\s_]?date)\\s*[:\\-]\\s*"
        );
        data.setAllocationPeriodStart(periodStart);

        // Allocation period end
        String periodEnd = firstDate(t,
                "(?:period[\\s_]?end|fin[\\s_]?période|allocation[\\s_]?end|date[\\s_]?fin|to[\\s_]?date|until)\\s*[:\\-]\\s*"
        );
        data.setAllocationPeriodEnd(periodEnd);

        // ── Budgets ────────────────────────────────────────────────────────

        // Location / venue budget (extract BEFORE generic "budget" to avoid collision)
        String locBudget = first(t,
                "(?:location[\\s_]?budget|venue[\\s_]?cost|loyer[\\s_]?salle|frais[\\s_]?location[\\s_]?salle|coût[\\s_]?lieu)\\s*[:\\-]\\s*([0-9][0-9 .,]*)(?:\\s*(?:TND|DT|€|\\$|EUR))?",
                "(?:location|venue|salle|loyer)\\s*[:\\-][^\\n]*?([0-9][0-9 .,]+)(?:\\s*(?:TND|DT|€|\\$|EUR))?"
        );
        if (locBudget != null) {
            try { data.setLocationBudget(parseAmount(locBudget)); } catch (NumberFormatException ignored) {}
        }

        // Item rental fee
        String fee = first(t,
                "(?:rental[\\s_]?fee|item[\\s_]?cost|frais[\\s_]?location[\\s_]?article|frais[\\s_]?location|frais|montant[\\s_]?location|prix[\\s_]?location)\\s*[:\\-]\\s*([0-9][0-9 .,]*)(?:\\s*(?:TND|DT|€|\\$|EUR))?",
                "(?:rental|location[\\s_]?article|item[\\s_]?price)\\s*[:\\-][^\\n]*?([0-9][0-9 .,]+)(?:\\s*(?:TND|DT|€|\\$|EUR))?"
        );
        if (fee != null) {
            try { data.setRentalFee(parseAmount(fee)); } catch (NumberFormatException ignored) {}
        }

        // Total / estimated budget
        String estBudget = first(t,
                "(?:estimated[\\s_]?budget|budget[\\s_]?estimé|budget[\\s_]?prévisionnel|total[\\s_]?budget|budget[\\s_]?total|budget[\\s_]?global)\\s*[:\\-]\\s*([0-9][0-9 .,]*)(?:\\s*(?:TND|DT|€|\\$|EUR))?"
        );
        if (estBudget != null) {
            try { data.setEstimatedBudget(parseAmount(estBudget)); } catch (NumberFormatException ignored) {}
        }

        // ── Staff / HR ─────────────────────────────────────────────────────
        data.setStaff(extractStaff(t));

        // ── Dates ──────────────────────────────────────────────────────────
        String retDate = firstDate(t,
                "(?:expected[\\s_]?return[\\s_]?date|return[\\s_]?by|due[\\s_]?date|date[\\s_]?retour|retour[\\s_]?prévu|return[\\s_]?date|date[\\s_]?de[\\s_]?retour)\\s*[:\\-]\\s*"
        );
        data.setExpectedReturnDate(retDate);

        String retTime = first(t,
                "(?:return[\\s_]?time|heure[\\s_]?retour|heure)\\s*[:\\-]\\s*(\\d{1,2}:\\d{2})"
        );
        data.setExpectedReturnTime(retTime != null ? retTime : "12:00");

        // ── Delivery ───────────────────────────────────────────────────────
        String delivery = first(t,
                "(?:delivery[\\s_]?method|mode[\\s_]?livraison|delivery|livraison|transport)\\s*[:\\-]\\s*(\\w+(?:[\\s\\-]\\w+)?)"
        );
        if (delivery != null) {
            boolean isDelivery = delivery.toLowerCase().matches(".*(livr|deliv|transport|ship).*");
            data.setDeliveryMethod(isDelivery ? "delivery" : "pickup");
        } else {
            data.setDeliveryMethod("pickup");
        }

        // ── Devis / Suppliers ──────────────────────────────────────────────
        DevisDTO d1 = extractDevis(t, 1);
        DevisDTO d2 = extractDevis(t, 2);
        DevisDTO d3 = extractDevis(t, 3);

        if (d1 != null && d1.getSupplierName() != null) {
            data.setDevis1(d1);
            // Pre-fill lender from first devis
            data.setLenderName(d1.getSupplierName());
            data.setLenderPhone(d1.getContactPhone());
            data.setLenderEmail(d1.getContactEmail());
            data.setLenderContactPerson(d1.getContactName());
        }
        if (d2 != null && d2.getSupplierName() != null) data.setDevis2(d2);
        if (d3 != null && d3.getSupplierName() != null) data.setDevis3(d3);

        // If no numbered devis found, try generic supplier block
        if (data.getDevis1() == null) {
            DevisDTO generic = extractGenericSupplier(t);
            if (generic != null) {
                data.setDevis1(generic);
                data.setLenderName(generic.getSupplierName());
                data.setLenderPhone(generic.getContactPhone());
                data.setLenderEmail(generic.getContactEmail());
            }
        }

        return data;
    }

    // ── Staff extraction ───────────────────────────────────────────────────

    /**
     * Finds staff blocks in two forms:
     *   1. Labelled lines:  "Staff: Name | Role | 500"  or  "Formateur: Ahmed | 300"
     *   2. Table rows after a "Staff" / "RH" / "Personnel" header
     */
    private List<StaffDTO> extractStaff(String text) {
        List<StaffDTO> staff = new ArrayList<>();

        // Pattern 1 – explicit labelled rows
        Pattern p1 = Pattern.compile(
                "(?:staff|personnel|rh|formateur|intervenant|animateur|dj|technicien|sécurité|securite)[\\s:]+([A-Za-zÀ-ÖØ-öø-ÿ .'-]{2,40})\\s*[|,;]\\s*([A-Za-zÀ-ÖØ-öø-ÿ .'-]{2,40})\\s*[|,;]\\s*([0-9]+(?:[.,][0-9]+)?)",
                Pattern.CASE_INSENSITIVE | Pattern.MULTILINE
        );
        Matcher m1 = p1.matcher(text);
        while (m1.find()) {
            StaffDTO s = new StaffDTO();
            s.setName(m1.group(1).trim());
            s.setRole(m1.group(2).trim());
            try { s.setBudget(parseAmount(m1.group(3))); } catch (Exception ignored) { s.setBudget(0.0); }
            staff.add(s);
        }

        // Pattern 2 – rows: "Name, Role, Budget" after Staff/RH header
        if (staff.isEmpty()) {
            Pattern headerP = Pattern.compile(
                    "(?:staff|personnel[\\s_]?rh|ressources[\\s_]?humaines|human[\\s_]?resources|équipe)[\\s:]*\\n((?:.*\\n?){1,20})",
                    Pattern.CASE_INSENSITIVE
            );
            Matcher mh = headerP.matcher(text);
            if (mh.find()) {
                String block = mh.group(1);
                Pattern rowP = Pattern.compile(
                        "([A-Za-zÀ-ÖØ-öø-ÿ .'-]{2,40})\\s*[,|;]\\s*([A-Za-zÀ-ÖØ-öø-ÿ .'-]{2,40})\\s*[,|;]\\s*([0-9]+(?:[.,][0-9]+)?)",
                        Pattern.MULTILINE
                );
                Matcher mr = rowP.matcher(block);
                while (mr.find()) {
                    StaffDTO s = new StaffDTO();
                    s.setName(mr.group(1).trim());
                    s.setRole(mr.group(2).trim());
                    try { s.setBudget(parseAmount(mr.group(3))); } catch (Exception ignored) { s.setBudget(0.0); }
                    staff.add(s);
                }
            }
        }

        // Pattern 3 – single formateur line: "Formateur: Ahmed Ben Ali, 500 TND"
        if (staff.isEmpty()) {
            Pattern p3 = Pattern.compile(
                    "(?:formateur|trainer|instructor|intervenant)\\s*[:\\-]\\s*([^,;\\n]{3,60})(?:[,;]\\s*([0-9]+(?:[.,][0-9]+)?))?",
                    Pattern.CASE_INSENSITIVE
            );
            Matcher m3 = p3.matcher(text);
            while (m3.find()) {
                StaffDTO s = new StaffDTO();
                s.setName(m3.group(1).trim());
                s.setRole("Formateur");
                if (m3.group(2) != null) {
                    try { s.setBudget(parseAmount(m3.group(2))); } catch (Exception ignored) { s.setBudget(0.0); }
                } else {
                    s.setBudget(0.0);
                }
                staff.add(s);
            }
        }

        return staff.isEmpty() ? null : staff;
    }

    // ── Devis extraction ───────────────────────────────────────────────────

    private DevisDTO extractDevis(String text, int num) {
        DevisDTO d = new DevisDTO();

        String nStr = String.valueOf(num);
        String nWord = num == 1 ? "(?:1|one|un|premier|1er)" : num == 2 ? "(?:2|two|deux|deuxième|2ème)" : "(?:3|three|trois|troisième|3ème)";

        // Supplier name
        d.setSupplierName(first(text,
                "(?:supplier[\\s_]?" + nStr + "|fournisseur[\\s_]?" + nStr + "|devis[\\s_]?" + nStr + "|offre[\\s_]?" + nStr + ")\\s*[:\\-]\\s*([^|;,\\n]{3,80})"
        ));

        // Amount
        String amt = first(text,
                "(?:amount[\\s_]?" + nStr + "|montant[\\s_]?" + nStr + "|devis[\\s_]?" + nStr + "[\\s_]?(?:amount|montant)|prix[\\s_]?" + nStr + ")\\s*[:\\-]\\s*([0-9][0-9 .,]*)"
        );
        if (amt != null) {
            try { d.setAmount(parseAmount(amt)); } catch (Exception ignored) {}
        }

        // Contact name
        d.setContactName(first(text,
                "(?:contact[\\s_]?" + nStr + "|nom[\\s_]?contact[\\s_]?" + nStr + "|interlocuteur[\\s_]?" + nStr + ")\\s*[:\\-]\\s*([^|;,\\n]{3,60})"
        ));

        // Phone
        d.setContactPhone(first(text,
                "(?:phone[\\s_]?" + nStr + "|tel[\\s_]?" + nStr + "|mobile[\\s_]?" + nStr + "|téléphone[\\s_]?" + nStr + ")\\s*[:\\-]\\s*([+0-9][\\s\\-()0-9]{6,24})"
        ));

        // Email
        d.setContactEmail(first(text,
                "(?:email[\\s_]?" + nStr + "|mail[\\s_]?" + nStr + ")\\s*[:\\-]\\s*([A-Z0-9._%+\\-]+@[A-Z0-9.\\-]+\\.[A-Z]{2,})",
                null  // email extraction below handles generic case for d1
        ));
        if (d.getContactEmail() == null && num == 1) {
            // Grab the first email anywhere in text for supplier 1
            d.setContactEmail(first(text,
                    "([A-Z0-9._%+\\-]+@[A-Z0-9.\\-]+\\.[A-Z]{2,})"
            ));
        }

        // Valid until
        String vu = firstDate(text,
                "(?:valid[\\s_]?until[\\s_]?" + nStr + "|validité[\\s_]?" + nStr + "|expire[\\s_]?" + nStr + ")\\s*[:\\-]\\s*"
        );
        d.setValidUntil(vu);

        // Delivery included
        String di = first(text,
                "(?:delivery[\\s_]?included[\\s_]?" + nStr + "|livraison[\\s_]?incluse[\\s_]?" + nStr + ")\\s*[:\\-]\\s*(yes|oui|true|non|no|false)"
        );
        if (di != null) d.setDeliveryIncluded(di.matches("(?i)yes|oui|true"));

        // Notes
        d.setNotes(first(text,
                "(?:supplier[\\s_]?" + nStr + "[\\s_]?notes?|devis[\\s_]?" + nStr + "[\\s_]?notes?|notes?[\\s_]?" + nStr + ")\\s*[:\\-]\\s*([^|;\\n]{3,200})"
        ));

        return d.getSupplierName() != null ? d : null;
    }

    /** Fallback: extract a generic supplier block when no numbered ones found */
    private DevisDTO extractGenericSupplier(String text) {
        // First try the structured devis document pattern (typical French devis PDF)
        DevisDTO docDevis = extractFromDevisDocument(text);
        if (docDevis != null) return docDevis;

        DevisDTO d = new DevisDTO();
        d.setSupplierName(first(text,
                "(?:lender|vendor|supplier|fournisseur|prêteur|preteur|from|fourni[\\s_]?par)\\s*[:\\-]\\s*([^|;,\\n]{3,80})"
        ));
        if (d.getSupplierName() == null) return null;

        String amt = first(text,
                "(?:price|amount|montant|prix|coût|tarif)\\s*[:\\-]\\s*([0-9][0-9 .,]*)"
        );
        if (amt != null) {
            try { d.setAmount(parseAmount(amt)); } catch (Exception ignored) {}
        }

        d.setContactPhone(first(text,
                "(?:phone|tel|mobile|téléphone)\\s*[:\\-]\\s*([+0-9][\\s\\-()0-9]{6,24})"
        ));
        d.setContactEmail(first(text,
                "([A-Z0-9._%+\\-]+@[A-Z0-9.\\-]+\\.[A-Z]{2,})"
        ));
        return d;
    }

    /**
     * Extracts supplier info from a typical French devis (quote) PDF document.
     * These documents have:
     * - Company name as first text line
     * - "DEVIS N." header
     * - "FOURNISSEUR" section with contact info
     * - "Sous-total HT:" with the amount
     * - "Contact:" line
     * - "Tel:" and email in header
     * - "Valide jusqu'au:" date
     */
    private DevisDTO extractFromDevisDocument(String text) {
        // Only apply if this looks like a DEVIS document
        if (!Pattern.compile("DEVIS\\s+N", Pattern.CASE_INSENSITIVE).matcher(text).find()) {
            return null;
        }

        DevisDTO d = new DevisDTO();

        // Extract company name: first substantial line of text (the company header)
        // In PDFBox output, the company name appears as the first line
        String[] lines = text.split("\\n");
        for (String line : lines) {
            String trimmed = line.trim();
            // Skip empty lines and very short text, skip page numbers
            if (trimmed.length() >= 3 && !trimmed.matches("^\\d+$") && !trimmed.matches("(?i)^page.*")) {
                d.setSupplierName(trimmed);
                break;
            }
        }

        // Extract amount from "Sous-total HT:" or "TOTAL TTC:"
        String htAmt = first(text,
                "(?:sous[\\s\\-_]?total[\\s_]?HT|total[\\s_]?HT|montant[\\s_]?HT)\\s*[:\\-]?\\s*([0-9][0-9 .,]+)\\s*(?:TND|DT|€)?",
                "TOTAL\\s+TTC\\s*[:\\-]?\\s*([0-9][0-9 .,]+)\\s*(?:TND|DT|€)?"
        );
        if (htAmt != null) {
            try { d.setAmount(parseAmount(htAmt)); } catch (Exception ignored) {}
        }

        // Extract contact name: "Contact: Name"
        d.setContactName(first(text,
                "Contact\\s*[:\\-]\\s*([A-Za-zÀ-ÖØ-öø-ÿ .'-]{3,60})"
        ));

        // Extract phone: "Tel: +216 ..."
        d.setContactPhone(first(text,
                "Tel\\s*[:\\-]\\s*([+0-9][\\s\\-()0-9]{6,24})"
        ));

        // Extract email
        d.setContactEmail(first(text,
                "([A-Z0-9._%+\\-]+@[A-Z0-9.\\-]+\\.[A-Z]{2,})"
        ));

        // Extract validity date: "Valide jusqu'au: DD/MM/YYYY"
        String vu = firstDate(text,
                "(?:Valide?\\s+jusqu|valid[ée]?\\s+jusqu).*?\\s*[:\\-]?\\s*"
        );
        if (vu == null) {
            vu = firstDate(text, "(?:validit[eé])\\s*[:\\-]\\s*");
        }
        d.setValidUntil(vu);

        // Delivery included: check for "Livraison" followed by "incluse"
        String deliveryText = first(text,
                "(?:Livraison|livraison)\\s*[:\\-]\\s*([^\\n]{3,80})"
        );
        if (deliveryText != null) {
            d.setDeliveryIncluded(deliveryText.toLowerCase().contains("inclus") ||
                    deliveryText.toLowerCase().contains("offert") ||
                    deliveryText.toLowerCase().contains("gratuit"));
        }

        // Notes from "Prestations incluses:"
        d.setNotes(first(text,
                "(?:Prestations?\\s+incluses?|Inclus|Services?\\s+inclus)\\s*[:\\-]\\s*([^\\n]{5,300})"
        ));

        return d.getSupplierName() != null ? d : null;
    }

    // ── Helpers ────────────────────────────────────────────────────────────

    /** Returns the first matching group from any of the provided regex strings. */
    private String first(String text, String... patterns) {
        for (String p : patterns) {
            if (p == null) continue;
            Matcher m = Pattern.compile(p, Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE).matcher(text);
            if (m.find()) return m.group(1).trim();
        }
        return null;
    }

    /**
     * Finds a date in DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD formats
     * after a given label regex prefix.
     */
    private String firstDate(String text, String labelPrefix) {
        // ISO
        Matcher m1 = Pattern.compile(labelPrefix + "(\\d{4}-\\d{2}-\\d{2})", Pattern.CASE_INSENSITIVE).matcher(text);
        if (m1.find()) return m1.group(1);
        // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
        Matcher m2 = Pattern.compile(labelPrefix + "(\\d{1,2}[/\\-.](\\d{1,2})[/\\.\\-](\\d{2,4}))", Pattern.CASE_INSENSITIVE).matcher(text);
        if (m2.find()) return parseDate(m2.group(1));
        return null;
    }

    private String detectCategory(String text) {
        String lower = text.toLowerCase();
        if (lower.matches(".*(projector|camera|audio|sound|microphone|speaker|video|screen|laptop|sono|projecteur|caméra|écran|sono).*"))
            return "audio_visual";
        if (lower.matches(".*(chair|table|furniture|sofa|desk|chaise|mobilier|bureau|siège|meubles?).*"))
            return "furniture";
        if (lower.matches(".*(decor|decoration|banner|flower|balloon|floral|décor|bannière|fleur|ballon).*"))
            return "decoration";
        if (lower.matches(".*(food|catering|plate|cup|kitchen|restauration|assiette|traiteur|cuisine|repas).*"))
            return "catering";
        if (lower.matches(".*(tool|drill|hammer|wrench|screwdriver|outil|perceuse|marteau|clé[\\s_]?usage).*"))
            return "tools";
        if (lower.matches(".*(equipment|generator|tent|stand|générateur|tente|équipement|podium|scène).*"))
            return "equipment";
        if (lower.matches(".*(car|truck|van|vehicle|voiture|camion|véhicule|bus|minibus|transport).*"))
            return "vehicles";
        return "other";
    }

    private String parseDate(String dateStr) {
        try {
            String[] parts = dateStr.split("[/\\-.]");
            if (parts.length == 3) {
                String year = parts[2].length() == 2 ? "20" + parts[2] : parts[2];
                // If first part looks like a year (4 digits), it's already YYYY-MM-DD
                if (parts[0].length() == 4) return dateStr;
                return String.format("%s-%02d-%02d", year, Integer.parseInt(parts[1]), Integer.parseInt(parts[0]));
            }
        } catch (Exception ignored) {}
        return dateStr;
    }

    /** Parses "1 500,000" / "1500.00" / "1,500" into a Double */
    private double parseAmount(String raw) {
        String cleaned = raw.trim()
                .replaceAll("\\s", "")        // remove spaces (thousand sep)
                .replace(",", ".");            // comma → dot
        // If there are multiple dots, keep only the last (e.g. "1.500.000" → "1500.000")
        int lastDot = cleaned.lastIndexOf('.');
        if (lastDot >= 0) {
            cleaned = cleaned.substring(0, lastDot).replace(".", "") + cleaned.substring(lastDot);
        }
        return Double.parseDouble(cleaned);
    }
}
