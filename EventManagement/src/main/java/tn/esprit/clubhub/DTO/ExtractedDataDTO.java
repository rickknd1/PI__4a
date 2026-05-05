package tn.esprit.clubhub.DTO;

import lombok.Data;
import java.util.List;

@Data
public class ExtractedDataDTO {

    // ── Event ──────────────────────────────────────────────────────────────
    private String eventId;
    private String eventName;

    // ── Item ───────────────────────────────────────────────────────────────
    private String itemName;
    private String category;
    private Integer quantity;
    private String notes;

    // ── Location / Allocation ──────────────────────────────────────────────
    private String allocationLocation;
    private String allocationPeriodStart;   // YYYY-MM-DD
    private String allocationPeriodEnd;     // YYYY-MM-DD
    private Boolean isAllocated;

    // ── Budget ─────────────────────────────────────────────────────────────
    private Double locationBudget;          // venue / room rental cost
    private Double estimatedBudget;         // total = item + location + staff
    private Double rentalFee;              // item rental cost only

    // ── Staff / HR ─────────────────────────────────────────────────────────
    private List<StaffDTO> staff;

    // ── Dates ──────────────────────────────────────────────────────────────
    private String expectedReturnDate;      // YYYY-MM-DD
    private String expectedReturnTime;      // HH:mm
    private String borrowedDate;

    // ── Delivery ───────────────────────────────────────────────────────────
    private String deliveryMethod;

    // ── Lender (pre-filled from first devis supplier) ─────────────────────
    private String lenderName;
    private String lenderPhone;
    private String lenderEmail;
    private String lenderType;
    private String lenderContactPerson;
    private String lenderAddress;

    // ── Pre-extracted devis (up to 3) ──────────────────────────────────────
    private DevisDTO devis1;
    private DevisDTO devis2;
    private DevisDTO devis3;

    // ── Nested DTOs ────────────────────────────────────────────────────────

    @Data
    public static class DevisDTO {
        private String supplierName;
        private Double amount;
        private String contactName;
        private String contactPhone;
        private String contactEmail;
        private String validUntil;
        private Boolean deliveryIncluded;
        private String notes;
    }

    @Data
    public static class StaffDTO {
        private String name;
        private String role;
        private Double budget;
    }
}
