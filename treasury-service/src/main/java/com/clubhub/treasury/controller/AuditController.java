package com.clubhub.treasury.controller;

import com.clubhub.treasury.entity.AuditLog;
import com.clubhub.treasury.service.AuditService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/treasury/{clubId}/audit")
@RequiredArgsConstructor
@Tag(name = "Audit", description = "Journal d'audit immuable")
public class AuditController {

    private final AuditService auditService;

    @GetMapping
    @Operation(summary = "Recuperer le journal d'audit du club")
    public ResponseEntity<List<AuditLog>> getAuditLog(@PathVariable Long clubId) {
        return ResponseEntity.ok(auditService.getByClub(clubId));
    }
}
