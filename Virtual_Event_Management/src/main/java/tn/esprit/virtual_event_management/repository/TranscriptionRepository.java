package tn.esprit.virtual_event_management.repository;

import org.springframework.data.mongodb.repository.MongoRepository;
import tn.esprit.virtual_event_management.entity.Transcription;

import java.util.List;

public interface TranscriptionRepository extends MongoRepository<Transcription, String> {
    List<Transcription> findByEventRecordId(String eventRecordId);
    List<Transcription> findByContentContaining(String keyword);
}
