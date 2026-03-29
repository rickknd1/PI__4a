package com.clubhub.treasury.service;

import com.clubhub.treasury.dto.request.CreateExpenseRequest;
import com.clubhub.treasury.entity.Expense;
import com.clubhub.treasury.entity.Expense.ExpenseStatus;
import com.clubhub.treasury.exception.TreasuryException;
import com.clubhub.treasury.repository.BudgetRepository;
import com.clubhub.treasury.repository.ExpenseRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ExpenseService {

    private final ExpenseRepository expenseRepository;
    private final BudgetRepository budgetRepository;
    private final AuditService auditService;

    @Transactional
    public Expense submit(Long clubId, Long memberId, CreateExpenseRequest req) {
        Expense expense = Expense.builder()
                .clubId(clubId)
                .submittedByMemberId(memberId)
                .title(req.getTitle())
                .description(req.getDescription())
                .amount(req.getAmount())
                .justificatifUrl(req.getJustificatifUrl())
                .build();
        return expenseRepository.save(expense);
    }

    @Transactional
    public Expense validate(Long expenseId, Long treasurerId, String actorEmail) {
        Expense expense = getOrThrow(expenseId);
        if (expense.getStatus() != ExpenseStatus.SUBMITTED)
            throw new TreasuryException("Expense must be in SUBMITTED status to validate", 400);
        expense.setStatus(ExpenseStatus.VALIDATED);
        expense.setValidatedByTreasurerId(treasurerId);
        expense.setValidatedAt(LocalDateTime.now());
        Expense saved = expenseRepository.save(expense);
        auditService.log(treasurerId, actorEmail, expense.getClubId(), "EXPENSE_VALIDATED", "Expense", expenseId, "SUBMITTED", "VALIDATED", expense.getAmount());
        return saved;
    }

    @Transactional
    public Expense approve(Long expenseId, Long presidentId, String actorEmail) {
        Expense expense = getOrThrow(expenseId);
        if (expense.getStatus() != ExpenseStatus.VALIDATED)
            throw new TreasuryException("Expense must be VALIDATED before approval", 400);
        expense.setStatus(ExpenseStatus.APPROVED);
        expense.setApprovedByPresidentId(presidentId);
        expense.setApprovedAt(LocalDateTime.now());
        // Update budget consumed amount
        budgetRepository.findByClubIdAndPeriodStartLessThanEqualAndPeriodEndGreaterThanEqual(
                expense.getClubId(), LocalDate.now(), LocalDate.now())
                .ifPresent(budget -> {
                    budget.setConsumedAmount(budget.getConsumedAmount().add(expense.getAmount()));
                    budgetRepository.save(budget);
                });
        Expense saved = expenseRepository.save(expense);
        auditService.log(presidentId, actorEmail, expense.getClubId(), "EXPENSE_APPROVED", "Expense", expenseId, "VALIDATED", "APPROVED", expense.getAmount());
        return saved;
    }

    @Transactional
    public Expense reject(Long expenseId, Long actorId, String actorEmail, String reason) {
        Expense expense = getOrThrow(expenseId);
        if (expense.getStatus() == ExpenseStatus.APPROVED)
            throw new TreasuryException("Cannot reject an already approved expense", 400);
        String previousStatus = expense.getStatus().name();
        expense.setStatus(ExpenseStatus.REJECTED);
        expense.setRejectionReason(reason);
        Expense saved = expenseRepository.save(expense);
        auditService.log(actorId, actorEmail, expense.getClubId(), "EXPENSE_REJECTED", "Expense", expenseId, previousStatus, "REJECTED", expense.getAmount());
        return saved;
    }

    public List<Expense> getByClub(Long clubId) {
        return expenseRepository.findByClubIdOrderByCreatedAtDesc(clubId);
    }

    public List<Expense> getByStatus(Long clubId, ExpenseStatus status) {
        return expenseRepository.findByClubIdAndStatus(clubId, status);
    }

    private Expense getOrThrow(Long id) {
        return expenseRepository.findById(id)
                .orElseThrow(() -> new TreasuryException("Expense not found: " + id, 404));
    }
}
