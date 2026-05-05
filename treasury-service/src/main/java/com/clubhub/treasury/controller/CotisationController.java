package com.clubhub.treasury.controller;

import com.clubhub.treasury.dto.request.CreateCotisationRuleRequest;
import com.clubhub.treasury.entity.CotisationRule;
import com.clubhub.treasury.entity.Payment;
import com.clubhub.treasury.security.Roles;
import com.clubhub.treasury.service.CotisationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/treasury/{clubId}/cotisations")
@RequiredArgsConstructor
@Tag(name = "Cotisations", description = "Gestion des regles de cotisation")
public class CotisationController {

    private final CotisationService cotisationService;

    @GetMapping("/rules")
    @Operation(summary = "Lister les regles de cotisation actives")
    @PreAuthorize(Roles.AUTHENTICATED)
    public ResponseEntity<List<CotisationRule>> getRules(@PathVariable Long clubId) {
        return ResponseEntity.ok(cotisationService.getActiveRules(clubId));
    }

    @PostMapping("/rules")
    @Operation(summary = "Creer une regle de cotisation")
    @PreAuthorize(Roles.TRESORIER_ONLY)
    public ResponseEntity<CotisationRule> createRule(
            @PathVariable Long clubId,
            @Valid @RequestBody CreateCotisationRuleRequest request,
            @RequestHeader(value = "X-Actor-Id", defaultValue = "1") String actorId,
            @RequestHeader(value = "X-Actor-Email", defaultValue = "dev@clubhub.tn") String actorEmail) {
        return ResponseEntity.status(201).body(
                cotisationService.createRule(clubId, request, actorId, actorEmail));
    }

    @PostMapping("/rules/{ruleId}/assign")
    @Operation(summary = "Assigner une regle a des membres")
    @PreAuthorize(Roles.TRESORIER_ONLY)
    public ResponseEntity<List<Payment>> assignToMembers(
            @PathVariable Long clubId,
            @PathVariable String ruleId,
            @RequestBody List<String> memberIds) {
        return ResponseEntity.ok(cotisationService.assignToMembers(ruleId, memberIds, clubId));
    }
}
