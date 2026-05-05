package tn.esprit.virtual_event_management.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import tn.esprit.virtual_event_management.entity.Transcription;
import tn.esprit.virtual_event_management.repository.TranscriptionRepository;

import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class TranscriptionService implements ITranscriptionService{
    private final TranscriptionRepository transcriptionRepository;

    @Override
    public Transcription createTranscription(Transcription transcription) {
        return transcriptionRepository.save(transcription);
    }

    @Override
    public Transcription updateTranscription(String id, Transcription updatedTranscription) {
        Transcription existing = transcriptionRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Transcription not found with id: " + id));
        existing.setContent(updatedTranscription.getContent());
        existing.setPdfUrl(updatedTranscription.getPdfUrl());
        existing.setEventRecord(updatedTranscription.getEventRecord());
        return transcriptionRepository.save(existing);
    }

    @Override
    public void deleteTranscription(String id) {
        if (!transcriptionRepository.existsById(id)) {
            throw new RuntimeException("Transcription not found with id: " + id);
        }
        transcriptionRepository.deleteById(id);
    }

    @Override
    public Optional<Transcription> getTranscriptionById(String id) {
        return transcriptionRepository.findById(id);
    }

    @Override
    public List<Transcription> getAllTranscriptions() {
        return transcriptionRepository.findAll();
    }

    @Override
    public List<Transcription> getTranscriptionsByEventRecord(String eventRecordId) {
        return transcriptionRepository.findByEventRecordId(eventRecordId);
    }

    @Override
    public List<Transcription> searchByContent(String keyword) {
        return transcriptionRepository.findByContentContaining(keyword);
    }

}
