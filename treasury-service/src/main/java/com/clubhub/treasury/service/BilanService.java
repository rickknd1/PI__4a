package com.clubhub.treasury.service;

import com.clubhub.treasury.dto.response.BilanResponse;
import com.clubhub.treasury.dto.response.ExpenseResponse;
import com.clubhub.treasury.dto.response.PaymentResponse;
import com.clubhub.treasury.entity.Budget;
import com.clubhub.treasury.entity.Expense;
import com.clubhub.treasury.entity.Payment;
import com.clubhub.treasury.repository.BudgetRepository;
import com.clubhub.treasury.repository.ExpenseRepository;
import com.clubhub.treasury.repository.PaymentRepository;
import com.itextpdf.kernel.colors.DeviceRgb;
import com.itextpdf.kernel.events.Event;
import com.itextpdf.kernel.events.IEventHandler;
import com.itextpdf.kernel.events.PdfDocumentEvent;
import com.itextpdf.kernel.geom.PageSize;
import com.itextpdf.kernel.pdf.PdfDocument;
import com.itextpdf.kernel.pdf.PdfPage;
import com.itextpdf.kernel.pdf.PdfWriter;
import com.itextpdf.kernel.pdf.canvas.PdfCanvas;
import com.itextpdf.layout.Canvas;
import com.itextpdf.layout.Document;
import com.itextpdf.layout.borders.Border;
import com.itextpdf.layout.borders.SolidBorder;
import com.itextpdf.layout.element.Cell;
import com.itextpdf.layout.element.LineSeparator;
import com.itextpdf.layout.element.Paragraph;
import com.itextpdf.layout.element.Table;
import com.itextpdf.layout.properties.TextAlignment;
import com.itextpdf.layout.properties.UnitValue;
import com.itextpdf.kernel.pdf.canvas.draw.SolidLine;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class BilanService {

    private final PaymentRepository paymentRepository;
    private final ExpenseRepository expenseRepository;
    private final BudgetRepository budgetRepository;

    public BilanResponse generateBilan(Long clubId, LocalDate start, LocalDate end, String periodLabel) {
        List<Payment> allPayments = paymentRepository.findByClubIdOrderByCreatedAtDesc(clubId);
        List<Expense> allExpenses = expenseRepository.findByClubIdOrderByCreatedAtDesc(clubId);

        // Filtrer par periode — date du fait economique :
        //  - Paiement PAID : utiliser paidAt (date d'encaissement)
        //  - Paiement LATE/PENDING : utiliser dueDate (date d'echeance, ce qui aurait du rentrer)
        //  - Expense : utiliser submittedAt si present, sinon createdAt (date de la depense)
        // (ancien bug : filtrer par createdAt = date du seed -> bilan vide pour transactions reelles)
        List<Payment> payments = allPayments.stream()
                .filter(p -> {
                    LocalDate refDate;
                    if (p.getStatus() == Payment.PaymentStatus.PAID && p.getPaidAt() != null) {
                        refDate = p.getPaidAt().toLocalDate();
                    } else if (p.getDueDate() != null) {
                        refDate = p.getDueDate();
                    } else if (p.getCreatedAt() != null) {
                        refDate = p.getCreatedAt().toLocalDate();
                    } else {
                        return false;
                    }
                    return !refDate.isBefore(start) && !refDate.isAfter(end);
                })
                .toList();

        List<Expense> expenses = allExpenses.stream()
                .filter(e -> {
                    LocalDate refDate;
                    if (e.getSubmittedAt() != null) {
                        refDate = e.getSubmittedAt().toLocalDate();
                    } else if (e.getCreatedAt() != null) {
                        refDate = e.getCreatedAt().toLocalDate();
                    } else {
                        return false;
                    }
                    return !refDate.isBefore(start) && !refDate.isAfter(end);
                })
                .toList();

        BigDecimal totalRevenues = payments.stream()
                .filter(p -> p.getStatus() == Payment.PaymentStatus.PAID)
                .map(Payment::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);

        long paidCount = payments.stream().filter(p -> p.getStatus() == Payment.PaymentStatus.PAID).count();
        long lateCount = payments.stream().filter(p -> p.getStatus() == Payment.PaymentStatus.LATE).count();
        long pendingCount = payments.stream().filter(p -> p.getStatus() == Payment.PaymentStatus.PENDING).count();

        BigDecimal expApproved = expenses.stream()
                .filter(e -> e.getStatus() == Expense.ExpenseStatus.APPROVED)
                .map(Expense::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal expPending = expenses.stream()
                .filter(e -> e.getStatus() == Expense.ExpenseStatus.SUBMITTED || e.getStatus() == Expense.ExpenseStatus.VALIDATED)
                .map(Expense::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);

        long countExpApproved = expenses.stream().filter(e -> e.getStatus() == Expense.ExpenseStatus.APPROVED).count();
        long countExpPending = expenses.stream().filter(e -> e.getStatus() == Expense.ExpenseStatus.SUBMITTED || e.getStatus() == Expense.ExpenseStatus.VALIDATED).count();
        long countExpRejected = expenses.stream().filter(e -> e.getStatus() == Expense.ExpenseStatus.REJECTED).count();

        BigDecimal solde = totalRevenues.subtract(expApproved);

        double recoveryRate = 0;
        BigDecimal totalDue = totalRevenues.add(payments.stream()
                .filter(p -> p.getStatus() == Payment.PaymentStatus.PENDING || p.getStatus() == Payment.PaymentStatus.LATE)
                .map(Payment::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add));
        if (totalDue.compareTo(BigDecimal.ZERO) > 0) {
            recoveryRate = totalRevenues.divide(totalDue, 4, RoundingMode.HALF_UP).multiply(BigDecimal.valueOf(100)).doubleValue();
        }

        // Budget
        Optional<Budget> budget = budgetRepository
                .findFirstByClubIdAndPeriodStartLessThanEqualAndPeriodEndGreaterThanEqualOrderByCreatedAtDesc(clubId, start, end);

        // Depenses par categorie
        Map<String, List<Expense>> byCategory = expenses.stream()
                .filter(e -> e.getStatus() == Expense.ExpenseStatus.APPROVED && e.getCategory() != null)
                .collect(Collectors.groupingBy(e -> e.getCategory().name()));

        List<BilanResponse.CategoryBreakdown> categories = byCategory.entrySet().stream()
                .map(entry -> {
                    BigDecimal catTotal = entry.getValue().stream().map(Expense::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
                    double pct = expApproved.compareTo(BigDecimal.ZERO) > 0
                            ? catTotal.divide(expApproved, 4, RoundingMode.HALF_UP).multiply(BigDecimal.valueOf(100)).doubleValue() : 0;
                    return BilanResponse.CategoryBreakdown.builder()
                            .category(entry.getKey()).total(catTotal).count(entry.getValue().size()).percentage(pct).build();
                })
                .sorted(Comparator.comparing(BilanResponse.CategoryBreakdown::getTotal).reversed())
                .toList();

        // Map to response DTOs
        List<PaymentResponse> paymentDtos = payments.stream().limit(50)
                .map(p -> PaymentResponse.builder()
                        .id(p.getId()).memberId(p.getMemberId()).amount(p.getAmount())
                        .status(p.getStatus()).dueDate(p.getDueDate()).paidAt(p.getPaidAt()).createdAt(p.getCreatedAt()).build())
                .toList();

        List<ExpenseResponse> expenseDtos = expenses.stream().limit(50)
                .map(e -> ExpenseResponse.builder()
                        .id(e.getId()).clubId(e.getClubId()).submittedByMemberId(e.getSubmittedByMemberId())
                        .title(e.getTitle()).description(e.getDescription()).amount(e.getAmount())
                        .status(e.getStatus())
                        .category(e.getCategory())
                        .categoryConfidenceScore(e.getCategoryConfidenceScore())
                        .submittedAt(e.getSubmittedAt()).approvedAt(e.getApprovedAt())
                        .rejectionReason(e.getRejectionReason()).build())
                .toList();

        return BilanResponse.builder()
                .periodLabel(periodLabel)
                .startDate(start.toString())
                .endDate(end.toString())
                .generatedAt(LocalDateTime.now().format(DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm")))
                .totalRevenues(totalRevenues)
                .totalPaymentsPaid(paidCount)
                .totalPaymentsLate(lateCount)
                .totalPaymentsPending(pendingCount)
                .totalExpensesApproved(expApproved)
                .totalExpensesPending(expPending)
                .countExpensesApproved(countExpApproved)
                .countExpensesPending(countExpPending)
                .countExpensesRejected(countExpRejected)
                .solde(solde)
                .recoveryRate(recoveryRate)
                .budgetTotal(budget.map(Budget::getTotalAmount).orElse(BigDecimal.ZERO))
                .budgetConsumed(budget.map(Budget::getConsumedAmount).orElse(BigDecimal.ZERO))
                .budgetPercentage(budget.map(Budget::getConsumptionPercentage).orElse(0))
                .payments(paymentDtos)
                .expenses(expenseDtos)
                .expensesByCategory(categories)
                .build();
    }

    public byte[] generateBilanPdf(Long clubId, LocalDate start, LocalDate end, String periodLabel) {
        BilanResponse bilan = generateBilan(clubId, start, end, periodLabel);

        // Black & white palette — professional accounting style
        DeviceRgb black = new DeviceRgb(0, 0, 0);
        DeviceRgb white = new DeviceRgb(255, 255, 255);
        DeviceRgb secondaryGray = new DeviceRgb(0x66, 0x66, 0x66);   // #666666
        DeviceRgb rowAlt = new DeviceRgb(0xF5, 0xF5, 0xF5);          // #F5F5F5
        DeviceRgb totalRowBg = new DeviceRgb(0xE8, 0xE8, 0xE8);      // light gray for totals

        DateTimeFormatter dateFmt = DateTimeFormatter.ofPattern("dd/MM/yyyy");
        String currency = "TND";

        // Pre-compute amounts used across sections
        BigDecimal pendingAmount = bilan.getPayments().stream()
                .filter(p -> p.getStatus() == Payment.PaymentStatus.PENDING)
                .map(PaymentResponse::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal lateAmount = bilan.getPayments().stream()
                .filter(p -> p.getStatus() == Payment.PaymentStatus.LATE)
                .map(PaymentResponse::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);

        boolean hasBudget = bilan.getBudgetTotal().compareTo(BigDecimal.ZERO) > 0;

        try (ByteArrayOutputStream baos = new ByteArrayOutputStream()) {
            PdfDocument pdf = new PdfDocument(new PdfWriter(baos));

            // Footer event handler: date + page numbers
            pdf.addEventHandler(PdfDocumentEvent.END_PAGE, new IEventHandler() {
                @Override
                public void handleEvent(Event event) {
                    PdfDocumentEvent docEvent = (PdfDocumentEvent) event;
                    PdfDocument pdfDoc = docEvent.getDocument();
                    PdfPage page = docEvent.getPage();
                    int pageNum = pdfDoc.getPageNumber(page);
                    int totalPages = pdfDoc.getNumberOfPages();
                    PageSize pageSize = pdfDoc.getDefaultPageSize();
                    PdfCanvas pdfCanvas = new PdfCanvas(page.newContentStreamAfter(), page.getResources(), pdfDoc);
                    Canvas canvas = new Canvas(pdfCanvas, pageSize);
                    canvas.showTextAligned(
                            new Paragraph("Page " + pageNum + " / " + totalPages)
                                    .setFontSize(8).setFontColor(secondaryGray),
                            pageSize.getWidth() / 2, 30, TextAlignment.CENTER);
                    canvas.showTextAligned(
                            new Paragraph("Document genere le " + LocalDate.now().format(dateFmt)
                                    + " | ClubHub - Gestion des clubs universitaires")
                                    .setFontSize(7).setFontColor(secondaryGray),
                            pageSize.getWidth() / 2, 20, TextAlignment.CENTER);
                    canvas.close();
                }
            });

            Document doc = new Document(pdf);
            doc.setMargins(50, 50, 60, 50);

            // ================================================================
            // HEADER
            // ================================================================
            doc.add(new Paragraph("BILAN FINANCIER")
                    .setFontSize(24).setBold().setFontColor(black).setTextAlignment(TextAlignment.CENTER).setMarginBottom(4));
            doc.add(new Paragraph(periodLabel)
                    .setFontSize(12).setFontColor(secondaryGray).setTextAlignment(TextAlignment.CENTER).setMarginBottom(2));
            doc.add(new Paragraph("Exercice : du " + start.format(dateFmt) + " au " + end.format(dateFmt))
                    .setFontSize(11).setFontColor(secondaryGray).setTextAlignment(TextAlignment.CENTER).setMarginBottom(2));
            doc.add(new Paragraph("(Montants exprimes en Dinar Tunisien - TND)")
                    .setFontSize(9).setItalic().setFontColor(secondaryGray).setTextAlignment(TextAlignment.CENTER).setMarginBottom(4));
            SolidLine headerLine = new SolidLine(1f);
            headerLine.setColor(black);
            doc.add(new LineSeparator(headerLine).setMarginBottom(20));

            // ================================================================
            // SECTION I -- RECETTES
            // ================================================================
            doc.add(bilanSectionTitle("SECTION I \u2014 RECETTES", black, black));

            Table recettesTable = new Table(UnitValue.createPercentArray(new float[]{65, 35})).useAllAvailableWidth();
            addBilanHeader(recettesTable, black, white, "Poste", "Montant (TND)");

            addBilanRow(recettesTable, "Cotisations encaissees (" + bilan.getTotalPaymentsPaid() + ")",
                    formatAmount(bilan.getTotalRevenues(), currency), white, false);
            addBilanRow(recettesTable, "Cotisations en attente (" + bilan.getTotalPaymentsPending() + ")",
                    formatAmount(pendingAmount, currency), rowAlt, false);
            addBilanRow(recettesTable, "Cotisations en retard (" + bilan.getTotalPaymentsLate() + ")",
                    formatAmount(lateAmount, currency), white, false);

            // Total row
            addBilanTotalRow(recettesTable, "TOTAL DES RECETTES ENCAISSEES",
                    formatAmount(bilan.getTotalRevenues(), currency), totalRowBg, black);

            doc.add(recettesTable.setMarginBottom(18));

            // ================================================================
            // SECTION II -- DEPENSES APPROUVEES
            // ================================================================
            doc.add(bilanSectionTitle("SECTION II \u2014 DEPENSES APPROUVEES", black, black));

            Table depensesTable = new Table(UnitValue.createPercentArray(new float[]{40, 15, 25, 20})).useAllAvailableWidth();
            addBilanHeader4(depensesTable, black, white, "Categorie", "Nombre", "Montant (TND)", "% du total");

            if (!bilan.getExpensesByCategory().isEmpty()) {
                boolean alt = false;
                for (BilanResponse.CategoryBreakdown cat : bilan.getExpensesByCategory()) {
                    DeviceRgb rowBg = alt ? rowAlt : white;
                    addBilanRow4(depensesTable, cat.getCategory(),
                            String.valueOf(cat.getCount()),
                            formatAmount(cat.getTotal(), currency),
                            String.format("%.1f %%", cat.getPercentage()),
                            rowBg, false);
                    alt = !alt;
                }
            } else {
                depensesTable.addCell(new Cell(1, 4)
                        .add(new Paragraph("Aucune depense approuvee sur la periode.")
                                .setFontSize(9).setItalic().setFontColor(secondaryGray))
                        .setPadding(10).setBorder(new SolidBorder(black, 1)));
            }

            // Total row
            addBilanRow4(depensesTable, "TOTAL DES DEPENSES",
                    String.valueOf(bilan.getCountExpensesApproved()),
                    formatAmount(bilan.getTotalExpensesApproved(), currency),
                    "100 %", totalRowBg, true);

            doc.add(depensesTable);

            // Pending / rejected info
            if (bilan.getTotalExpensesPending().compareTo(BigDecimal.ZERO) > 0) {
                doc.add(new Paragraph("Depenses en attente de validation : "
                        + bilan.getCountExpensesPending() + " demandes pour "
                        + formatAmount(bilan.getTotalExpensesPending(), currency))
                        .setFontSize(9).setFontColor(secondaryGray).setItalic().setMarginTop(4));
            }
            if (bilan.getCountExpensesRejected() > 0) {
                doc.add(new Paragraph("Depenses rejetees : " + bilan.getCountExpensesRejected() + " demandes")
                        .setFontSize(9).setFontColor(secondaryGray).setItalic().setMarginTop(2));
            }
            doc.add(new Paragraph("").setMarginBottom(18));

            // ================================================================
            // SECTION III -- RESULTAT
            // ================================================================
            doc.add(bilanSectionTitle("SECTION III \u2014 RESULTAT", black, black));

            Table resultatTable = new Table(UnitValue.createPercentArray(new float[]{60, 40})).useAllAvailableWidth();
            addBilanHeader(resultatTable, black, white, "Poste", "Montant (TND)");

            addBilanRow(resultatTable, "Total recettes encaissees",
                    "+ " + formatAmount(bilan.getTotalRevenues(), currency), white, false);
            addBilanRow(resultatTable, "Total depenses approuvees",
                    "- " + formatAmount(bilan.getTotalExpensesApproved(), currency), rowAlt, false);

            // Solde net row
            resultatTable.addCell(new Cell()
                    .add(new Paragraph("SOLDE NET").setBold().setFontSize(12).setFontColor(black))
                    .setBackgroundColor(totalRowBg).setPadding(10)
                    .setBorderBottom(new SolidBorder(black, 1)));
            resultatTable.addCell(new Cell()
                    .add(new Paragraph(formatAmount(bilan.getSolde(), currency))
                            .setBold().setFontSize(14).setFontColor(black).setTextAlignment(TextAlignment.RIGHT))
                    .setBackgroundColor(totalRowBg).setPadding(10)
                    .setBorderBottom(new SolidBorder(black, 1)));

            // Recovery rate row
            addBilanRow(resultatTable, "Taux de recouvrement",
                    String.format("%.2f %%", bilan.getRecoveryRate()), white, false);

            doc.add(resultatTable.setMarginBottom(18));

            // ================================================================
            // SECTION IV -- SITUATION BUDGETAIRE (conditional)
            // ================================================================
            if (hasBudget) {
                doc.add(bilanSectionTitle("SECTION IV \u2014 SITUATION BUDGETAIRE", black, black));

                Table budgetTable = new Table(UnitValue.createPercentArray(new float[]{60, 40})).useAllAvailableWidth();
                addBilanHeader(budgetTable, black, white, "Poste", "Montant (TND)");

                addBilanRow(budgetTable, "Budget alloue",
                        formatAmount(bilan.getBudgetTotal(), currency), white, false);
                addBilanRow(budgetTable, "Budget consomme",
                        formatAmount(bilan.getBudgetConsumed(), currency), rowAlt, false);
                addBilanRow(budgetTable, "Budget restant",
                        formatAmount(bilan.getBudgetTotal().subtract(bilan.getBudgetConsumed()), currency), white, false);
                addBilanRow(budgetTable, "Taux de consommation",
                        bilan.getBudgetPercentage() + " %", rowAlt, false);

                doc.add(budgetTable.setMarginBottom(18));
            }

            // ================================================================
            // SECTION V -- TABLEAU RECAPITULATIF (Debit / Credit)
            // ================================================================
            String recapNum = hasBudget ? "V" : "IV";
            doc.add(bilanSectionTitle("SECTION " + recapNum + " \u2014 TABLEAU RECAPITULATIF", black, black));

            Table recap = new Table(UnitValue.createPercentArray(new float[]{50, 25, 25})).useAllAvailableWidth();
            addBilanHeader3(recap, black, white, "Poste", "Debit (TND)", "Credit (TND)");

            // Credits: cotisations
            recap.addCell(bilanCell("Cotisations encaissees", white, false, TextAlignment.LEFT));
            recap.addCell(bilanCell("", white, false, TextAlignment.RIGHT));
            recap.addCell(bilanCell(formatAmount(bilan.getTotalRevenues(), currency), white, false, TextAlignment.RIGHT));

            recap.addCell(bilanCell("Cotisations en attente", rowAlt, false, TextAlignment.LEFT));
            recap.addCell(bilanCell("", rowAlt, false, TextAlignment.RIGHT));
            recap.addCell(bilanCell(formatAmount(pendingAmount, currency), rowAlt, false, TextAlignment.RIGHT));

            boolean alt = true;
            // Debits: expense categories
            for (BilanResponse.CategoryBreakdown cat : bilan.getExpensesByCategory()) {
                DeviceRgb rowBg = alt ? white : rowAlt;
                recap.addCell(bilanCell("Depense " + cat.getCategory(), rowBg, false, TextAlignment.LEFT));
                recap.addCell(bilanCell(formatAmount(cat.getTotal(), currency), rowBg, false, TextAlignment.RIGHT));
                recap.addCell(bilanCell("", rowBg, false, TextAlignment.RIGHT));
                alt = !alt;
            }

            // TOTAL row
            BigDecimal totalDebit = bilan.getTotalExpensesApproved();
            BigDecimal totalCredit = bilan.getTotalRevenues().add(pendingAmount);
            recap.addCell(bilanCell("TOTAL", totalRowBg, true, TextAlignment.LEFT));
            recap.addCell(bilanCell(formatAmount(totalDebit, currency), totalRowBg, true, TextAlignment.RIGHT));
            recap.addCell(bilanCell(formatAmount(totalCredit, currency), totalRowBg, true, TextAlignment.RIGHT));

            // SOLDE row
            recap.addCell(bilanCell("SOLDE", totalRowBg, true, TextAlignment.LEFT));
            recap.addCell(bilanCell("", totalRowBg, true, TextAlignment.RIGHT));
            Cell soldeCell = new Cell()
                    .add(new Paragraph(formatAmount(bilan.getSolde(), currency))
                            .setBold().setFontSize(11).setFontColor(black).setTextAlignment(TextAlignment.RIGHT))
                    .setBackgroundColor(totalRowBg).setPadding(7)
                    .setBorderBottom(new SolidBorder(black, 1));
            recap.addCell(soldeCell);

            doc.add(recap.setMarginBottom(30));

            // ================================================================
            // FOOTER: Signature block
            // ================================================================
            SolidLine footerLine = new SolidLine(0.5f);
            footerLine.setColor(black);
            doc.add(new LineSeparator(footerLine).setMarginBottom(15));

            Table footerTable = new Table(UnitValue.createPercentArray(new float[]{50, 50})).useAllAvailableWidth();
            footerTable.addCell(new Cell()
                    .add(new Paragraph("Fait le " + LocalDate.now().format(dateFmt))
                            .setFontSize(10).setFontColor(black))
                    .setBorder(Border.NO_BORDER).setPadding(4));
            footerTable.addCell(new Cell()
                    .add(new Paragraph("Le Tresorier,")
                            .setFontSize(10).setFontColor(black).setTextAlignment(TextAlignment.RIGHT))
                    .setBorder(Border.NO_BORDER).setPadding(4));
            footerTable.addCell(new Cell()
                    .add(new Paragraph("").setFontSize(8))
                    .setBorder(Border.NO_BORDER).setPadding(2));
            footerTable.addCell(new Cell()
                    .add(new Paragraph("\n\n________________________")
                            .setFontSize(10).setFontColor(black).setTextAlignment(TextAlignment.RIGHT))
                    .setBorder(Border.NO_BORDER).setPadding(2));
            doc.add(footerTable);

            doc.close();
            return baos.toByteArray();
        } catch (Exception e) {
            throw new RuntimeException("Erreur generation PDF bilan: " + e.getMessage(), e);
        }
    }

    public byte[] generateExpenseInvoicePdf(Expense expense, String clubName, String memberName) {
        DeviceRgb primary = new DeviceRgb(59, 130, 246);
        DeviceRgb headerBg = new DeviceRgb(241, 245, 249);

        try (ByteArrayOutputStream baos = new ByteArrayOutputStream()) {
            PdfDocument pdf = new PdfDocument(new PdfWriter(baos));
            Document doc = new Document(pdf);

            // Header
            doc.add(new Paragraph("FACTURE DE DEPENSE").setFontSize(22).setBold().setFontColor(primary).setTextAlignment(TextAlignment.CENTER));
            doc.add(new Paragraph(clubName).setFontSize(12).setFontColor(new DeviceRgb(100, 116, 139)).setTextAlignment(TextAlignment.CENTER));
            doc.add(new Paragraph("N° FAC-" + expense.getClubId() + "-DEP-" + expense.getId())
                    .setFontSize(11).setBold().setTextAlignment(TextAlignment.CENTER).setMarginBottom(20));

            // Infos
            Table info = new Table(UnitValue.createPercentArray(new float[]{40, 60})).useAllAvailableWidth();
            addRow(info, "Date d'emission", LocalDate.now().format(DateTimeFormatter.ofPattern("dd/MM/yyyy")), headerBg);
            addRow(info, "Soumis par", memberName + " (ID: " + expense.getSubmittedByMemberId() + ")", headerBg);
            addRow(info, "Statut", expense.getStatus().name(), headerBg);
            if (expense.getCategory() != null) addRow(info, "Categorie", expense.getCategory().name(), headerBg);
            if (expense.getApprovedAt() != null) addRow(info, "Approuve le", expense.getApprovedAt().format(DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm")), headerBg);
            doc.add(info);

            // Details depense
            doc.add(new Paragraph("Detail").setFontSize(14).setBold().setFontColor(primary).setMarginTop(15));
            Table detail = new Table(UnitValue.createPercentArray(new float[]{60, 20, 20})).useAllAvailableWidth();
            addHeaderCell(detail, "Description"); addHeaderCell(detail, "Quantite"); addHeaderCell(detail, "Montant");
            detail.addCell(new Cell().add(new Paragraph(expense.getTitle() + (expense.getDescription() != null ? "\n" + expense.getDescription() : "")).setFontSize(10)));
            detail.addCell(new Cell().add(new Paragraph("1").setFontSize(10).setTextAlignment(TextAlignment.CENTER)));
            detail.addCell(new Cell().add(new Paragraph(expense.getAmount() + " TND").setFontSize(10).setTextAlignment(TextAlignment.RIGHT)));
            doc.add(detail);

            // Total
            Table totalTable = new Table(UnitValue.createPercentArray(new float[]{80, 20})).useAllAvailableWidth();
            totalTable.addCell(new Cell().add(new Paragraph("TOTAL HT").setBold().setFontSize(11)).setTextAlignment(TextAlignment.RIGHT).setBorder(null));
            totalTable.addCell(new Cell().add(new Paragraph(expense.getAmount() + " TND").setBold().setFontSize(11)).setTextAlignment(TextAlignment.RIGHT).setBorder(null));
            totalTable.addCell(new Cell().add(new Paragraph("TVA (20%)").setFontSize(10)).setTextAlignment(TextAlignment.RIGHT).setBorder(null));
            BigDecimal tva = expense.getAmount().multiply(new BigDecimal("0.20")).setScale(2, RoundingMode.HALF_UP);
            totalTable.addCell(new Cell().add(new Paragraph(tva + " TND").setFontSize(10)).setTextAlignment(TextAlignment.RIGHT).setBorder(null));
            totalTable.addCell(new Cell().add(new Paragraph("TOTAL TTC").setBold().setFontSize(12).setFontColor(primary)).setTextAlignment(TextAlignment.RIGHT).setBorder(null));
            totalTable.addCell(new Cell().add(new Paragraph(expense.getAmount().add(tva) + " TND").setBold().setFontSize(12).setFontColor(primary)).setTextAlignment(TextAlignment.RIGHT).setBorder(null));
            doc.add(totalTable.setMarginTop(10));

            if (expense.getJustificatifUrl() != null) {
                doc.add(new Paragraph("Justificatif: " + expense.getJustificatifUrl()).setFontSize(9).setFontColor(new DeviceRgb(148, 163, 184)).setMarginTop(15));
            }

            doc.add(new Paragraph("Document genere par ClubHub | Facture non fiscale")
                    .setFontSize(8).setFontColor(new DeviceRgb(148, 163, 184)).setTextAlignment(TextAlignment.CENTER).setMarginTop(40));

            doc.close();
            return baos.toByteArray();
        } catch (Exception e) {
            throw new RuntimeException("Erreur generation facture: " + e.getMessage(), e);
        }
    }

    // === PDF Helper Methods (Bilan) ===

    private static final SolidBorder CELL_BORDER = new SolidBorder(new DeviceRgb(0, 0, 0), 1f);

    private Paragraph bilanSectionTitle(String title, DeviceRgb color, DeviceRgb underlineColor) {
        Paragraph p = new Paragraph(title)
                .setFontSize(13).setBold().setFontColor(color)
                .setMarginTop(8).setMarginBottom(2)
                .setBorderBottom(new SolidBorder(underlineColor, 1f))
                .setPaddingBottom(4);
        return p;
    }

    private String formatAmount(BigDecimal amount, String currency) {
        return String.format("%,.2f %s", amount, currency);
    }

    /** 2-column header row */
    private void addBilanHeader(Table table, DeviceRgb bg, DeviceRgb fontColor, String col1, String col2) {
        table.addCell(new Cell().add(new Paragraph(col1).setBold().setFontSize(9).setFontColor(fontColor))
                .setBackgroundColor(bg).setPadding(7).setBorderBottom(CELL_BORDER));
        table.addCell(new Cell().add(new Paragraph(col2).setBold().setFontSize(9).setFontColor(fontColor)
                .setTextAlignment(TextAlignment.RIGHT))
                .setBackgroundColor(bg).setPadding(7).setBorderBottom(CELL_BORDER));
    }

    /** 3-column header row */
    private void addBilanHeader3(Table table, DeviceRgb bg, DeviceRgb fontColor, String c1, String c2, String c3) {
        table.addCell(new Cell().add(new Paragraph(c1).setBold().setFontSize(9).setFontColor(fontColor))
                .setBackgroundColor(bg).setPadding(7).setBorderBottom(CELL_BORDER));
        table.addCell(new Cell().add(new Paragraph(c2).setBold().setFontSize(9).setFontColor(fontColor)
                .setTextAlignment(TextAlignment.RIGHT))
                .setBackgroundColor(bg).setPadding(7).setBorderBottom(CELL_BORDER));
        table.addCell(new Cell().add(new Paragraph(c3).setBold().setFontSize(9).setFontColor(fontColor)
                .setTextAlignment(TextAlignment.RIGHT))
                .setBackgroundColor(bg).setPadding(7).setBorderBottom(CELL_BORDER));
    }

    /** 4-column header row */
    private void addBilanHeader4(Table table, DeviceRgb bg, DeviceRgb fontColor,
                                  String c1, String c2, String c3, String c4) {
        table.addCell(new Cell().add(new Paragraph(c1).setBold().setFontSize(9).setFontColor(fontColor))
                .setBackgroundColor(bg).setPadding(7).setBorderBottom(CELL_BORDER));
        table.addCell(new Cell().add(new Paragraph(c2).setBold().setFontSize(9).setFontColor(fontColor)
                .setTextAlignment(TextAlignment.CENTER))
                .setBackgroundColor(bg).setPadding(7).setBorderBottom(CELL_BORDER));
        table.addCell(new Cell().add(new Paragraph(c3).setBold().setFontSize(9).setFontColor(fontColor)
                .setTextAlignment(TextAlignment.RIGHT))
                .setBackgroundColor(bg).setPadding(7).setBorderBottom(CELL_BORDER));
        table.addCell(new Cell().add(new Paragraph(c4).setBold().setFontSize(9).setFontColor(fontColor)
                .setTextAlignment(TextAlignment.CENTER))
                .setBackgroundColor(bg).setPadding(7).setBorderBottom(CELL_BORDER));
    }

    /** 2-column data row */
    private void addBilanRow(Table table, String label, String value, DeviceRgb bg, boolean bold) {
        Paragraph lp = new Paragraph(label).setFontSize(10);
        Paragraph vp = new Paragraph(value).setFontSize(10).setTextAlignment(TextAlignment.RIGHT);
        if (bold) { lp.setBold(); vp.setBold(); }
        table.addCell(new Cell().add(lp).setBackgroundColor(bg).setPadding(7).setBorderBottom(CELL_BORDER));
        table.addCell(new Cell().add(vp).setBackgroundColor(bg).setPadding(7).setBorderBottom(CELL_BORDER));
    }

    /** 2-column bold total row */
    private void addBilanTotalRow(Table table, String label, String value, DeviceRgb bg, DeviceRgb fontColor) {
        table.addCell(new Cell().add(new Paragraph(label).setBold().setFontSize(11).setFontColor(fontColor))
                .setBackgroundColor(bg).setPadding(9).setBorderBottom(CELL_BORDER));
        table.addCell(new Cell().add(new Paragraph(value).setBold().setFontSize(11).setFontColor(fontColor)
                .setTextAlignment(TextAlignment.RIGHT))
                .setBackgroundColor(bg).setPadding(9).setBorderBottom(CELL_BORDER));
    }

    /** 4-column data row */
    private void addBilanRow4(Table table, String c1, String c2, String c3, String c4,
                               DeviceRgb bg, boolean bold) {
        Paragraph p1 = new Paragraph(c1).setFontSize(10);
        Paragraph p2 = new Paragraph(c2).setFontSize(10).setTextAlignment(TextAlignment.CENTER);
        Paragraph p3 = new Paragraph(c3).setFontSize(10).setTextAlignment(TextAlignment.RIGHT);
        Paragraph p4 = new Paragraph(c4).setFontSize(10).setTextAlignment(TextAlignment.CENTER);
        if (bold) { p1.setBold(); p2.setBold(); p3.setBold(); p4.setBold(); }
        table.addCell(new Cell().add(p1).setBackgroundColor(bg).setPadding(7).setBorderBottom(CELL_BORDER));
        table.addCell(new Cell().add(p2).setBackgroundColor(bg).setPadding(7).setBorderBottom(CELL_BORDER));
        table.addCell(new Cell().add(p3).setBackgroundColor(bg).setPadding(7).setBorderBottom(CELL_BORDER));
        table.addCell(new Cell().add(p4).setBackgroundColor(bg).setPadding(7).setBorderBottom(CELL_BORDER));
    }

    /** Generic cell builder for recap table */
    private Cell bilanCell(String text, DeviceRgb bg, boolean bold, TextAlignment align) {
        Paragraph p = new Paragraph(text).setFontSize(10).setTextAlignment(align);
        if (bold) p.setBold();
        return new Cell().add(p).setBackgroundColor(bg).setPadding(7).setBorderBottom(CELL_BORDER);
    }

    private void addRow(Table table, String label, String value, DeviceRgb bg) {
        table.addCell(new Cell().add(new Paragraph(label).setBold().setFontSize(10)).setBackgroundColor(bg).setPadding(6));
        table.addCell(new Cell().add(new Paragraph(value).setFontSize(10)).setPadding(6));
    }

    private void addHeaderCell(Table table, String text) {
        table.addCell(new Cell().add(new Paragraph(text).setBold().setFontSize(9).setFontColor(new DeviceRgb(100, 116, 139)))
                .setBackgroundColor(new DeviceRgb(241, 245, 249)).setPadding(5));
    }
}
