package tn.esprit.clubhub.DTO;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
public class ExtractedDataV2DTO {

    // Event matching
    private String eventNameRaw;
    private String matchedEventId;
    private String matchedEventName;
    private Double eventMatchScore; // 0..1

    // Multi sections
    private List<ItemExtractDTO> items = new ArrayList<>();
    private LocationExtractDTO location = new LocationExtractDTO();
    private List<OfferDTO> locationOffers = new ArrayList<>();
    private List<OfferDTO> staffOffers = new ArrayList<>();
    private List<StaffDTO> staff = new ArrayList<>();

    // Generic metadata
    private String deliveryMethod; // pickup | delivery
    private String notes;

    @Data
    public static class ItemExtractDTO {
        private String itemName;
        private String category;
        private Integer quantity;
        private String expectedReturnDate; // YYYY-MM-DD
        private String expectedReturnTime; // HH:mm
        private Double rentalFee;
        private String notes;
        private List<OfferDTO> offers = new ArrayList<>();
    }

    @Data
    public static class LocationExtractDTO {
        private String allocationLocation;
        private String allocationPeriodStart; // YYYY-MM-DD
        private String allocationPeriodEnd;   // YYYY-MM-DD
        private Boolean isAllocated;
        private Double locationBudget;
        private String notes;
    }

    @Data
    public static class OfferDTO {
        // Scope helps frontend assignment
        private String scope; // item | location | staff | global
        private String targetRef; // e.g. item index/name if known

        // Supplier data
        private String supplierName;
        private Double amount;
        private String contactName;
        private String contactPhone;
        private String contactEmail;
        private String validUntil; // YYYY-MM-DD
        private Boolean deliveryIncluded;
        private String notes;

        // "Best offer" scoring (not only price)
        private Double score;         // 0..100
        private String recommendation; // e.g. "Best value", "Cheapest but risky"
        private List<String> riskFlags = new ArrayList<>();
    }

    @Data
    public static class StaffDTO {
        private String name;
        private String role;
        private Double budget;
    }
}