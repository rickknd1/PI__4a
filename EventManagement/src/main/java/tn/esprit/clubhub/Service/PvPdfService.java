package tn.esprit.clubhub.Service;

import lombok.extern.slf4j.Slf4j;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDFont;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.springframework.stereotype.Service;
import tn.esprit.clubhub.Entity.MeetingPv;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;

/**
 * Renders a {@link MeetingPv} into a styled, printable PDF.
 *
 * <p>Layout: ClubHub-branded header band → PV title → metadata table →
 * formatted body (section headings parsed from {@code === TITLE ===})
 * → footer with page number and signature line.</p>
 *
 * <p>Uses only PDFBox (already in the pom) — no extra dependency. Fonts
 * are limited to the 14 PDF Standard Type-1 fonts so we don't need to
 * ship .ttf files. Accented characters work because PDFBox encodes them
 * with WinAnsi; for full Arabic support a TTF would be required, but
 * the LLM produces French output anyway.</p>
 */
@Slf4j
@Service
public class PvPdfService {

    private static final float PAGE_MARGIN = 50f;
    private static final float HEADER_HEIGHT = 70f;
    private static final float LINE_HEIGHT = 14f;

    // ClubHub brand colour (matches the frontend purple/pink gradient mid-tone).
    private static final float[] BRAND_RGB = {0.55f, 0.31f, 0.78f};
    private static final float[] LIGHT_GREY = {0.92f, 0.92f, 0.92f};

    public byte[] render(MeetingPv pv) throws IOException {
        try (PDDocument doc = new PDDocument();
             ByteArrayOutputStream out = new ByteArrayOutputStream()) {

            PDPage page = new PDPage(PDRectangle.A4);
            doc.addPage(page);
            PDFont fontRegular = PDType1Font.HELVETICA;
            PDFont fontBold    = PDType1Font.HELVETICA_BOLD;
            PDFont fontItalic  = PDType1Font.HELVETICA_OBLIQUE;

            float pageW = page.getMediaBox().getWidth();
            float pageH = page.getMediaBox().getHeight();
            float contentW = pageW - 2 * PAGE_MARGIN;

            PDPageContentStream cs = new PDPageContentStream(doc, page);

            float cursorY = drawHeader(cs, pageW, pageH, fontBold, fontRegular);
            cursorY = drawTitle(cs, pv, fontBold, cursorY, pageW);
            cursorY = drawMetadata(cs, pv, fontRegular, fontBold, cursorY, contentW);
            cursorY = drawSeparator(cs, cursorY, pageW);

            // Body — parse "=== SECTION ===" markers and style them.
            for (String line : sanitize(pv.getGeneratedContent()).split("\\R")) {
                if (cursorY < PAGE_MARGIN + 60) {
                    drawFooter(cs, doc.getNumberOfPages(), pageW, fontItalic);
                    cs.close();
                    page = new PDPage(PDRectangle.A4);
                    doc.addPage(page);
                    cs = new PDPageContentStream(doc, page);
                    cursorY = drawHeader(cs, pageW, pageH, fontBold, fontRegular);
                }
                cursorY = drawBodyLine(cs, line, fontRegular, fontBold, cursorY, contentW);
            }

            drawFooter(cs, doc.getNumberOfPages(), pageW, fontItalic);
            cs.close();
            doc.save(out);
            return out.toByteArray();
        }
    }

    // ── Header / title / metadata ───────────────────────────────────────────

    private float drawHeader(PDPageContentStream cs, float pageW, float pageH,
                             PDFont bold, PDFont regular) throws IOException {
        // Coloured band across the top.
        cs.setNonStrokingColor(BRAND_RGB[0], BRAND_RGB[1], BRAND_RGB[2]);
        cs.addRect(0, pageH - HEADER_HEIGHT, pageW, HEADER_HEIGHT);
        cs.fill();

        cs.setNonStrokingColor(1f, 1f, 1f);
        cs.beginText();
        cs.setFont(bold, 22);
        cs.newLineAtOffset(PAGE_MARGIN, pageH - HEADER_HEIGHT + 28);
        cs.showText("ClubHub");
        cs.endText();

        cs.beginText();
        cs.setFont(regular, 10);
        cs.newLineAtOffset(PAGE_MARGIN, pageH - HEADER_HEIGHT + 12);
        cs.showText("Connect • Manage • Engage");
        cs.endText();

        cs.beginText();
        cs.setFont(bold, 12);
        float rightLabel = "PROCÈS-VERBAL".length() * 6.5f;
        cs.newLineAtOffset(pageW - PAGE_MARGIN - rightLabel, pageH - HEADER_HEIGHT + 28);
        cs.showText("PROCÈS-VERBAL");
        cs.endText();

        cs.setNonStrokingColor(0f, 0f, 0f);
        return pageH - HEADER_HEIGHT - 30;
    }

    private float drawTitle(PDPageContentStream cs, MeetingPv pv, PDFont bold,
                            float y, float pageW) throws IOException {
        String title = pv.getEventTitle() == null ? "(Événement sans titre)" : pv.getEventTitle();
        cs.beginText();
        cs.setFont(bold, 16);
        cs.newLineAtOffset(PAGE_MARGIN, y);
        cs.showText(sanitize(title));
        cs.endText();
        return y - 24;
    }

    private float drawMetadata(PDPageContentStream cs, MeetingPv pv,
                               PDFont regular, PDFont bold, float y, float contentW)
            throws IOException {
        cs.setNonStrokingColor(LIGHT_GREY[0], LIGHT_GREY[1], LIGHT_GREY[2]);
        cs.addRect(PAGE_MARGIN, y - 50, contentW, 50);
        cs.fill();
        cs.setNonStrokingColor(0f, 0f, 0f);

        float row = y - 18;
        drawLabelValue(cs, "Date de l'événement :", nullSafe(pv.getEventDate()), row, regular, bold);
        row -= 14;
        drawLabelValue(cs, "Secrétaire général :", nullSafe(pv.getSecretaryName()), row, regular, bold);
        row -= 14;
        String created = pv.getCreatedAt() == null ? "—"
                : pv.getCreatedAt().format(DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm"));
        drawLabelValue(cs, "Date de rédaction :", created, row, regular, bold);
        return y - 60;
    }

    private void drawLabelValue(PDPageContentStream cs, String label, String value, float y,
                                PDFont regular, PDFont bold) throws IOException {
        cs.beginText();
        cs.setFont(bold, 9);
        cs.newLineAtOffset(PAGE_MARGIN + 8, y);
        cs.showText(sanitize(label));
        cs.endText();
        cs.beginText();
        cs.setFont(regular, 9);
        cs.newLineAtOffset(PAGE_MARGIN + 130, y);
        cs.showText(sanitize(value));
        cs.endText();
    }

    private float drawSeparator(PDPageContentStream cs, float y, float pageW) throws IOException {
        cs.setStrokingColor(BRAND_RGB[0], BRAND_RGB[1], BRAND_RGB[2]);
        cs.setLineWidth(1.2f);
        cs.moveTo(PAGE_MARGIN, y);
        cs.lineTo(pageW - PAGE_MARGIN, y);
        cs.stroke();
        cs.setStrokingColor(0f, 0f, 0f);
        return y - 18;
    }

    // ── Body lines ─────────────────────────────────────────────────────────

    private float drawBodyLine(PDPageContentStream cs, String raw,
                               PDFont regular, PDFont bold, float y, float contentW)
            throws IOException {
        String trimmed = raw.trim();

        // Section headings rendered like "=== TITLE ==="  →  bold + brand colour
        if (trimmed.startsWith("===") && trimmed.endsWith("===") && trimmed.length() > 6) {
            String section = trimmed.substring(3, trimmed.length() - 3).trim();
            cs.setNonStrokingColor(BRAND_RGB[0], BRAND_RGB[1], BRAND_RGB[2]);
            cs.beginText();
            cs.setFont(bold, 12);
            cs.newLineAtOffset(PAGE_MARGIN, y);
            cs.showText(sanitize(section));
            cs.endText();
            cs.setNonStrokingColor(0f, 0f, 0f);
            return y - LINE_HEIGHT - 4;
        }

        if (trimmed.isEmpty()) return y - 6;

        // Wrap long paragraphs to page width.
        for (String wrapped : wrap(trimmed, regular, 10, contentW)) {
            cs.beginText();
            cs.setFont(regular, 10);
            cs.newLineAtOffset(PAGE_MARGIN, y);
            cs.showText(sanitize(wrapped));
            cs.endText();
            y -= LINE_HEIGHT;
        }
        return y;
    }

    private void drawFooter(PDPageContentStream cs, int pageNum, float pageW, PDFont italic)
            throws IOException {
        cs.setNonStrokingColor(0.4f, 0.4f, 0.4f);
        cs.beginText();
        cs.setFont(italic, 8);
        cs.newLineAtOffset(PAGE_MARGIN, 30);
        cs.showText("Document généré automatiquement par ClubHub");
        cs.endText();
        String pn = "Page " + pageNum;
        cs.beginText();
        cs.setFont(italic, 8);
        cs.newLineAtOffset(pageW - PAGE_MARGIN - pn.length() * 4, 30);
        cs.showText(pn);
        cs.endText();
        cs.setNonStrokingColor(0f, 0f, 0f);
    }

    // ── Text helpers ───────────────────────────────────────────────────────

    /** PDFBox's WinAnsiEncoding chokes on a handful of Unicode glyphs (•,
     *  smart quotes, em dash). Substitute them so we don't crash the render. */
    private String sanitize(String s) {
        if (s == null) return "";
        return s
                .replace('\u2022', '-')   // • → -
                .replace('\u2013', '-')   // – → -
                .replace('\u2014', '-')   // — → -
                .replace('\u2018', '\'')  // ' → '
                .replace('\u2019', '\'')  // ' → '
                .replace('\u201C', '"')   // " → "
                .replace('\u201D', '"')   // " → "
                .replace("\u2026", "...");  // … → ... (CharSequence overload, char would be invalid)
    }

    private List<String> wrap(String text, PDFont font, float fontSize, float maxWidth)
            throws IOException {
        List<String> lines = new ArrayList<>();
        StringBuilder current = new StringBuilder();
        for (String word : text.split(" ")) {
            String tentative = current.length() == 0 ? word : current + " " + word;
            float w = font.getStringWidth(sanitize(tentative)) / 1000 * fontSize;
            if (w > maxWidth && current.length() > 0) {
                lines.add(current.toString());
                current = new StringBuilder(word);
            } else {
                current = new StringBuilder(tentative);
            }
        }
        if (current.length() > 0) lines.add(current.toString());
        return lines;
    }

    private String nullSafe(String s) { return s == null || s.isBlank() ? "—" : s; }
}
