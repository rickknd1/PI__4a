package tn.esprit.virtual_event_management.Dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class DashboardEventDto {
    private String id;
    private String title;
    private String category;
    private LocalDateTime scheduledAt;
    private LocalDateTime endAt;
    private Integer maxParticipants;
    private Integer currentParticipants;
    private Double price;
    private Boolean isPaid;
    private String status;
}
