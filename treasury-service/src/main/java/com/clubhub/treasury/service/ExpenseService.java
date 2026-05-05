package com.clubhub.treasury.service;

import com.clubhub.treasury.dto.request.CreateExpenseRequest;
import com.clubhub.treasury.entity.Expense;
import com.clubhub.treasury.entity.Expense.ExpenseStatus;
import com.clubhub.treasury.exception.TreasuryException;
import com.clubhub.treasury.repository.BudgetRepository;
import com.clubhub.treasury.repository.ExpenseRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ExpenseService {

    private static final Logger log = LoggerFactory.getLogger(ExpenseService.class);

    private final ExpenseRepository expenseRepository;
    private final BudgetRepository budgetRepository;
    private final AuditService auditService;
    private final GeminiService geminiService;
    private final NotificationService notificationService;
    private final BilanService bilanService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Transactional
    public Expense submit(Long clubId, String memberId, CreateExpenseRequest req) {
        // Validate exactly 3 quotes
        if (req.getQuotes() == null || req.getQuotes().size() != 3) {
            throw new TreasuryException("Exactly 3 quotes from different providers are required", 400);
        }

        // Map quote requests to Quote entities
        List<Expense.Quote> quotes = req.getQuotes().stream()
                .map(q -> Expense.Quote.builder()
                        .providerName(q.getProviderName())
                        .amount(q.getAmount())
                        .description(q.getDescription())
                        .selected(false)
                        .build())
                .collect(Collectors.toList());

        Expense expense = Expense.builder()
                .clubId(clubId)
                .submittedByMemberId(memberId)
                .title(req.getTitle())
                .description(req.getDescription())
                .amount(req.getAmount())
                .justificatifUrl(req.getJustificatifUrl())
                .quotes(quotes)
                .status(ExpenseStatus.SUBMITTED)
                .build();

        // BF13 — Categorisation automatique via Gemini
        try {
            String response = geminiService.categorizeExpense(req.getTitle(), req.getDescription());
            String json = response;
            if (json.contains("{")) {
                json = json.substring(json.indexOf("{"));
                json = json.substring(0, json.lastIndexOf("}") + 1);
            }
            JsonNode node = objectMapper.readTree(json);
            String category = node.has("category") ? node.get("category").asText() : "AUTRE";
            int confidence = node.has("confidence") ? node.get("confidence").asInt() : 50;
            expense.setCategory(Expense.ExpenseCategory.valueOf(category));
            expense.setCategoryConfidenceScore(confidence);
            log.info("Auto-categorized expense '{}' as {} ({}%)", req.getTitle(), category, confidence);
        } catch (Exception e) {
            log.warn("Auto-categorization failed for '{}': {}", req.getTitle(), e.getMessage());
            expense.setCategory(Expense.ExpenseCategory.AUTRE);
            expense.setCategoryConfidenceScore(0);
        }

        Expense saved = expenseRepository.save(expense);
        notificationService.notifyExpenseSubmitted(clubId, memberId, req.getTitle(), req.getAmount().toPlainString());
        return saved;
    }

    @Transactional
    public Expense validate(String expenseId, String treasurerId, String actorEmail, int selectedQuoteIndex) {
        Expense expense = getOrThrow(expenseId);
        if (expense.getStatus() != ExpenseStatus.SUBMITTED)
            throw new TreasuryException("Expense must be in SUBMITTED status to validate", 400);

        // Select the chosen quote and update the expense amount
        List<Expense.Quote> quotes = expense.getQuotes();
        if (quotes == null || quotes.isEmpty()) {
            throw new TreasuryException("This expense has no quotes attached", 400);
        }
        if (selectedQuoteIndex < 0 || selectedQuoteIndex >= quotes.size()) {
            throw new TreasuryException("Invalid quote index: " + selectedQuoteIndex + ". Must be 0-" + (quotes.size() - 1), 400);
        }
        // Mark only the selected quote
        for (int i = 0; i < quotes.size(); i++) {
            quotes.get(i).setSelected(i == selectedQuoteIndex);
        }
        expense.setQuotes(quotes);
        // Update the expense amount to match the selected quote
        expense.setAmount(quotes.get(selectedQuoteIndex).getAmount());

        expense.setStatus(ExpenseStatus.VALIDATED);
        expense.setValidatedByTreasurerId(treasurerId);
        expense.setValidatedAt(LocalDateTime.now());
        Expense saved = expenseRepository.save(expense);
        auditService.log(treasurerId, actorEmail, expense.getClubId(), "EXPENSE_VALIDATED", "Expense", expenseId, "SUBMITTED", "VALIDATED", expense.getAmount());
        notificationService.notifyExpenseValidated(expense.getClubId(), expense.getSubmittedByMemberId(), expense.getTitle());
        return saved;
    }

    @Transactional
    public Expense approve(String expenseId, String presidentId, String actorEmail) {
        Expense expense = getOrThrow(expenseId);
        if (expense.getStatus() != ExpenseStatus.VALIDATED)
            throw new TreasuryException("Expense must be VALIDATED before approval", 400);
        expense.setStatus(ExpenseStatus.APPROVED);
        expense.setApprovedByPresidentId(presidentId);
        expense.setApprovedAt(LocalDateTime.now());
        // Update budget consumed amount
        budgetRepository.findFirstByClubIdAndPeriodStartLessThanEqualAndPeriodEndGreaterThanEqualOrderByCreatedAtDesc(
                expense.getClubId(), LocalDate.now(), LocalDate.now())
                .ifPresent(budget -> {
                    budget.setConsumedAmount(budget.getConsumedAmount().add(expense.getAmount()));
                    budgetRepository.save(budget);
                });
        Expense saved = expenseRepository.save(expense);
        auditService.log(presidentId, actorEmail, expense.getClubId(), "EXPENSE_APPROVED", "Expense", expenseId, "VALIDATED", "APPROVED", expense.getAmount());

        // Generer facture PDF et envoyer par email au soumetteur
        try {
            byte[] invoicePdf = bilanService.generateExpenseInvoicePdf(saved, "Club #" + expense.getClubId(), "Membre #" + expense.getSubmittedByMemberId());
            notificationService.notifyExpenseApprovedWithInvoice(
                    expense.getClubId(), expense.getSubmittedByMemberId(),
                    expense.getTitle(), expense.getAmount().toPlainString(), invoicePdf);
            log.info("Facture PDF envoyee par email pour depense #{}", expenseId);
        } catch (Exception e) {
            log.warn("Facture PDF non envoyee pour depense #{}: {}", expenseId, e.getMessage());
            notificationService.notifyExpenseApproved(expense.getClubId(), expense.getSubmittedByMemberId(), expense.getTitle(), expense.getAmount().toPlainString());
        }

        return saved;
    }

    @Transactional
    public Expense reject(String expenseId, String actorId, String actorEmail, String reason) {
        Expense expense = getOrThrow(expenseId);
        if (expense.getStatus() == ExpenseStatus.APPROVED)
            throw new TreasuryException("Cannot reject an already approved expense", 400);
        String previousStatus = expense.getStatus().name();
        expense.setStatus(ExpenseStatus.REJECTED);
        expense.setRejectionReason(reason);
        Expense saved = expenseRepository.save(expense);
        auditService.log(actorId, actorEmail, expense.getClubId(), "EXPENSE_REJECTED", "Expense", expenseId, previousStatus, "REJECTED", expense.getAmount());
        notificationService.notifyExpenseRejected(expense.getClubId(), expense.getSubmittedByMemberId(), expense.getTitle(), reason);
        return saved;
    }

    public List<Expense> getByClub(Long clubId) {
        return expenseRepository.findByClubIdOrderByCreatedAtDesc(clubId);
    }

    public List<Expense> getByStatus(Long clubId, ExpenseStatus status) {
        return expenseRepository.findByClubIdAndStatus(clubId, status);
    }

    private Expense getOrThrow(String id) {
        return expenseRepository.findById(id)
                .orElseThrow(() -> new TreasuryException("Expense not found: " + id, 404));
    }
}
