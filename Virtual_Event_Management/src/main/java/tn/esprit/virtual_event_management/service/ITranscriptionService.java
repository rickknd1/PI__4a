package tn.esprit.virtual_event_management.service;

import tn.esprit.virtual_event_management.entity.Transcription;

import java.util.List;
import java.util.Optional;

public interface ITranscriptionService {
    Transcription createTranscription(Transcription transcription);
    Transcription updateTranscription(String id, Transcription transcription);
    void deleteTranscription(String id);
    Optional<Transcription> getTranscriptionById(String id);
    List<Transcription> getAllTranscriptions();
    List<Transcription> getTranscriptionsByEventRecord(String eventRecordId);
    List<Transcription> searchByContent(String keyword);
}
