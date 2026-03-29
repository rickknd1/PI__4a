package com.clubhub.treasury.controller;

import com.clubhub.treasury.dto.response.DashboardResponse;
import com.clubhub.treasury.service.DashboardService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/treasury/{clubId}/dashboard")
@RequiredArgsConstructor
@Tag(name = "Dashboard", description = "KPIs et metriques financieres")
public class DashboardController {

    private final DashboardService dashboardService;

    @GetMapping
    @Operation(summary = "Recuperer le dashboard financier du club")
    public ResponseEntity<DashboardResponse> getDashboard(@PathVariable Long clubId) {
        return ResponseEntity.ok(dashboardService.getDashboard(clubId));
    }
}
