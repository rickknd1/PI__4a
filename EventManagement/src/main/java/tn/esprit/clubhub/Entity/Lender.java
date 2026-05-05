package tn.esprit.clubhub.Entity;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;
import lombok.Data;

@Document(collection = "lenders")
@Data
public class Lender {

    @Id
    private String id;

    private String name;
    private String type;             // individual / company / organization
    private String phone;
    private String email;
    private String address;
    private boolean active;  // or Boolean active if you need null values

    @Field("contact_person")
    private String contactPerson;

    // ── Stats (updated when items are returned) ────────────────────────────
    @Field("total_borrows")
    private Integer totalBorrows = 0;

    @Field("on_time_returns")
    private Integer onTimeReturns = 0;

    // high / medium / low  – recalculated on return
    private String reliability = "medium";

    @Field("is_active")
    private Boolean isActive = true;

    private String notes;
    public void setActive(boolean active) {
        this.active = active;
    }
}
