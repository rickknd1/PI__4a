package tn.esprit.virtual_event_management.repository;

import org.springframework.data.mongodb.repository.MongoRepository;
import tn.esprit.virtual_event_management.entity.EventRecord;
import tn.esprit.virtual_event_management.entity.Transcription;

import java.util.List;
import java.util.Optional;

public interface EventRecordRepository extends MongoRepository<EventRecord, String> {
    List<EventRecord> findByGdprConsent(Boolean gdprConsent);
    List<EventRecord> findByVirtualEventId(int virtualEventId);
}
