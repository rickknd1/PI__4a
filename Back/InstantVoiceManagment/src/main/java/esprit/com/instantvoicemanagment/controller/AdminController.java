package esprit.com.instantvoicemanagment.controller;

import esprit.com.instantvoicemanagment.service.ModerationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminController {

    private final ModerationService moderationService;

    @PostMapping("/scan-history")
    public ResponseEntity<String> scanHistory() {
        moderationService.scanHistory();
        return ResponseEntity.ok("History scan started in background");
    }
}
