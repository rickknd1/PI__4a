package com.clubhub.treasury.service;

import com.clubhub.treasury.entity.CotisationRule;
import com.clubhub.treasury.entity.Payment;
import com.clubhub.treasury.entity.Receipt;
import com.clubhub.treasury.exception.TreasuryException;
import com.clubhub.treasury.repository.CotisationRuleRepository;
import com.clubhub.treasury.repository.ReceiptRepository;
import com.itextpdf.kernel.colors.ColorConstants;
import com.itextpdf.kernel.colors.DeviceRgb;
import com.itextpdf.kernel.geom.PageSize;
import com.itextpdf.kernel.pdf.PdfDocument;
import com.itextpdf.kernel.pdf.PdfWriter;
import com.itextpdf.layout.Document;
import com.itextpdf.layout.borders.Border;
import com.itextpdf.layout.borders.SolidBorder;
import com.itextpdf.layout.element.Cell;
import com.itextpdf.layout.element.Paragraph;
import com.itextpdf.layout.element.Table;
import com.itextpdf.layout.properties.TextAlignment;
import com.itextpdf.layout.properties.UnitValue;
import com.itextpdf.layout.properties.VerticalAlignment;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Optional;
import java.util.UUID;

@Service
public class ReceiptService {

    private final ReceiptRepository receiptRepository;
    private final PaymentService paymentService;
    private final AuditService auditService;
    private final CotisationRuleRepository cotisationRuleRepository;

    // Couleurs
    private static final DeviceRgb BRAND_DARK = new DeviceRgb(28, 35, 64);      // #1C2340
    private static final DeviceRgb BRAND_ACCENT = new DeviceRgb(232, 64, 104);   // #E84068
    private static final DeviceRgb GRAY_50 = new DeviceRgb(249, 250, 251);
    private static final DeviceRgb GRAY_200 = new DeviceRgb(229, 231, 235);
    private static final DeviceRgb GRAY_500 = new DeviceRgb(107, 114, 128);
    private static final DeviceRgb GRAY_700 = new DeviceRgb(55, 65, 81);
    private static final DeviceRgb GREEN_700 = new DeviceRgb(21, 128, 61);

    private static final DateTimeFormatter DATE_FR = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final DateTimeFormatter DATETIME_FR = DateTimeFormatter.ofPattern("dd/MM/yyyy 'a' HH:mm");

    public ReceiptService(ReceiptRepository receiptRepository,
                          PaymentService paymentService,
                          AuditService auditService,
                          CotisationRuleRepository cotisationRuleRepository) {
        this.receiptRepository = receiptRepository;
        this.paymentService = paymentService;
        this.auditService = auditService;
        this.cotisationRuleRepository = cotisationRuleRepository;
    }

    public Optional<Receipt> getByPayment(String paymentId) {
        return receiptRepository.findByPaymentId(paymentId);
    }

    @Transactional
    public Receipt generateReceipt(String paymentId, String memberName, String clubName) {
        Payment payment = paymentService.getOrThrow(paymentId);

        if (!"PAID".equals(payment.getStatus().name())) {
            throw new TreasuryException("Cannot generate receipt for unpaid payment", 400);
        }

        Optional<Receipt> existing = receiptRepository.findByPaymentId(paymentId);
        if (existing.isPresent()) {
            return existing.get();
        }

        String receiptNumber = "REC-" + payment.getClubId() + "-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();

        Receipt receipt = Receipt.builder()
                .paymentId(payment.getId())
                .receiptNumber(receiptNumber)
                .filePath("/receipts/" + receiptNumber + ".pdf")
                .memberName(memberName)
                .clubName(clubName)
                .build();

        receipt = receiptRepository.save(receipt);

        auditService.log("system", "system@clubhub.tn", payment.getClubId(),
                "RECEIPT_GENERATED", "Receipt", receipt.getId(),
                null, receiptNumber, payment.getAmount());

        return receipt;
    }

    public byte[] generatePdfBytes(String paymentId, String memberName, String clubName) {
        Payment payment = paymentService.getOrThrow(paymentId);
        Receipt receipt = generateReceipt(paymentId, memberName, clubName);

        // Recupere le libelle de la cotisation (motif) + frequence
        String motif = "Cotisation club";
        String frequence = "-";
        if (payment.getCotisationRuleId() != null) {
            Optional<CotisationRule> ruleOpt = cotisationRuleRepository.findById(payment.getCotisationRuleId());
            if (ruleOpt.isPresent()) {
                CotisationRule rule = ruleOpt.get();
                motif = rule.getName();
                if (rule.getFrequency() != null) {
                    frequence = switch (rule.getFrequency()) {
                        case MONTHLY -> "Mensuelle";
                        case QUARTERLY -> "Trimestrielle";
                        case ANNUAL -> "Annuelle";
                    };
                }
            }
        }

        // Methode de paiement deduite
        String methodePaiement;
        if (payment.getStripePaymentIntentId() != null) {
            methodePaiement = "Carte bancaire (Stripe)";
        } else {
            methodePaiement = "Especes (validation tresorier)";
        }

        try (ByteArrayOutputStream baos = new ByteArrayOutputStream()) {
            PdfWriter writer = new PdfWriter(baos);
            PdfDocument pdf = new PdfDocument(writer);
            pdf.setDefaultPageSize(PageSize.A4);
            Document doc = new Document(pdf, PageSize.A4);
            doc.setMargins(40, 50, 40, 50);

            // ════════════════════════════════════════════════════════════
            // HEADER — Logo + Infos club
            // ════════════════════════════════════════════════════════════
            Table header = new Table(UnitValue.createPercentArray(new float[]{50, 50}))
                    .useAllAvailableWidth().setBorder(Border.NO_BORDER);

            // Gauche: nom du club
            Cell leftCell = new Cell().setBorder(Border.NO_BORDER);
            leftCell.add(new Paragraph("ClubHub")
                    .setFontSize(24).setBold().setFontColor(BRAND_DARK));
            leftCell.add(new Paragraph(clubName)
                    .setFontSize(11).setFontColor(GRAY_500).setMarginTop(-2));
            header.addCell(leftCell);

            // Droite: RECU DE PAIEMENT
            Cell rightCell = new Cell().setBorder(Border.NO_BORDER)
                    .setTextAlignment(TextAlignment.RIGHT);
            rightCell.add(new Paragraph("RECU DE PAIEMENT")
                    .setFontSize(16).setBold().setFontColor(BRAND_ACCENT));
            rightCell.add(new Paragraph("N\u00b0 " + receipt.getReceiptNumber())
                    .setFontSize(10).setFontColor(GRAY_500));
            header.addCell(rightCell);

            doc.add(header);

            // Ligne de separation
            doc.add(new Table(1).useAllAvailableWidth()
                    .setBorderBottom(new SolidBorder(GRAY_200, 1))
                    .setMarginTop(10).setMarginBottom(15));

            // ════════════════════════════════════════════════════════════
            // INFOS — Membre + Date
            // ════════════════════════════════════════════════════════════
            Table info = new Table(UnitValue.createPercentArray(new float[]{50, 50}))
                    .useAllAvailableWidth().setBorder(Border.NO_BORDER);

            Cell memberCell = new Cell().setBorder(Border.NO_BORDER);
            memberCell.add(new Paragraph("Membre").setFontSize(9).setFontColor(GRAY_500));
            memberCell.add(new Paragraph(memberName).setFontSize(12).setBold().setFontColor(GRAY_700));
            info.addCell(memberCell);

            Cell dateCell = new Cell().setBorder(Border.NO_BORDER).setTextAlignment(TextAlignment.RIGHT);
            dateCell.add(new Paragraph("Date d'emission").setFontSize(9).setFontColor(GRAY_500));
            dateCell.add(new Paragraph(LocalDateTime.now().format(DATETIME_FR))
                    .setFontSize(11).setFontColor(GRAY_700));
            info.addCell(dateCell);

            doc.add(info);
            doc.add(new Paragraph(" ").setMarginBottom(10));

            // ════════════════════════════════════════════════════════════
            // DETAILS DU PAIEMENT — Tableau
            // ════════════════════════════════════════════════════════════
            Table details = new Table(UnitValue.createPercentArray(new float[]{45, 55}))
                    .useAllAvailableWidth()
                    .setBorder(new SolidBorder(GRAY_200, 1));

            addDetailRow(details, "Motif du paiement", motif, true);
            addDetailRow(details, "Frequence", frequence, false);
            addDetailRow(details, "Montant", payment.getAmount().toPlainString() + " TND", true);
            addDetailRow(details, "Methode de paiement", methodePaiement, false);
            addDetailRow(details, "Statut", "PAYE", true);
            addDetailRow(details, "Date d'echeance",
                    payment.getDueDate() != null ? payment.getDueDate().format(DATE_FR) : "-", false);
            addDetailRow(details, "Date de paiement",
                    payment.getPaidAt() != null ? payment.getPaidAt().format(DATETIME_FR) : "-", true);

            if (payment.getInstallmentNumber() != null && payment.getTotalInstallments() != null) {
                addDetailRow(details, "Echeance",
                        payment.getInstallmentNumber() + " / " + payment.getTotalInstallments(), false);
            }

            if (payment.getStripePaymentIntentId() != null) {
                addDetailRow(details, "Reference transaction Stripe", payment.getStripePaymentIntentId(), false);
            }

            doc.add(details);

            // ════════════════════════════════════════════════════════════
            // MONTANT TOTAL — Encadre
            // ════════════════════════════════════════════════════════════
            doc.add(new Paragraph(" ").setMarginBottom(8));

            Table totalBox = new Table(UnitValue.createPercentArray(new float[]{60, 40}))
                    .useAllAvailableWidth()
                    .setBackgroundColor(GRAY_50)
                    .setBorder(new SolidBorder(GRAY_200, 1));

            totalBox.addCell(new Cell().setBorder(Border.NO_BORDER).setPadding(12)
                    .add(new Paragraph("Total paye").setFontSize(13).setBold().setFontColor(GRAY_700)));
            totalBox.addCell(new Cell().setBorder(Border.NO_BORDER).setPadding(12)
                    .setTextAlignment(TextAlignment.RIGHT)
                    .add(new Paragraph(payment.getAmount().toPlainString() + " TND")
                            .setFontSize(18).setBold().setFontColor(GREEN_700)));

            doc.add(totalBox);

            // ════════════════════════════════════════════════════════════
            // FOOTER
            // ════════════════════════════════════════════════════════════
            doc.add(new Paragraph(" ").setMarginBottom(30));

            doc.add(new Paragraph("Ce document fait office de recu de paiement et confirme que la cotisation a ete reglee.")
                    .setFontSize(9).setFontColor(GRAY_500).setTextAlignment(TextAlignment.CENTER));

            doc.add(new Paragraph("ClubHub - Plateforme de gestion des clubs universitaires")
                    .setFontSize(8).setFontColor(GRAY_500).setTextAlignment(TextAlignment.CENTER)
                    .setMarginTop(5));

            doc.add(new Paragraph("Genere le " + LocalDateTime.now().format(DATETIME_FR)
                    + " | Ref: " + receipt.getReceiptNumber())
                    .setFontSize(7).setFontColor(new DeviceRgb(156, 163, 175))
                    .setTextAlignment(TextAlignment.CENTER).setMarginTop(3));

            doc.close();
            return baos.toByteArray();
        } catch (Exception e) {
            throw new TreasuryException("Erreur generation PDF: " + e.getMessage(), 500);
        }
    }

    private void addDetailRow(Table table, String label, String value, boolean shaded) {
        DeviceRgb bg = shaded ? GRAY_50 : ColorConstants.WHITE instanceof DeviceRgb ? (DeviceRgb) ColorConstants.WHITE : new DeviceRgb(255, 255, 255);

        table.addCell(new Cell().setBorder(Border.NO_BORDER)
                .setBorderBottom(new SolidBorder(GRAY_200, 0.5f))
                .setBackgroundColor(bg).setPadding(10)
                .add(new Paragraph(label).setFontSize(10).setFontColor(GRAY_500)));

        table.addCell(new Cell().setBorder(Border.NO_BORDER)
                .setBorderBottom(new SolidBorder(GRAY_200, 0.5f))
                .setBackgroundColor(bg).setPadding(10)
                .setTextAlignment(TextAlignment.RIGHT)
                .add(new Paragraph(value).setFontSize(11).setBold().setFontColor(GRAY_700)));
    }
}
