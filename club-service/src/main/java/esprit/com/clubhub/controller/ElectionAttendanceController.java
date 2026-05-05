package esprit.com.clubhub.controller;

import esprit.com.clubhub.entity.ElectionAttendance;
import esprit.com.clubhub.service.ElectionAttendanceService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/elections/{electionId}/attendance")
@CrossOrigin(origins = "*")
public class ElectionAttendanceController {

    @Autowired
    private ElectionAttendanceService attendanceService;

    @PostMapping("/scan")
    public ResponseEntity<?> scanQRCode(
            @PathVariable String electionId,
            @RequestBody Map<String, String> request) {
        try {
            String qrData = request.get("qrData");
            String scannedBy = request.get("scannedBy");

            if (qrData == null || qrData.isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("error", "QR code data is required"));
            }
            if (scannedBy == null || scannedBy.isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("error", "Scanned by user ID is required"));
            }

            ElectionAttendance attendance = attendanceService.validateQRCode(electionId, qrData, scannedBy);

            return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "Présence enregistrée avec succès",
                "attendance", attendance
            ));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "error", e.getMessage()));
        }
    }

    @GetMapping("/list")
    public ResponseEntity<List<ElectionAttendance>> getAttendanceList(@PathVariable String electionId) {
        return ResponseEntity.ok(attendanceService.getAttendanceList(electionId));
    }

    @GetMapping("/stats")
    public ResponseEntity<Map<String, Object>> getAttendanceStats(@PathVariable String electionId) {
        return ResponseEntity.ok(attendanceService.getAttendanceStats(electionId));
    }

    @GetMapping("/can-scan")
    public ResponseEntity<Map<String, Boolean>> canScanQRCodes(
            @PathVariable String electionId,
            @RequestParam String userId,
            @RequestParam String clubId) {
        return ResponseEntity.ok(Map.of("canScan", attendanceService.canScanQRCodes(clubId, userId)));
    }

    @GetMapping("/validate-token")
    public ResponseEntity<Map<String, Object>> validateToken(
            @PathVariable String electionId,
            @RequestParam String token) {
        boolean isValid = attendanceService.isTokenValid(token);

        if (isValid) {
            return attendanceService.getByToken(token)
                    .map(attendance -> {
                        Map<String, Object> response = new HashMap<>();
                        response.put("valid", true);
                        response.put("userId", attendance.getUserId());
                        response.put("name", attendance.getName());
                        response.put("email", attendance.getEmail());
                        return ResponseEntity.ok(response);
                    })
                    .orElseGet(() -> {
                        Map<String, Object> response = new HashMap<>();
                        response.put("valid", false);
                        return ResponseEntity.ok(response);
                    });
        } else {
            Map<String, Object> response = new HashMap<>();
            response.put("valid", false);
            response.put("message", "Token invalide ou expiré");
            return ResponseEntity.ok(response);
        }
    }
}
