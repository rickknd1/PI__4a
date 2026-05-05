package tn.esprit.virtual_event_management.service;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import tn.esprit.virtual_event_management.entity.DashboardStats;
import tn.esprit.virtual_event_management.entity.EventRegistration;
import tn.esprit.virtual_event_management.entity.VirtualEvent;
import tn.esprit.virtual_event_management.repository.EventRegistrationRepository;
import tn.esprit.virtual_event_management.repository.VirtualEventRepository;

import java.util.List;

@Service
@RequiredArgsConstructor
public class DashboardService {
    private final VirtualEventRepository eventRepo;
    private final EventRegistrationRepository regRepo;

    public DashboardStats getStats() {

        List<VirtualEvent> events = eventRepo.findAll();
        List<EventRegistration> regs = regRepo.findAll();

        long totalEvents = events.size();
        long totalRegistrations = regs.size();

        // 🔥 total participants
        long totalParticipants = events.stream()
                .mapToLong(e -> e.getCurrentParticipants() != null ? e.getCurrentParticipants() : 0)
                .sum();

        // 🔥 revenue
        double totalRevenue = regs.stream()
                .filter(EventRegistration::isPaid)
                .mapToDouble(r -> {
                    return events.stream()
                            .filter(e -> e.getId().equals(r.getEventId()))
                            .findFirst()
                            .map(e -> e.getPrice() != null ? e.getPrice() : 0)
                            .orElse(0.0);
                }).sum();

        return new DashboardStats(
                totalEvents,
                totalRegistrations,
                totalParticipants,
                totalRevenue
        );
    }
}
