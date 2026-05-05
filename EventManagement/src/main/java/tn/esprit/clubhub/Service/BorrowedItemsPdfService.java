package tn.esprit.clubhub.Service;

import lombok.extern.slf4j.Slf4j;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDFont;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import tn.esprit.clubhub.Entity.BorrowedItem;
import tn.esprit.clubhub.Entity.Devis;
import tn.esprit.clubhub.Entity.Event;
import tn.esprit.clubhub.Repository.BorrowedItemRepository;
import tn.esprit.clubhub.Repository.DevisRepository;
import tn.esprit.clubhub.Repository.EventRepository;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Slf4j
@Service
public class BorrowedItemsPdfService {

    private static final float PAGE_MARGIN = 45f;
    private static final float HEADER_HEIGHT = 58f;
    private static final float LINE_HEIGHT = 13f;
    private static final float[] BRAND_RGB = {0.16f, 0.15f, 0.44f};

    @Autowired private BorrowedItemRepository borrowedItemRepository;
    @Autowired private DevisRepository devisRepository;
    @Autowired private EventRepository eventRepository;

    public byte[] renderAllNeedsReport() throws IOException {
        List<BorrowedItem> items = borrowedItemRepository.findAll();
        items.sort((a, b) -> {
            LocalDateTime da = a.getBorrowedDate();
            LocalDateTime db = b.getBorrowedDate();
            if (da == null && db == null) return 0;
            if (da == null) return 1;
            if (db == null) return -1;
            return db.compareTo(da);
        });

        Map<String, String> eventNameById = new HashMap<>();
        for (Event e : eventRepository.findAll()) {
            eventNameById.put(e.getId(), safe(e.getTitle()));
        }

        try (PDDocument doc = new PDDocument();
             ByteArrayOutputStream out = new ByteArrayOutputStream()) {

            PDFont regular = PDType1Font.HELVETICA;
            PDFont bold = PDType1Font.HELVETICA_BOLD;

            PDPage page = new PDPage(PDRectangle.A4);
            doc.addPage(page);
            PDPageContentStream cs = new PDPageContentStream(doc, page);

            float pageW = page.getMediaBox().getWidth();
            float pageH = page.getMediaBox().getHeight();
            float contentW = pageW - (2 * PAGE_MARGIN);

            float y = drawHeader(cs, pageW, pageH, bold, regular, items.size());
            y = drawLine(cs, y, pageW);

            if (items.isEmpty()) {
                y = drawWrapped(cs, "No borrowed needs found.", regular, 10, y, contentW);
            } else {
                int idx = 1;
                for (BorrowedItem item : items) {
                    List<Devis> devis = devisRepository.findByBorrowedItemId(item.getId());
                    devis.sort(Comparator.comparing(d -> safe(d.getSupplierName())));

                    if (y < PAGE_MARGIN + 140) {
                        cs.close();
                        page = new PDPage(PDRectangle.A4);
                        doc.addPage(page);
                        cs = new PDPageContentStream(doc, page);
                        y = drawHeader(cs, pageW, pageH, bold, regular, items.size());
                        y = drawLine(cs, y, pageW);
                    }

                    String eventName = eventNameById.getOrDefault(item.getEventId(), safe(item.getEventName()));
                    y = drawWrapped(cs, idx + ". " + safe(item.getItemName()) + "  [" + safe(item.getStatus()) + "]", bold, 11, y, contentW);
                    y = drawWrapped(cs, "   Event: " + safe(eventName), regular, 10, y, contentW);
                    y = drawWrapped(cs, "   Lender: " + safe(item.getLenderName()) + " | Paid: " + yesNo(item.getIsPaid()), regular, 10, y, contentW);
                    y = drawWrapped(cs, "   Estimated budget: " + money(item.getEstimatedBudget()), regular, 10, y, contentW);

                    boolean treasuryConfirmed = safe(item.getValidationNote()).toLowerCase().contains("treasury:");
                    y = drawWrapped(cs,
                            "   Treasury confirmation: " + (treasuryConfirmed ? "YES" : "NO")
                                    + " | Validation note: " + safe(item.getValidationNote()),
                            regular, 10, y, contentW);

                    String validatedId = safe(item.getValidatedDevisId());
                    y = drawWrapped(cs, "   Validated quote ID: " + (validatedId.isBlank() ? "none" : validatedId), regular, 10, y, contentW);

                    if (devis.isEmpty()) {
                        y = drawWrapped(cs, "   Quotes: none", regular, 10, y, contentW);
                    } else {
                        y = drawWrapped(cs, "   Quotes (" + devis.size() + "):", bold, 10, y, contentW);
                        for (Devis d : devis) {
                            String line = String.format(
                                    Locale.US,
                                    "   - %s | %.3f TND | status=%s | contact=%s | validatedAt=%s",
                                    safe(d.getSupplierName()),
                                    d.getAmount() == null ? 0.0 : d.getAmount(),
                                    safe(d.getStatus()),
                                    safe(d.getContactName()),
                                    d.getValidatedAt() == null ? "—" : d.getValidatedAt().format(DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm"))
                            );
                            y = drawWrapped(cs, line, regular, 9, y, contentW);
                            if (!safe(d.getValidationNote()).isBlank()) {
                                y = drawWrapped(cs, "     note: " + safe(d.getValidationNote()), regular, 9, y, contentW);
                            }
                        }
                    }

                    y -= 5;
                    idx++;
                }
            }

            cs.close();
            doc.save(out);
            return out.toByteArray();
        }
    }

    public byte[] renderNeedReport(String itemId) throws IOException {
        BorrowedItem item = borrowedItemRepository.findById(itemId)
                .orElseThrow(() -> new IllegalArgumentException("Borrowed item not found: " + itemId));
        List<Devis> devis = devisRepository.findByBorrowedItemId(itemId);
        devis.sort(Comparator.comparing(d -> safe(d.getSupplierName())));

        Map<String, String> eventNameById = new HashMap<>();
        for (Event e : eventRepository.findAll()) {
            eventNameById.put(e.getId(), safe(e.getTitle()));
        }
        String eventName = eventNameById.getOrDefault(item.getEventId(), safe(item.getEventName()));
        boolean treasuryConfirmed = safe(item.getValidationNote()).toLowerCase().contains("treasury:");

        try (PDDocument doc = new PDDocument();
             ByteArrayOutputStream out = new ByteArrayOutputStream()) {

            PDFont regular = PDType1Font.HELVETICA;
            PDFont bold = PDType1Font.HELVETICA_BOLD;

            PDPage page = new PDPage(PDRectangle.A4);
            doc.addPage(page);
            PDPageContentStream cs = new PDPageContentStream(doc, page);

            float pageW = page.getMediaBox().getWidth();
            float pageH = page.getMediaBox().getHeight();
            float contentW = pageW - (2 * PAGE_MARGIN);

            float y = drawHeader(cs, pageW, pageH, bold, regular, 1);
            y = drawLine(cs, y, pageW);

            y = drawWrapped(cs, "Need: " + safe(item.getItemName()), bold, 12, y, contentW);
            y = drawWrapped(cs, "Status: " + safe(item.getStatus()), regular, 10, y, contentW);
            y = drawWrapped(cs, "Event: " + safe(eventName), regular, 10, y, contentW);
            y = drawWrapped(cs, "Category: " + safe(item.getCategory()), regular, 10, y, contentW);
            y = drawWrapped(cs, "Lender: " + safe(item.getLenderName()), regular, 10, y, contentW);
            y = drawWrapped(cs, "Lender contact: " + safe(item.getLenderContactPerson()) + " | " + safe(item.getLenderPhone()) + " | " + safe(item.getLenderEmail()), regular, 10, y, contentW);
            y = drawWrapped(cs, "Borrowed date: " + formatDate(item.getBorrowedDate()), regular, 10, y, contentW);
            y = drawWrapped(cs, "Expected return: " + formatDate(item.getExpectedReturnDate()), regular, 10, y, contentW);
            y = drawWrapped(cs, "Actual return: " + formatDate(item.getActualReturnDate()), regular, 10, y, contentW);
            y = drawWrapped(cs, "Estimated budget: " + money(item.getEstimatedBudget()), regular, 10, y, contentW);
            y = drawWrapped(cs, "Treasury confirmation: " + (treasuryConfirmed ? "YES" : "NO"), bold, 10, y, contentW);
            y = drawWrapped(cs, "Validation note: " + safe(item.getValidationNote()), regular, 10, y, contentW);
            y = drawWrapped(cs, "Validated quote ID: " + (safe(item.getValidatedDevisId()).isBlank() ? "none" : safe(item.getValidatedDevisId())), regular, 10, y, contentW);
            y -= 6;

            if (devis.isEmpty()) {
                y = drawWrapped(cs, "Quotes: none", regular, 10, y, contentW);
            } else {
                y = drawWrapped(cs, "Quotes (" + devis.size() + "):", bold, 10, y, contentW);
                for (Devis d : devis) {
                    String line = String.format(
                            Locale.US,
                            "- %s | %.3f TND | status=%s | validatedAt=%s",
                            safe(d.getSupplierName()),
                            d.getAmount() == null ? 0.0 : d.getAmount(),
                            safe(d.getStatus()),
                            d.getValidatedAt() == null ? "—" : d.getValidatedAt().format(DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm"))
                    );
                    y = drawWrapped(cs, line, regular, 9, y, contentW);
                }
            }

            cs.close();
            doc.save(out);
            return out.toByteArray();
        }
    }

    private float drawHeader(PDPageContentStream cs, float pageW, float pageH, PDFont bold, PDFont regular, int totalItems) throws IOException {
        cs.setNonStrokingColor(BRAND_RGB[0], BRAND_RGB[1], BRAND_RGB[2]);
        cs.addRect(0, pageH - HEADER_HEIGHT, pageW, HEADER_HEIGHT);
        cs.fill();
        cs.setNonStrokingColor(1f, 1f, 1f);

        cs.beginText();
        cs.setFont(bold, 16);
        cs.newLineAtOffset(PAGE_MARGIN, pageH - 34);
        cs.showText("ClubHub - All Borrowed Needs Report");
        cs.endText();

        cs.beginText();
        cs.setFont(regular, 9);
        cs.newLineAtOffset(PAGE_MARGIN, pageH - 49);
        cs.showText("Generated: " + LocalDateTime.now().format(DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm")) + " | Items: " + totalItems);
        cs.endText();

        cs.setNonStrokingColor(0f, 0f, 0f);
        return pageH - HEADER_HEIGHT - 18;
    }

    private float drawLine(PDPageContentStream cs, float y, float pageW) throws IOException {
        cs.setStrokingColor(BRAND_RGB[0], BRAND_RGB[1], BRAND_RGB[2]);
        cs.setLineWidth(1f);
        cs.moveTo(PAGE_MARGIN, y);
        cs.lineTo(pageW - PAGE_MARGIN, y);
        cs.stroke();
        cs.setStrokingColor(0f, 0f, 0f);
        return y - 12;
    }

    private float drawWrapped(PDPageContentStream cs, String text, PDFont font, float size, float y, float width) throws IOException {
        for (String line : wrap(sanitize(text), font, size, width)) {
            cs.beginText();
            cs.setFont(font, size);
            cs.newLineAtOffset(PAGE_MARGIN, y);
            cs.showText(line);
            cs.endText();
            y -= LINE_HEIGHT;
        }
        return y;
    }

    private List<String> wrap(String text, PDFont font, float size, float maxWidth) throws IOException {
        List<String> lines = new ArrayList<>();
        if (text == null || text.isBlank()) {
            lines.add("");
            return lines;
        }
        StringBuilder current = new StringBuilder();
        for (String word : text.split(" ")) {
            String candidate = current.length() == 0 ? word : current + " " + word;
            float w = font.getStringWidth(candidate) / 1000 * size;
            if (w > maxWidth && current.length() > 0) {
                lines.add(current.toString());
                current = new StringBuilder(word);
            } else {
                current = new StringBuilder(candidate);
            }
        }
        if (current.length() > 0) lines.add(current.toString());
        return lines;
    }

    private String sanitize(String s) {
        if (s == null) return "";
        return s
                .replace('\u2022', '-')
                .replace('\u2013', '-')
                .replace('\u2014', '-')
                .replace('\u2018', '\'')
                .replace('\u2019', '\'')
                .replace('\u201C', '"')
                .replace('\u201D', '"')
                .replace("\u2026", "...");
    }

    private String safe(String s) {
        return s == null ? "" : s.trim();
    }

    private String yesNo(Boolean v) {
        return Boolean.TRUE.equals(v) ? "YES" : "NO";
    }

    private String money(Double v) {
        return String.format(Locale.US, "%.3f TND", v == null ? 0.0 : v);
    }

    private String formatDate(LocalDateTime dt) {
        if (dt == null) return "—";
        return dt.format(DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm"));
    }
}
