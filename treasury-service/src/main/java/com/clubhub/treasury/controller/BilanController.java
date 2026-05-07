package com.clubhub.treasury.controller;

import com.clubhub.treasury.dto.response.BilanResponse;
import com.clubhub.treasury.entity.Expense;
import com.clubhub.treasury.repository.ExpenseRepository;
import com.clubhub.treasury.security.Roles;
import com.clubhub.treasury.service.BilanService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;

@RestController
@RequestMapping("/api/v1/treasury/{clubId}/bilans")
@PreAuthorize(Roles.READ_REPORTS)
public class BilanController {

    private final BilanService bilanService;
    private final ExpenseRepository expenseRepository;

    public BilanController(BilanService bilanService, ExpenseRepository expenseRepository) {
        this.bilanService = bilanService;
        this.expenseRepository = expenseRepository;
    }

    @GetMapping
    public ResponseEntity<BilanResponse> getBilan(
            @PathVariable String clubId,
            @RequestParam String start,
            @RequestParam String end,
            @RequestParam(defaultValue = "Bilan personnalise") String label) {
        return ResponseEntity.ok(bilanService.generateBilan(clubId, LocalDate.parse(start), LocalDate.parse(end), label));
    }

    @GetMapping("/trimestre")
    public ResponseEntity<BilanResponse> trimestriel(@PathVariable String clubId, @RequestParam(defaultValue = "1") int q, @RequestParam(defaultValue = "2026") int year) {
        LocalDate start = LocalDate.of(year, (q - 1) * 3 + 1, 1);
        LocalDate end = start.plusMonths(3).minusDays(1);
        return ResponseEntity.ok(bilanService.generateBilan(clubId, start, end, "Bilan T" + q + " " + year));
    }

    @GetMapping("/semestre")
    public ResponseEntity<BilanResponse> semestriel(@PathVariable String clubId, @RequestParam(defaultValue = "1") int s, @RequestParam(defaultValue = "2026") int year) {
        LocalDate start = LocalDate.of(year, (s - 1) * 6 + 1, 1);
        LocalDate end = start.plusMonths(6).minusDays(1);
        return ResponseEntity.ok(bilanService.generateBilan(clubId, start, end, "Bilan S" + s + " " + year));
    }

    @GetMapping("/annuel")
    public ResponseEntity<BilanResponse> annuel(@PathVariable String clubId, @RequestParam(defaultValue = "2026") int year) {
        return ResponseEntity.ok(bilanService.generateBilan(clubId, LocalDate.of(year, 1, 1), LocalDate.of(year, 12, 31), "Bilan annuel " + year));
    }

    // PDF exports
    @GetMapping("/pdf")
    public ResponseEntity<byte[]> bilanPdf(@PathVariable String clubId, @RequestParam String start, @RequestParam String end, @RequestParam(defaultValue = "Bilan") String label) {
        byte[] pdf = bilanService.generateBilanPdf(clubId, LocalDate.parse(start), LocalDate.parse(end), label);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=bilan-" + start + "-" + end + ".pdf")
                .contentType(MediaType.APPLICATION_PDF).body(pdf);
    }

    // Facture depense
    @GetMapping("/facture/{expenseId}")
    public ResponseEntity<byte[]> factureExpense(
            @PathVariable String clubId, @PathVariable String expenseId,
            @RequestParam(defaultValue = "Club") String clubName,
            @RequestParam(defaultValue = "Membre") String memberName) {
        Expense expense = expenseRepository.findById(expenseId).orElseThrow(() -> new RuntimeException("Expense not found"));
        byte[] pdf = bilanService.generateExpenseInvoicePdf(expense, clubName, memberName);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=facture-DEP-" + expenseId + ".pdf")
                .contentType(MediaType.APPLICATION_PDF).body(pdf);
    }
}
