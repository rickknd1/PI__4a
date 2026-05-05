package tn.esprit.virtual_event_management.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import tn.esprit.virtual_event_management.entity.EventRecord;
import tn.esprit.virtual_event_management.repository.EventRecordRepository;

import java.util.List;
import java.util.Optional;


@Service
@RequiredArgsConstructor
public class EventRecordService implements IEventRecordService {

    private final EventRecordRepository eventRecordRepository;

    @Override
    public EventRecord createRecord(EventRecord record) {
        return eventRecordRepository.save(record);
    }

    @Override
    public EventRecord updateRecord(String id, EventRecord updatedRecord) {
        EventRecord existing = eventRecordRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Record not found with id: " + id));
        existing.setFileUrl(updatedRecord.getFileUrl());
        existing.setGdprConsent(updatedRecord.getGdprConsent());
        existing.setVirtualEvent(updatedRecord.getVirtualEvent());
        return eventRecordRepository.save(existing);
    }

    @Override
    public void deleteRecord(String id) {
        if (!eventRecordRepository.existsById(id)) {
            throw new RuntimeException("Record not found with id: " + id);
        }
        eventRecordRepository.deleteById(id);
    }

    @Override
    public Optional<EventRecord> getRecordById(String id) {
        return eventRecordRepository.findById(id);
    }

    @Override
    public List<EventRecord> getAllRecords() {
        return eventRecordRepository.findAll();
    }

    @Override
    public List<EventRecord> getRecordsByGdprConsent(Boolean gdprConsent) {
        return eventRecordRepository.findByGdprConsent(gdprConsent);
    }

    @Override
    public List<EventRecord> getRecordsByVirtualEvent(int virtualEventId) {
        return eventRecordRepository.findByVirtualEventId(virtualEventId);
    }
}
