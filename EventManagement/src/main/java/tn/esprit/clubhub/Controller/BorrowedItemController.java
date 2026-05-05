package tn.esprit.clubhub.Controller;

import tn.esprit.clubhub.DTO.ExtractedDataDTO;
import tn.esprit.clubhub.Entity.BorrowedItem;
import tn.esprit.clubhub.Entity.Event;
import tn.esprit.clubhub.Repository.BorrowedItemRepository;
import tn.esprit.clubhub.Repository.EventRepository;
import tn.esprit.clubhub.Service.AIExtractorService;
import tn.esprit.clubhub.Service.BorrowedItemsPdfService;
import tn.esprit.clubhub.Service.EmailService;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import tn.esprit.clubhub.DTO.ExtractedDataV2DTO;
import tn.esprit.clubhub.Service.SmartExtractionService;
import tn.esprit.clubhub.Service.EventMatcherService;
import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.IOException;
import java.time.LocalDateTime;
import java.util.*;

@RestController
@RequestMapping("/api")
public class BorrowedItemController {

    @Autowired
    private BorrowedItemRepository borrowedItemRepository;

    @Autowired
    private EventRepository clubEventRepository;   // to match event name → id

    @Autowired
    private AIExtractorService aiExtractorService;
    @Autowired
    private SmartExtractionService smartExtractionService;

    @Autowired
    private EventMatcherService eventMatcherService;

    @Autowired
    private BorrowedItemsPdfService borrowedItemsPdfService;
    @Autowired
    private EmailService emailService;
    // ── GET all ───────────────────────────────────────────────────────────

    @GetMapping("/borrowed-items")
    public ResponseEntity<?> getAllBorrowedItems() {
        try {
            List<BorrowedItem> items = borrowedItemRepository.findAll();
            items.sort((a, b) -> {
                if (a.getBorrowedDate() == null) return 1;
                if (b.getBorrowedDate() == null) return -1;
                return b.getBorrowedDate().compareTo(a.getBorrowedDate());
            });
            return ResponseEntity.ok(items);
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", e.getMessage()));
        }
    }

    // ── POST create ───────────────────────────────────────────────────────

    @PostMapping("/borrowed-items")
    public ResponseEntity<?> createBorrowedItem(@RequestBody BorrowedItem item) {
        try {
            if (item.getBorrowedDate() == null) item.setBorrowedDate(LocalDateTime.now());
            BorrowedItem saved = borrowedItemRepository.save(item);
            return ResponseEntity.ok(saved);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", "Failed to save: " + e.getMessage()));
        }
    }

    // ── PUT update ────────────────────────────────────────────────────────

    @PutMapping("/borrowed-items/{id}")
    public ResponseEntity<?> updateItem(@PathVariable String id, @RequestBody BorrowedItem updated) {
        return borrowedItemRepository.findById(id).map(item -> {
            updated.setId(id);
            updated.setCreatedAt(item.getCreatedAt());
            return ResponseEntity.ok(borrowedItemRepository.save(updated));
        }).orElse(ResponseEntity.notFound().build());
    }

    // ── PATCH status ──────────────────────────────────────────────────────

    @PatchMapping("/borrowed-items/{id}/status")
    public ResponseEntity<?> updateStatus(@PathVariable String id, @RequestParam String status) {
        return borrowedItemRepository.findById(id).map(item -> {
            item.setStatus(status);
            return ResponseEntity.ok(borrowedItemRepository.save(item));
        }).orElse(ResponseEntity.status(404).body(null));
    }

    // ── PATCH return ──────────────────────────────────────────────────────

    @PatchMapping("/borrowed-items/{id}/return")
    public ResponseEntity<?> markAsReturned(@PathVariable String id, @RequestBody(required = false) Map<String,Object> body) {
        return borrowedItemRepository.findById(id).map(item -> {
            item.setStatus("returned");
            item.setActualReturnDate(LocalDateTime.now());
            if (body != null && body.get("isPaid") instanceof Boolean b) item.setIsPaid(b);
            return ResponseEntity.ok(borrowedItemRepository.save(item));
        }).orElse(ResponseEntity.status(404).body(null));
    }

    // ── PATCH return-date ─────────────────────────────────────────────────

    @PatchMapping("/borrowed-items/{id}/return-date")
    public ResponseEntity<?> updateReturnDate(@PathVariable String id, @RequestBody Map<String, String> body) {
        return borrowedItemRepository.findById(id).map(item -> {
            String dateStr = body.get("expectedReturnDate");
            if (dateStr != null) item.setExpectedReturnDate(LocalDateTime.parse(dateStr));
            return ResponseEntity.ok(borrowedItemRepository.save(item));
        }).orElse(ResponseEntity.status(404).body(null));
    }

    // ── PATCH payment ─────────────────────────────────────────────────────

    @PatchMapping("/borrowed-items/{id}/payment")
    public ResponseEntity<?> updatePayment(@PathVariable String id, @RequestBody Map<String,Object> body) {
        return borrowedItemRepository.findById(id).map(item -> {
            if (body.get("isPaid") instanceof Boolean b) item.setIsPaid(b);
            return ResponseEntity.ok(borrowedItemRepository.save(item));
        }).orElse(ResponseEntity.status(404).body(null));
    }

    // ── PATCH remind ──────────────────────────────────────────────────────

    @PostMapping("/borrowed-items/{id}/remind")
    public ResponseEntity<?> sendReminder(@PathVariable String id) {
        return borrowedItemRepository.findById(id).map(item -> {
            String email = item.getLenderEmail();
            if (email == null || email.isBlank()) {
                return ResponseEntity.badRequest().body(Map.of("error", "No lender email configured for this need"));
            }
            String eventName = null;
            if (item.getEventId() != null && !item.getEventId().isBlank()) {
                eventName = clubEventRepository.findById(item.getEventId()).map(Event::getTitle).orElse(item.getEventName());
            } else {
                eventName = item.getEventName();
            }
            emailService.sendBorrowReminder(email, item, eventName);
            item.setReminderSent(true);
            item.setUpdatedAt(LocalDateTime.now());
            borrowedItemRepository.save(item);
            return ResponseEntity.ok(Map.of("message", "Reminder sent", "emailedTo", email));
        }).orElse(ResponseEntity.status(404).body(null));
    }

    // ── PATCH validate-devis — choose devis + leave note ──────────────────

    @PatchMapping("/borrowed-items/{id}/validate-devis")
    public ResponseEntity<?> validateDevis(
            @PathVariable String id,
            @RequestBody Map<String, String> body) {
        return borrowedItemRepository.findById(id).map(item -> {
            item.setValidatedDevisId(body.get("devisId"));
            item.setValidationNote(body.get("note"));
            return ResponseEntity.ok(borrowedItemRepository.save(item));
        }).orElse(ResponseEntity.status(404).body(null));
    }

    // ── PATCH treasury-callback — Treasury notifies when expense is validated ──

    @PatchMapping("/borrowed-items/{id}/treasury-callback")
    public ResponseEntity<?> treasuryCallback(@PathVariable String id,
                                              @RequestBody Map<String, Object> body) {
        return borrowedItemRepository.findById(id).map(item -> {
            // body contains: expenseId, selectedQuoteIndex, approvedAmount, status
            if (body.get("status") != null) {
                String status = body.get("status").toString();
                if ("APPROVED".equalsIgnoreCase(status) || "VALIDATED".equalsIgnoreCase(status)) {
                    item.setIsPaid(true);
                }
            }
            if (body.get("expenseId") != null) {
                // Store the treasury expense ID reference in validationNote for traceability
                String note = item.getValidationNote() != null ? item.getValidationNote() : "";
                if (!note.contains("treasury:")) {
                    note = note + (note.isEmpty() ? "" : " | ") + "treasury:" + body.get("expenseId");
                    item.setValidationNote(note);
                }
            }
            if (body.get("selectedQuoteIndex") instanceof Number idx) {
                // Map the selected quote back to a devis ID if possible
                // The treasury selectedQuoteIndex corresponds to the order of devis
                // This is informational — the validatedDevisId was already set during devis validation
            }
            item.setUpdatedAt(LocalDateTime.now());
            borrowedItemRepository.save(item);
            return ResponseEntity.ok(Map.of("message", "Callback processed", "itemId", id));
        }).orElse(ResponseEntity.status(404).body(Map.of("error", "Item not found")));
    }

    // ── DELETE ────────────────────────────────────────────────────────────

    @DeleteMapping("/borrowed-items/{id}")
    public ResponseEntity<?> deleteItem(@PathVariable String id) {
        if (!borrowedItemRepository.existsById(id))
            return ResponseEntity.status(404).body(Map.of("error", "Not found"));
        borrowedItemRepository.deleteById(id);
        return ResponseEntity.ok(Map.of("message", "Deleted"));
    }

    // ── GET global borrowed-needs PDF ───────────────────────────────────────
    @GetMapping("/borrowed-items/export/pdf")
    public ResponseEntity<?> exportAllNeedsPdf() {
        try {
            byte[] pdf = borrowedItemsPdfService.renderAllNeedsReport();
            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=all_needs_report.pdf")
                    .contentType(MediaType.APPLICATION_PDF)
                    .body(pdf);
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", "Failed to generate PDF: " + e.getMessage()));
        }
    }

    @GetMapping("/borrowed-items/{id}/export/pdf")
    public ResponseEntity<?> exportNeedPdf(@PathVariable String id) {
        try {
            byte[] pdf = borrowedItemsPdfService.renderNeedReport(id);
            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=need_" + id + ".pdf")
                    .contentType(MediaType.APPLICATION_PDF)
                    .body(pdf);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(404).body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", "Failed to generate need PDF: " + e.getMessage()));
        }
    }

    // ── GET lender details ────────────────────────────────────────────────



    // ── POST extract ──────────────────────────────────────────────────────
    /**
     * Accepts PDF or image, extracts text (PDF: PDFBox, image: Tesseract if available),
     * runs AIExtractorService, then tries to match the extracted eventName against the DB.
     */
    @PostMapping("/borrowed-items/extract")
    public ResponseEntity<?> extractFromDocument(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "eventId", required = false) String eventId) {
        try {
            String text = extractText(file);
            ExtractedDataDTO data = aiExtractorService.extract(text);

            // If caller already picked an event, honour it
            if (eventId != null && !eventId.isBlank()) {
                data.setEventId(eventId);
            } else if (data.getEventName() != null) {
                // Try to match extracted event name against the DB
                List<Event> events = clubEventRepository
                        .findByTitleContainingIgnoreCase(data.getEventName());
                if (!events.isEmpty()) data.setEventId(events.get(0).getId());
            }

            return ResponseEntity.ok(data);
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", "Extraction failed: " + e.getMessage()));
        }
    }

    // ── Text extraction helpers ───────────────────────────────────────────

    private String extractText(MultipartFile file) throws IOException {
        String contentType = file.getContentType() != null ? file.getContentType() : "";

        if (contentType.equals("application/pdf")) {
            try (PDDocument doc = PDDocument.load(file.getInputStream())) {
                PDFTextStripper stripper = new PDFTextStripper();
                return stripper.getText(doc);
            }
        }

        if (contentType.startsWith("image/")) {
            // Attempt Tesseract OCR if on classpath; otherwise return empty string
            // so the form is still presented for manual fill.
            try {
                Class<?> tesseract = Class.forName("net.sourceforge.tess4j.Tesseract");
                Object t = tesseract.getDeclaredConstructor().newInstance();
                BufferedImage img = ImageIO.read(file.getInputStream());
                return (String) tesseract.getMethod("doOCR", BufferedImage.class).invoke(t, img);
            } catch (ClassNotFoundException e) {
                return ""; // Tesseract not available — manual fill
            } catch (Exception e) {
                return "";
            }
        }

        return new String(file.getBytes()); // plain text fallback
    }
    @PostMapping("/borrowed-items/extract-v2")
    public ResponseEntity<?> extractFromDocumentV2(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "eventId", required = false) String eventId) {
        try {
            String text = extractText(file);
            ExtractedDataV2DTO data = smartExtractionService.extract(text);

            // If UI already selected event, force it
            if (eventId != null && !eventId.isBlank()) {
                data.setMatchedEventId(eventId);
            } else if (data.getEventNameRaw() != null && !data.getEventNameRaw().isBlank()) {
                var allEvents = clubEventRepository.findAll();
                var match = eventMatcherService.matchEvent(data.getEventNameRaw(), allEvents);
                if (match.found()) {
                    data.setMatchedEventId(match.eventId());
                    data.setMatchedEventName(match.eventName());
                    data.setEventMatchScore(match.score());
                }
            }

            return ResponseEntity.ok(data);
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", "Extraction V2 failed: " + e.getMessage()));
        }
    }
}