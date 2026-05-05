package tn.esprit.clubhub.Controller;

import tn.esprit.clubhub.Entity.Devis;
import tn.esprit.clubhub.Entity.BorrowedItem;
import tn.esprit.clubhub.Entity.Lender;
import tn.esprit.clubhub.Repository.DevisRepository;
import tn.esprit.clubhub.Repository.BorrowedItemRepository;
import tn.esprit.clubhub.Repository.LenderRepository;
import tn.esprit.clubhub.Service.TreasuryIntegrationService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/devis")
public class DevisController {

    @Autowired private DevisRepository devisRepository;
    @Autowired private BorrowedItemRepository borrowedItemRepository;
    @Autowired private LenderRepository lenderRepository;
    @Autowired private TreasuryIntegrationService treasuryIntegrationService;

    // ── GET all (for aggregating budgets per event on the frontend) ───────
    @GetMapping("/all")
    public ResponseEntity<List<Devis>> getAllDevis() {
        return ResponseEntity.ok(devisRepository.findAll());
    }

    // ── GET by item ───────────────────────────────────────────────────────
    @GetMapping("/item/{itemId}")
    public ResponseEntity<List<Devis>> getByItem(@PathVariable String itemId) {
        return ResponseEntity.ok(devisRepository.findByBorrowedItemId(itemId));
    }

    // ── POST create ───────────────────────────────────────────────────────
    @PostMapping
    public ResponseEntity<?> createDevis(@RequestBody Devis devis) {
        try {
            if (devis.getStatus() == null) devis.setStatus("pending");
            devis.setCreatedAt(LocalDateTime.now());
            return ResponseEntity.ok(devisRepository.save(devis));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // ── PATCH validate ────────────────────────────────────────────────────
    /**
     * Treasurer validates a quote:
     *  1. Mark this devis as validated, all others as rejected
     *  2. Update the BorrowedItem's lender fields from this devis
     *  3. Auto-create or upsert the Lender record
     */
    @PatchMapping("/{id}/validate")
    public ResponseEntity<?> validateDevis(@PathVariable String id,
                                           @RequestBody(required = false) Map<String, String> body,
                                           HttpServletRequest request) {
        return devisRepository.findById(id).map(dv -> {
            dv.setStatus("validated");
            dv.setValidatedAt(LocalDateTime.now());
            if (body != null) dv.setValidationNote(body.get("note"));
            devisRepository.save(dv);

            // Reject all sibling devis for the same item
            List<Devis> siblings = devisRepository.findByBorrowedItemId(dv.getBorrowedItemId());
            siblings.forEach(s -> {
                if (!s.getId().equals(id) && !"rejected".equals(s.getStatus())) {
                    s.setStatus("rejected");
                    devisRepository.save(s);
                }
            });

            // Update item — set lender from validated devis
            borrowedItemRepository.findById(dv.getBorrowedItemId()).ifPresent(item -> {
                item.setLenderName(dv.getSupplierName());
                if (dv.getContactPhone() != null) item.setLenderPhone(dv.getContactPhone());
                if (dv.getContactEmail() != null) item.setLenderEmail(dv.getContactEmail());
                if (dv.getContactName() != null) item.setLenderContactPerson(dv.getContactName());
                item.setValidatedDevisId(id);
                if (body != null) item.setValidationNote(body.get("note"));
                item.setUpdatedAt(LocalDateTime.now());
                borrowedItemRepository.save(item);

                // Auto-create Lender record if not yet in DB
                upsertLender(item);

                // Push expense to Treasury if 3 devis exist
                String jwtCookie = request.getHeader("Cookie");
                treasuryIntegrationService.createExpenseInTreasury(item, siblings, jwtCookie);
            });

            return ResponseEntity.ok(dv);
        }).orElse(ResponseEntity.notFound().build());
    }

    // ── PATCH reject ──────────────────────────────────────────────────────
    @PatchMapping("/{id}/reject")
    public ResponseEntity<?> rejectDevis(@PathVariable String id) {
        return devisRepository.findById(id).map(dv -> {
            dv.setStatus("rejected");
            return ResponseEntity.ok(devisRepository.save(dv));
        }).orElse(ResponseEntity.notFound().build());
    }

    // ── DELETE ────────────────────────────────────────────────────────────
    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteDevis(@PathVariable String id) {
        devisRepository.deleteById(id);
        return ResponseEntity.ok(Map.of("message", "Deleted"));
    }

    // ── Helper ────────────────────────────────────────────────────────────
    private void upsertLender(BorrowedItem item) {
        if (item.getLenderName() == null || item.getLenderName().isBlank()) return;
        Optional<Lender> existing = lenderRepository.findByName(item.getLenderName());
        if (existing.isPresent()) {
            // Update contact info if it changed
            Lender l = existing.get();
            if (item.getLenderPhone() != null) l.setPhone(item.getLenderPhone());
            if (item.getLenderEmail() != null) l.setEmail(item.getLenderEmail());
            if (item.getLenderContactPerson() != null) l.setContactPerson(item.getLenderContactPerson());
            lenderRepository.save(l);
        } else {
            Lender l = new Lender();
            l.setName(item.getLenderName());
            l.setPhone(item.getLenderPhone());
            l.setEmail(item.getLenderEmail());
            l.setType(item.getLenderType() != null ? item.getLenderType() : "individual");
            l.setContactPerson(item.getLenderContactPerson());
            l.setAddress(item.getLenderAddress());
            l.setReliability("medium");
            l.setTotalBorrows(0);
            l.setOnTimeReturns(0);
            l.setActive(true);
            lenderRepository.save(l);
        }
    }
}
