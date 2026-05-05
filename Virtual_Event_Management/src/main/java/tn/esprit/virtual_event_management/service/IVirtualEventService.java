package tn.esprit.virtual_event_management.service;

import tn.esprit.virtual_event_management.entity.VirtualEvent;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface IVirtualEventService {
    VirtualEvent createEvent(VirtualEvent event);
    VirtualEvent updateEvent(String id, VirtualEvent event);
    void deleteEvent(String id);
    Optional<VirtualEvent> getEventById(String id);
    List<VirtualEvent> getAllEvents();
    List<VirtualEvent> getEventsByOrganizer(String organizerId);
    List<VirtualEvent> getEventsBetween(LocalDateTime start, LocalDateTime end);
    List<VirtualEvent> getRecordedEvents();
    VirtualEvent joinEvent(String eventId);
}
