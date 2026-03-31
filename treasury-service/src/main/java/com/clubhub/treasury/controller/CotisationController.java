package com.clubhub.treasury.controller;

import com.clubhub.treasury.dto.request.CreateCotisationRuleRequest;
import com.clubhub.treasury.entity.CotisationRule;
import com.clubhub.treasury.entity.Payment;
import com.clubhub.treasury.service.CotisationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
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
    public ResponseEntity<List<CotisationRule>> getRules(@PathVariable Long clubId) {
        return ResponseEntity.ok(cotisationService.getActiveRules(clubId));
    }

    @PostMapping("/rules")
    @Operation(summary = "Creer une regle de cotisation")
    public ResponseEntity<CotisationRule> createRule(
            @PathVariable Long clubId,
            @Valid @RequestBody CreateCotisationRuleRequest request,
            @RequestHeader(value = "X-Actor-Id", defaultValue = "1") Long actorId,
            @RequestHeader(value = "X-Actor-Email", defaultValue = "dev@clubhub.tn") String actorEmail) {
        return ResponseEntity.status(201).body(
                cotisationService.createRule(clubId, request, actorId, actorEmail));
    }

    @PostMapping("/rules/{ruleId}/assign")
    @Operation(summary = "Assigner une regle a des membres")
    public ResponseEntity<List<Payment>> assignToMembers(
            @PathVariable Long clubId,
            @PathVariable Long ruleId,
            @RequestBody List<Long> memberIds) {
        return ResponseEntity.ok(cotisationService.assignToMembers(ruleId, memberIds, clubId));
    }
}
