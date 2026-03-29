package com.clubhub.treasury.service;

import com.clubhub.treasury.dto.request.CreateBudgetRequest;
import com.clubhub.treasury.entity.Budget;
import com.clubhub.treasury.exception.TreasuryException;
import com.clubhub.treasury.repository.BudgetRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class BudgetService {

    private final BudgetRepository budgetRepository;

    @Transactional
    public Budget create(Long clubId, CreateBudgetRequest req) {
        Budget budget = Budget.builder()
                .clubId(clubId)
                .label(req.getLabel())
                .totalAmount(req.getTotalAmount())
                .periodStart(req.getPeriodStart())
                .periodEnd(req.getPeriodEnd())
                .build();
        return budgetRepository.save(budget);
    }

    public List<Budget> getByClub(Long clubId) {
        return budgetRepository.findByClubId(clubId);
    }

    public Budget getOrThrow(Long id) {
        return budgetRepository.findById(id)
                .orElseThrow(() -> new TreasuryException("Budget not found: " + id, 404));
    }
}
