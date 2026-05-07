package com.clubhub.treasury.controller;

import com.clubhub.treasury.dto.request.CreateExpenseRequest;
import com.clubhub.treasury.entity.Expense;
import com.clubhub.treasury.entity.Expense.ExpenseStatus;
import com.clubhub.treasury.entity.User;
import com.clubhub.treasury.security.CurrentUser;
import com.clubhub.treasury.security.Roles;
import com.clubhub.treasury.service.ExpenseService;
import com.clubhub.treasury.service.UserContextService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/treasury/{clubId}/expenses")
@RequiredArgsConstructor
@Tag(name = "Depenses", description = "Workflow de gestion des depenses")
public class ExpenseController {

    private final ExpenseService expenseService;
    private final UserContextService userContextService;

    @GetMapping
    @PreAuthorize(Roles.READ_REPORTS)
    public ResponseEntity<List<Map<String, Object>>> getAll(@PathVariable String clubId,
            @RequestParam(required = false) ExpenseStatus status) {
        List<Expense> expenses = status != null
                ? expenseService.getByStatus(clubId, status)
                : expenseService.getByClub(clubId);
        // Enrichir avec les noms des membres
        Set<String> ids = expenses.stream().map(Expense::getSubmittedByMemberId).filter(Objects::nonNull).collect(Collectors.toSet());
        Map<String, String> names = new HashMap<>();
        for (String id : ids) {
            try { User u = userContextService.getUser(id); names.put(id, u.getFirstName() + " " + u.getLastName()); }
            catch (Exception e) { names.put(id, "Membre"); }
        }
        List<Map<String, Object>> result = expenses.stream().map(e -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", e.getId()); m.put("clubId", e.getClubId());
            m.put("submittedByMemberId", e.getSubmittedByMemberId());
            m.put("submittedByMemberName", names.getOrDefault(e.getSubmittedByMemberId(), "Membre"));
            m.put("title", e.getTitle()); m.put("description", e.getDescription());
            m.put("amount", e.getAmount()); m.put("status", e.getStatus());
            m.put("category", e.getCategory()); m.put("categoryConfidenceScore", e.getCategoryConfidenceScore());
            m.put("categoryValidatedByTreasurer", e.isCategoryValidatedByTreasurer());
            m.put("quotes", e.getQuotes());
            m.put("submittedAt", e.getCreatedAt()); m.put("validatedAt", e.getValidatedAt());
            m.put("approvedAt", e.getApprovedAt()); m.put("rejectionReason", e.getRejectionReason());
            return m;
        }).collect(Collectors.toList());
        return ResponseEntity.ok(result);
    }

    @PostMapping
    @Operation(summary = "Soumettre une depense — tout authentifie (membre simple inclus)")
    @PreAuthorize(Roles.AUTHENTICATED)
    public ResponseEntity<Expense> submit(@PathVariable String clubId,
            @Valid @RequestBody CreateExpenseRequest req) {
        String memberId = CurrentUser.userId();
        return ResponseEntity.status(201).body(expenseService.submit(clubId, memberId != null ? memberId : "unknown", req));
    }

    @PatchMapping("/{expenseId}/validate")
    @Operation(summary = "Valider une depense (tresorier — N1) — selectionne le devis retenu")
    @PreAuthorize(Roles.TRESORIER_ONLY)
    public ResponseEntity<Expense> validate(@PathVariable String clubId, @PathVariable String expenseId,
            @RequestHeader(value = "X-Actor-Id", defaultValue = "1") String actorId,
            @RequestHeader(value = "X-Actor-Email", defaultValue = "dev@clubhub.tn") String actorEmail,
            @RequestBody Map<String, Object> body) {
        int selectedQuoteIndex = body.containsKey("selectedQuoteIndex")
                ? ((Number) body.get("selectedQuoteIndex")).intValue()
                : 0;
        return ResponseEntity.ok(expenseService.validate(expenseId, actorId, actorEmail, selectedQuoteIndex));
    }

    @PatchMapping("/{expenseId}/approve")
    @Operation(summary = "Approuver une depense (president/VP/SG — N2)")
    @PreAuthorize(Roles.APPROVE_EXPENSES)
    public ResponseEntity<Expense> approve(@PathVariable String clubId, @PathVariable String expenseId,
            @RequestHeader(value = "X-Actor-Id", defaultValue = "1") String actorId,
            @RequestHeader(value = "X-Actor-Email", defaultValue = "dev@clubhub.tn") String actorEmail) {
        return ResponseEntity.ok(expenseService.approve(expenseId, actorId, actorEmail));
    }

    @PatchMapping("/{expenseId}/reject")
    @Operation(summary = "Rejeter une depense (tresorier ou bureau)")
    @PreAuthorize(Roles.BUREAU_OR_TRESORIER)
    public ResponseEntity<Expense> reject(@PathVariable String clubId, @PathVariable String expenseId,
            @RequestHeader(value = "X-Actor-Id", defaultValue = "1") String actorId,
            @RequestHeader(value = "X-Actor-Email", defaultValue = "dev@clubhub.tn") String actorEmail,
            @RequestBody Map<String, String> body) {
        return ResponseEntity.ok(expenseService.reject(expenseId, actorId, actorEmail, body.get("reason")));
    }
}
