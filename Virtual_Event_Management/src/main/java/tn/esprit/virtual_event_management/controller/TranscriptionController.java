package tn.esprit.virtual_event_management.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import tn.esprit.virtual_event_management.entity.EventRecord;
import tn.esprit.virtual_event_management.entity.SupportedLanguage;
import tn.esprit.virtual_event_management.entity.Transcription;
import tn.esprit.virtual_event_management.repository.EventRecordRepository;
import tn.esprit.virtual_event_management.service.ITranscriptionService;
import tn.esprit.virtual_event_management.service.PdfService;
import tn.esprit.virtual_event_management.service.SpeechToTextService;

import java.util.List;

@RestController
@RequestMapping("/api/transcriptions")
@RequiredArgsConstructor
public class TranscriptionController {
    private final ITranscriptionService transcriptionService;
    private final SpeechToTextService speechToTextService;
    private final EventRecordRepository recordRepository;
    private final PdfService pdfService;

    // ================= CRUD =================

    @PostMapping
    public ResponseEntity<Transcription> createTranscription(@RequestBody Transcription transcription) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(transcriptionService.createTranscription(transcription));
    }

    @PutMapping("/{id}")
    public ResponseEntity<Transcription> updateTranscription(@PathVariable String id,
                                                             @RequestBody Transcription transcription) {
        return ResponseEntity.ok(transcriptionService.updateTranscription(id, transcription));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteTranscription(@PathVariable String id) {
        transcriptionService.deleteTranscription(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}")
    public ResponseEntity<Transcription> getTranscriptionById(@PathVariable String id) {
        return transcriptionService.getTranscriptionById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping
    public ResponseEntity<List<Transcription>> getAllTranscriptions() {
        return ResponseEntity.ok(transcriptionService.getAllTranscriptions());
    }

    @GetMapping("/record/{eventRecordId}")
    public ResponseEntity<List<Transcription>> getByEventRecord(@PathVariable String eventRecordId) {
        return ResponseEntity.ok(transcriptionService.getTranscriptionsByEventRecord(eventRecordId));
    }

    @GetMapping("/search")
    public ResponseEntity<List<Transcription>> searchByContent(@RequestParam String keyword) {
        return ResponseEntity.ok(transcriptionService.searchByContent(keyword));
    }

    // ================= TRANSCRIPTION =================

    @PostMapping("/{recordId}")
    public ResponseEntity<Transcription> transcribe(
            @PathVariable String recordId,
            @RequestParam(defaultValue = "auto") String language,
            @RequestPart("audio") MultipartFile audioFile) throws Exception {

        // Vérification que le record existe
        EventRecord record = recordRepository.findById(recordId)
                .orElseThrow(() -> new RuntimeException("Record introuvable"));

        SupportedLanguage lang = switch (language.toLowerCase()) {
            case "fr" -> SupportedLanguage.FRENCH;
            case "en" -> SupportedLanguage.ENGLISH;
            case "ar" -> SupportedLanguage.ARABIC;
            case "es" -> SupportedLanguage.SPANISH;
            case "de" -> SupportedLanguage.GERMAN;
            case "it" -> SupportedLanguage.ITALIAN;
            default -> SupportedLanguage.AUTO;
        };

        // Appel du service qui transcrit et enregistre directement
        Transcription savedTranscription = speechToTextService.transcribe(audioFile, record, lang);

        return ResponseEntity.status(HttpStatus.CREATED).body(savedTranscription);
    }

    // ================= PDF =================

    @GetMapping("/{id}/pdf")
    public ResponseEntity<byte[]> downloadPdf(@PathVariable String id) {
        Transcription t = transcriptionService.getTranscriptionById(id)
                .orElseThrow(() -> new RuntimeException("Transcription introuvable"));

        byte[] pdf = pdfService.generatePdf(t.getContent());

        return ResponseEntity.ok()
                .header("Content-Disposition", "attachment; filename=transcription.pdf")
                .body(pdf);
    }

    // ================= LANGUAGES =================

    @GetMapping("/languages")
    public ResponseEntity<SupportedLanguage[]> getSupportedLanguages() {
        return ResponseEntity.ok(SupportedLanguage.values());
    }

    @GetMapping("/record/{recordId}/pdf")
    public ResponseEntity<byte[]> downloadPdfByRecord(@PathVariable String recordId) {

        Transcription t = transcriptionService
                .getTranscriptionsByEventRecord(recordId)
                .stream()
                .findFirst()
                .orElseThrow(() -> new RuntimeException("Transcription introuvable"));

        // 🔥 DEBUG
        System.out.println("PDF CONTENT = " + t.getContent());

        byte[] pdf = pdfService.generatePdf(t.getContent());

        return ResponseEntity.ok()
                .header("Content-Disposition", "attachment; filename=transcription.pdf")
                .body(pdf);
    }
}
