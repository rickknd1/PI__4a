package tn.esprit.virtual_event_management.service;
import com.itextpdf.io.font.PdfEncodings;
import com.itextpdf.kernel.font.PdfFont;
import com.itextpdf.kernel.font.PdfFontFactory;
import com.itextpdf.kernel.pdf.PdfDocument;
import com.itextpdf.kernel.pdf.PdfWriter;
import com.itextpdf.layout.Document;
import com.itextpdf.layout.element.Paragraph;
import com.itextpdf.layout.properties.BaseDirection;
import com.itextpdf.layout.properties.TextAlignment;
import org.springframework.stereotype.Service;
import tn.esprit.virtual_event_management.entity.VirtualEvent;

import java.io.ByteArrayOutputStream;

@Service
public class PdfService {
    public byte[] generatePdf(String content) {
        try {
            ByteArrayOutputStream out = new ByteArrayOutputStream();

            PdfWriter writer = new PdfWriter(out);
            PdfDocument pdf = new PdfDocument(writer);
            Document document = new Document(pdf);

            // 🔥 Charger la police arabe
            PdfFont font = PdfFontFactory.createFont(
                    "src/main/resources/fonts/NotoSansArabic-Regular.ttf",
                    PdfEncodings.IDENTITY_H
            );

            // 🟢 TITRE
            document.add(new Paragraph("Transcription Audio")
                    .setFont(font)
                    .setBold()
                    .setFontSize(18));

            document.add(new Paragraph(" "));

            // 🔥 TEXTE ARABE avec RTL
            Paragraph arabicParagraph = new Paragraph(content)
                    .setFont(font)
                    .setFontSize(12)
                    .setTextAlignment(TextAlignment.RIGHT)       // alignement à droite
                    .setBaseDirection(BaseDirection.RIGHT_TO_LEFT); // direction RTL

            document.add(arabicParagraph);

            document.close();
            return out.toByteArray();

        } catch (Exception e) {
            throw new RuntimeException("Erreur lors de la génération du PDF", e);
        }
    }
    public byte[] generateEventPdf(VirtualEvent event) {

        StringBuilder content = new StringBuilder();

        content.append("📄 Rapport de l'événement\n\n");

        content.append("Titre : ").append(event.getTitle()).append("\n");
        content.append("Catégorie : ").append(event.getCategory()).append("\n");
        content.append("Date début : ").append(event.getScheduledAt()).append("\n");
        content.append("Date fin : ").append(event.getEndAt()).append("\n");
        content.append("Statut : ").append(event.getStatus()).append("\n\n");

        content.append("Participants : ")
                .append(event.getCurrentParticipants())
                .append(" / ")
                .append(event.getMaxParticipants())
                .append("\n\n");

        // 🔥 liste participants
        if (event.getParticipants() != null && !event.getParticipants().isEmpty()) {
            content.append("Liste des participants :\n");

            for (int i = 0; i < event.getParticipants().size(); i++) {
                content.append(i + 1)
                        .append(". ")
                        .append(event.getParticipants().get(i).getLastName())
                        .append("\n");
            }
        }

        // 🔥 on réutilise TA méthode existante
        return generatePdf(content.toString());
    }
}
