package tn.esprit.clubhub.Controller;

import tn.esprit.clubhub.Entity.BorrowedItem;
import tn.esprit.clubhub.Entity.Lender;
import tn.esprit.clubhub.Repository.BorrowedItemRepository;
import tn.esprit.clubhub.Repository.LenderRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/lenders")
public class LenderController {

    @Autowired
    private BorrowedItemRepository borrowedItemRepository;  // FIX: was missing @Autowired

    @Autowired
    private LenderRepository lenderRepository;

    // ── GET all (used by lenders page & BorrowingService.getLenders()) ────
    // FIX: this endpoint was completely missing — Angular called GET /api/lenders
    // but only GET /api/lenders/lenders/all existed (wrong path + no @Autowired)
    @GetMapping
    public ResponseEntity<List<Lender>> getAllLenders() {
        try {
            List<Lender> all = lenderRepository.findAll();

            // Also surface any lender that exists only in borrowed_items but not yet
            // in the lenders collection (created via devis validation flow).
            List<BorrowedItem> items = borrowedItemRepository.findAll();
            Set<String> knownNames = new HashSet<>();
            all.forEach(l -> knownNames.add(l.getName()));

            Map<String, Lender> extra = new LinkedHashMap<>();
            for (BorrowedItem item : items) {
                String name = item.getLenderName();
                if (name == null || name.isBlank() || knownNames.contains(name)) continue;
                extra.computeIfAbsent(name, n -> {
                    Lender lender = new Lender();
                    lender.setName(n);
                    lender.setPhone(item.getLenderPhone());
                    lender.setEmail(item.getLenderEmail());
                    lender.setType(item.getLenderType());
                    lender.setContactPerson(item.getLenderContactPerson());
                    lender.setAddress(item.getLenderAddress());
                    lender.setReliability("medium");
                    lender.setTotalBorrows(0);
                    lender.setOnTimeReturns(0);
                    lender.setActive(true);
                    return lender;
                });
            }
            all.addAll(extra.values());

            // Compute live stats for each lender from borrowed_items
            all.forEach(l -> {
                if (l.getId() != null) return; // already persisted — stats managed elsewhere
                List<BorrowedItem> lenderItems =
                        borrowedItemRepository.findByLenderNameContainingIgnoreCase(l.getName());
                l.setTotalBorrows(lenderItems.size());
                long onTime = lenderItems.stream()
                        .filter(i -> "returned".equals(i.getStatus())
                                && i.getActualReturnDate() != null
                                && i.getExpectedReturnDate() != null
                                && i.getActualReturnDate().isBefore(i.getExpectedReturnDate()))
                        .count();
                l.setOnTimeReturns((int) onTime);
            });

            return ResponseEntity.ok(all);
        } catch (Exception e) {
            return ResponseEntity.status(500).build();
        }
    }

    // ── GET lender details + borrowing history ────────────────────────────
    // FIX: was duplicated in BorrowedItemController; canonical version lives here
    @GetMapping("/{name}/details")
    public ResponseEntity<?> getLenderDetails(@PathVariable String name) {
        try {
            String decoded = java.net.URLDecoder.decode(name, "UTF-8");
            List<BorrowedItem> items =
                    borrowedItemRepository.findByLenderNameContainingIgnoreCase(decoded);

            if (items.isEmpty()) {
                // Check the lenders collection as a fallback
                Optional<Lender> opt = lenderRepository.findByName(decoded);
                if (opt.isEmpty()) {
                    return ResponseEntity.status(404).body(Map.of("error", "Lender not found"));
                }
                Lender l = opt.get();
                return ResponseEntity.ok(Map.of("lender", lenderToMap(l, 0, 0), "items", List.of()));
            }

            BorrowedItem first = items.get(0);
            long total = items.size();
            long onTime = items.stream()
                    .filter(i -> "returned".equals(i.getStatus())
                            && i.getActualReturnDate() != null
                            && i.getExpectedReturnDate() != null
                            && i.getActualReturnDate().isBefore(i.getExpectedReturnDate()))
                    .count();

            // Try to find a persisted lender record for reliability badge
            Optional<Lender> persisted = lenderRepository.findByName(decoded);
            String reliability = persisted.map(Lender::getReliability).orElseGet(() -> {
                if (total == 0) return "medium";
                double rate = onTime * 1.0 / total;
                return rate >= 0.9 ? "high" : rate >= 0.6 ? "medium" : "low";
            });

            Map<String, Object> lenderMap = new LinkedHashMap<>();
            lenderMap.put("name", first.getLenderName());
            lenderMap.put("type", first.getLenderType());
            lenderMap.put("contactPerson", first.getLenderContactPerson());
            lenderMap.put("phone", first.getLenderPhone());
            lenderMap.put("email", first.getLenderEmail());
            lenderMap.put("address", first.getLenderAddress());
            lenderMap.put("totalBorrows", total);
            lenderMap.put("onTimeReturns", onTime);
            lenderMap.put("reliability", reliability);

            return ResponseEntity.ok(Map.of("lender", lenderMap, "items", items));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", e.getMessage()));
        }
    }

    // ── Search (autocomplete) ─────────────────────────────────────────────
    @GetMapping("/search")
    public ResponseEntity<List<Lender>> searchLenders(@RequestParam String q) {
        return ResponseEntity.ok(lenderRepository.findByNameContainingIgnoreCase(q));
    }

    // ── Active lenders for dropdown ───────────────────────────────────────
    @GetMapping("/active")
    public ResponseEntity<List<Lender>> getActiveLenders() {
        return ResponseEntity.ok(lenderRepository.findByIsActiveTrueOrderByTotalBorrowsDesc());
    }

    // ── CREATE ────────────────────────────────────────────────────────────
    @PostMapping
    public ResponseEntity<Lender> createLender(@RequestBody Lender lender) {
        lender.setActive(true);
        if (lender.getTotalBorrows() == null) lender.setTotalBorrows(0);
        if (lender.getOnTimeReturns() == null) lender.setOnTimeReturns(0);
        if (lender.getReliability() == null) lender.setReliability("medium");
        return ResponseEntity.ok(lenderRepository.save(lender));
    }

    // ── UPDATE ────────────────────────────────────────────────────────────
    @PutMapping("/{id}")
    public ResponseEntity<Lender> updateLender(@PathVariable String id, @RequestBody Lender lender) {
        lender.setId(id);
        return ResponseEntity.ok(lenderRepository.save(lender));
    }

    // ── HARD DELETE ───────────────────────────────────────────────────────
    // Removes the lender entirely. Borrowed-items keep the lender's name as
    // a free-text snapshot — they do not break.
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteLender(@PathVariable String id) {
        if (!lenderRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        lenderRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    // ── Helper ────────────────────────────────────────────────────────────
    private Map<String, Object> lenderToMap(Lender l, long total, long onTime) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("name", l.getName());
        m.put("type", l.getType());
        m.put("contactPerson", l.getContactPerson());
        m.put("phone", l.getPhone());
        m.put("email", l.getEmail());
        m.put("address", l.getAddress());
        m.put("totalBorrows", total);
        m.put("onTimeReturns", onTime);
        m.put("reliability", l.getReliability() != null ? l.getReliability() : "medium");
        return m;
    }
}
