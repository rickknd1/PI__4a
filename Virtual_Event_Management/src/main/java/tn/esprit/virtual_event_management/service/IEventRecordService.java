package tn.esprit.virtual_event_management.service;

import tn.esprit.virtual_event_management.entity.EventRecord;

import java.util.List;
import java.util.Optional;

public interface IEventRecordService {
    EventRecord createRecord(EventRecord record);
    EventRecord updateRecord(String id, EventRecord record);
    void deleteRecord(String id);
    Optional<EventRecord> getRecordById(String id);
    List<EventRecord> getAllRecords();
    List<EventRecord> getRecordsByGdprConsent(Boolean gdprConsent);
    List<EventRecord> getRecordsByVirtualEvent(int virtualEventId);
}
