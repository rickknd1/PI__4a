package tn.esprit.virtual_event_management.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;
import tn.esprit.virtual_event_management.entity.EventRecord;
import tn.esprit.virtual_event_management.entity.SupportedLanguage;
import tn.esprit.virtual_event_management.entity.Transcription;
import tn.esprit.virtual_event_management.repository.TranscriptionRepository;

import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class SpeechToTextService {
    @Value("${whisper.api.url}")
    private String whisperApiUrl;

    @Value("${huggingface.api.url}")
    private String hfApiUrl;

    @Value("${huggingface.api.token}")
    private String hfToken;

    private final TranscriptionRepository transcriptionRepository;
    private final RestTemplate restTemplate;

    public Transcription transcribe(MultipartFile audioFile,
                                    EventRecord record,
                                    SupportedLanguage language) throws Exception {

        String transcribedText;

        try {
            log.info("🎙️ Whisper local...");
            transcribedText = callWhisperLocal(audioFile, language.getCode());
        } catch (Exception e) {
            log.warn("⚠️ Fallback HuggingFace...");
            transcribedText = callHuggingFace(audioFile.getBytes());
        }

        // 🔴 SECURITE IMPORTANTE
        if (transcribedText == null || transcribedText.trim().isEmpty()) {
            throw new RuntimeException("Transcription vide !");
        }

        log.info("✅ TEXTE = {}", transcribedText);

        Transcription transcription = new Transcription();
        transcription.setContent(transcribedText);
        transcription.setEventRecord(record);

        return transcriptionRepository.save(transcription);
    }

    // ================= WHISPER =================
    private String callWhisperLocal(MultipartFile audioFile, String langCode) throws Exception {

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.MULTIPART_FORM_DATA);

        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        body.add("file", new ByteArrayResource(audioFile.getBytes()) {
            @Override
            public String getFilename() {
                return audioFile.getOriginalFilename();
            }
        });

        body.add("model", "large-v3");

        if (!"auto".equals(langCode)) {
            body.add("language", langCode);
        }

        HttpEntity<MultiValueMap<String, Object>> request =
                new HttpEntity<>(body, headers);

        ResponseEntity<Map> response =
                restTemplate.postForEntity(whisperApiUrl, request, Map.class);

        if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {

            Object text = response.getBody().get("text");

            if (text == null) {
                throw new RuntimeException("Whisper n'a retourné aucun texte");
            }

            return text.toString();
        }

        throw new RuntimeException("Erreur Whisper : " + response.getStatusCode());
    }

    // ================= HUGGINGFACE =================
    private String callHuggingFace(byte[] audioBytes) {

        HttpHeaders headers = new HttpHeaders();
        headers.set("Authorization", "Bearer " + hfToken);
        headers.setContentType(MediaType.APPLICATION_OCTET_STREAM);

        HttpEntity<byte[]> request = new HttpEntity<>(audioBytes, headers);

        ResponseEntity<Map> response =
                restTemplate.postForEntity(hfApiUrl, request, Map.class);

        if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {

            Object text = response.getBody().get("text");

            if (text == null) {
                throw new RuntimeException("HuggingFace n'a retourné aucun texte");
            }

            return text.toString();
        }

        throw new RuntimeException("Erreur HuggingFace");
    }
}
