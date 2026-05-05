package com.clubhub.treasury.controller;

import com.clubhub.treasury.entity.Receipt;
import com.clubhub.treasury.security.Roles;
import com.clubhub.treasury.service.ReceiptService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/treasury/{clubId}/receipts")
@PreAuthorize(Roles.AUTHENTICATED)
public class ReceiptController {

    private final ReceiptService receiptService;

    public ReceiptController(ReceiptService receiptService) {
        this.receiptService = receiptService;
    }

    @PostMapping("/generate/{paymentId}")
    public ResponseEntity<Receipt> generate(
            @PathVariable Long clubId,
            @PathVariable String paymentId,
            @RequestParam(defaultValue = "Membre") String memberName,
            @RequestParam(defaultValue = "Club") String clubName) {
        return ResponseEntity.ok(receiptService.generateReceipt(paymentId, memberName, clubName));
    }

    @GetMapping("/download/{paymentId}")
    public ResponseEntity<byte[]> download(
            @PathVariable Long clubId,
            @PathVariable String paymentId,
            @RequestParam(defaultValue = "Membre") String memberName,
            @RequestParam(defaultValue = "Club") String clubName) {
        byte[] pdf = receiptService.generatePdfBytes(paymentId, memberName, clubName);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=recu-" + paymentId + ".pdf")
                .contentType(MediaType.APPLICATION_PDF)
                .body(pdf);
    }

    @GetMapping("/payment/{paymentId}")
    public ResponseEntity<Receipt> getByPayment(
            @PathVariable Long clubId,
            @PathVariable String paymentId) {
        return receiptService.getByPayment(paymentId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
}
