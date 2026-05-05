package tn.esprit.virtual_event_management.service;

import tn.esprit.virtual_event_management.entity.EventRegistration;
import tn.esprit.virtual_event_management.entity.VirtualEvent;

public interface IEventRegistrationService {

    EventRegistration markAsPaid(String eventId, String userId);

    VirtualEvent joinEvent(String eventId, String userId);

    boolean canJoin(String eventId, String userId);

    EventRegistration register(String eventId, String userId);
}
