package tn.esprit.clubhub.Entity;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;
import lombok.Data;
import java.time.LocalDateTime;

@Document(collection = "devis")
@Data
public class Devis {

    @Id
    private String id;

    @Field("borrowed_item_id")
    private String borrowedItemId;

    @Field("supplier_name")
    private String supplierName;

    private Double amount;

    @Field("valid_until")
    private String validUntil;

    @Field("contact_name")
    private String contactName;

    @Field("contact_phone")
    private String contactPhone;

    @Field("contact_email")
    private String contactEmail;

    @Field("delivery_included")
    private Boolean deliveryIncluded;

    private String notes;

    // pending / validated / rejected
    private String status = "pending";

    @Field("validation_note")
    private String validationNote;

    @Field("created_at")
    private LocalDateTime createdAt;

    @Field("validated_at")
    private LocalDateTime validatedAt;
}
