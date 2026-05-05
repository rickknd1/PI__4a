package tn.esprit.clubhub.Entity;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Document(collection = "borrowed_items")
@Data
public class BorrowedItem {

    @Id
    private String id;

    // ── Event ──────────────────────────────────────────────────────────────
    @Field("event_id")
    private String eventId;

    @Field("event_name")
    private String eventName;

    // ── Item info ──────────────────────────────────────────────────────────
    @Field("item_name")
    private String itemName;

    private String category;
    private Integer quantity;
    private String notes;

    // ── Location / allocation ──────────────────────────────────────────────
    @Field("allocation_location")
    private String allocationLocation;

    @Field("allocation_period_start")
    private LocalDateTime allocationPeriodStart;

    @Field("allocation_period_end")
    private LocalDateTime allocationPeriodEnd;

    @Field("is_allocated")
    private Boolean isAllocated;

    // ── Location budget ────────────────────────────────────────────────────
    @Field("location_budget")
    private Double locationBudget;

    // ── Staff / Human Resources ────────────────────────────────────────────
    private List<StaffMember> staff;

    // ── Estimated budget ───────────────────────────────────────────────────
    @Field("estimated_budget")
    private Double estimatedBudget;

    // ── Lender ────────────────────────────────────────────────────────────
    @Field("lender_name")
    private String lenderName;

    @Field("lender_type")
    private String lenderType;

    @Field("lender_contact_person")
    private String lenderContactPerson;

    @Field("lender_phone")
    private String lenderPhone;

    @Field("lender_email")
    private String lenderEmail;

    @Field("lender_address")
    private String lenderAddress;

    // ── Dates ──────────────────────────────────────────────────────────────
    @Field("borrowed_date")
    private LocalDateTime borrowedDate;

    @Field("expected_return_date")
    private LocalDateTime expectedReturnDate;

    @Field("actual_return_date")
    private LocalDateTime actualReturnDate;

    // ── Financial ─────────────────────────────────────────────────────────
    @Field("rental_fee")
    private Double rentalFee;

    private Double deposit;

    @Field("is_paid")
    private Boolean isPaid;

    @Field("delivery_method")
    private String deliveryMethod;

    // ── Status & tracking ─────────────────────────────────────────────────
    private String status;

    @Field("reminder_sent")
    private Boolean reminderSent;

    // ── Validated devis reference ──────────────────────────────────────────
    @Field("validated_devis_id")
    private String validatedDevisId;

    @Field("validation_note")
    private String validationNote;

    // ── Metadata ───────────────────────────────────────────────────────────
    @Field("created_at")
    private LocalDateTime createdAt;

    @Field("updated_at")
    private LocalDateTime updatedAt;

    // ── Constructors ──────────────────────────────────────────────────────
    public BorrowedItem() {
        this.status = "requested";
        this.isPaid = false;
        this.reminderSent = false;
        this.isAllocated = false;
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }

    // ── Nested StaffMember ─────────────────────────────────────────────────
    @Data
    public static class StaffMember {
        private String name;
        private String role;
        private Double budget;
    }
}
