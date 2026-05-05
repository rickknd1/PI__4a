package tn.esprit.virtual_event_management.controller;

import lombok.AllArgsConstructor;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import tn.esprit.virtual_event_management.Dto.DashboardEventDto;
import tn.esprit.virtual_event_management.entity.DashboardStats;
import tn.esprit.virtual_event_management.entity.VirtualEvent;
import tn.esprit.virtual_event_management.service.DashboardService;
import tn.esprit.virtual_event_management.service.IVirtualEventService;

import java.util.List;
@AllArgsConstructor
@RestController
@RequestMapping("/api/dashboard")
public class DashboardController {
    private final DashboardService dashboardService;
    private final IVirtualEventService eventService;

    @GetMapping("/stats")
    public DashboardStats getStats() {
        return dashboardService.getStats();
    }

    @GetMapping("/events")
    public List<DashboardEventDto> getEvents() {
        List<VirtualEvent> events = eventService.getAllEvents();

        return events.stream()
                .map(e -> new DashboardEventDto(
                        e.getId(),
                        e.getTitle(),
                        e.getCategory(),
                        e.getScheduledAt(),
                        e.getEndAt(),
                        e.getMaxParticipants(),
                        e.getCurrentParticipants(),
                        e.getPrice(),
                        e.getIsPaid(),
                        e.getStatus()
                ))
                .toList();
    }
}
