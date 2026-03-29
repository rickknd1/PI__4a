package com.clubhub.treasury.controller;

import com.clubhub.treasury.dto.request.CreateExpenseRequest;
import com.clubhub.treasury.entity.Expense;
import com.clubhub.treasury.entity.Expense.ExpenseStatus;
import com.clubhub.treasury.service.ExpenseService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/treasury/{clubId}/expenses")
@RequiredArgsConstructor
@Tag(name = "Depenses", description = "Workflow de gestion des depenses")
public class ExpenseController {

    private final ExpenseService expenseService;

    @GetMapping
    public ResponseEntity<List<Expense>> getAll(@PathVariable Long clubId,
            @RequestParam(required = false) ExpenseStatus status) {
        if (status != null) return ResponseEntity.ok(expenseService.getByStatus(clubId, status));
        return ResponseEntity.ok(expenseService.getByClub(clubId));
    }

    @PostMapping
    @Operation(summary = "Soumettre une depense")
    public ResponseEntity<Expense> submit(@PathVariable Long clubId,
            @Valid @RequestBody CreateExpenseRequest req,
            @RequestHeader("X-Actor-Id") Long memberId) {
        return ResponseEntity.status(201).body(expenseService.submit(clubId, memberId, req));
    }

    @PatchMapping("/{expenseId}/validate")
    @Operation(summary = "Valider une depense (tresorier)")
    public ResponseEntity<Expense> validate(@PathVariable Long clubId, @PathVariable Long expenseId,
            @RequestHeader("X-Actor-Id") Long actorId,
            @RequestHeader("X-Actor-Email") String actorEmail) {
        return ResponseEntity.ok(expenseService.validate(expenseId, actorId, actorEmail));
    }

    @PatchMapping("/{expenseId}/approve")
    @Operation(summary = "Approuver une depense (president)")
    public ResponseEntity<Expense> approve(@PathVariable Long clubId, @PathVariable Long expenseId,
            @RequestHeader("X-Actor-Id") Long actorId,
            @RequestHeader("X-Actor-Email") String actorEmail) {
        return ResponseEntity.ok(expenseService.approve(expenseId, actorId, actorEmail));
    }

    @PatchMapping("/{expenseId}/reject")
    @Operation(summary = "Rejeter une depense")
    public ResponseEntity<Expense> reject(@PathVariable Long clubId, @PathVariable Long expenseId,
            @RequestHeader("X-Actor-Id") Long actorId,
            @RequestHeader("X-Actor-Email") String actorEmail,
            @RequestBody Map<String, String> body) {
        return ResponseEntity.ok(expenseService.reject(expenseId, actorId, actorEmail, body.get("reason")));
    }
}
