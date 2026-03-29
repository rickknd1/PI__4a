package com.clubhub.treasury.controller;

import com.clubhub.treasury.dto.request.CreateBudgetRequest;
import com.clubhub.treasury.entity.Budget;
import com.clubhub.treasury.service.BudgetService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/treasury/{clubId}/budgets")
@RequiredArgsConstructor
@Tag(name = "Budget", description = "Gestion budgetaire")
public class BudgetController {

    private final BudgetService budgetService;

    @GetMapping
    public ResponseEntity<List<Budget>> getAll(@PathVariable Long clubId) {
        return ResponseEntity.ok(budgetService.getByClub(clubId));
    }

    @PostMapping
    @Operation(summary = "Creer un budget")
    public ResponseEntity<Budget> create(@PathVariable Long clubId,
            @Valid @RequestBody CreateBudgetRequest req) {
        return ResponseEntity.status(201).body(budgetService.create(clubId, req));
    }
}
