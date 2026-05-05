package tn.esprit.clubhub.Entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/**
 * Staff line on an event (calendar): name, role, optional planned budget (TND)
 * for reuse in borrowed-items / needs.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public class EventStaffMember {

    private String name;
    private String role;
    /** Optional per-person budget in TND, set on the calendar or later in needs. */
    private Double budget;

    public EventStaffMember() {}

    public EventStaffMember(String name, String role, Double budget) {
        this.name = name;
        this.role = role;
        this.budget = budget;
    }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }

    public Double getBudget() { return budget; }
    public void setBudget(Double budget) { this.budget = budget; }
}
