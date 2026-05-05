package tn.esprit.virtual_event_management.entity;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class DashboardStats {
    private long totalEvents;
    private long totalRegistrations;
    private long totalParticipants;
    private double totalRevenue;

}
