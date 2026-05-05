package esprit.com.clubhub.controller;

import esprit.com.clubhub.service.QRTokenService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/qr-tokens")
@CrossOrigin(origins = "*")
public class QRTokenController {

    @Autowired
    private QRTokenService qrTokenService;

    @GetMapping("/{token}")
    public ResponseEntity<?> getQRTokenInfo(@PathVariable String token) {
        return qrTokenService.getQRTokenInfo(token)
                .map(qrToken -> ResponseEntity.ok(Map.of(
                    "success", true,
                    "data", Map.of(
                        "userId", qrToken.getUserId(),
                        "name", qrToken.getName(),
                        "email", qrToken.getEmail(),
                        "role", qrToken.getRole(),
                        "photoUrl", qrToken.getPhotoUrl() != null ? qrToken.getPhotoUrl() : "",
                        "isCandidate", qrToken.isCandidate(),
                        "status", qrToken.getStatus(),
                        "electionId", qrToken.getElectionId()
                    )
                )))
                .orElse(ResponseEntity.ok(Map.of(
                    "success", false,
                    "message", "Token QR invalide ou expiré"
                )));
    }

    @PostMapping("/{token}/validate")
    public ResponseEntity<Map<String, Object>> validatePresence(
            @PathVariable String token,
            @RequestBody Map<String, String> request) {

        String validatedBy = request.get("validatedBy");
        if (validatedBy == null || validatedBy.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "validatedBy est requis"));
        }

        Map<String, Object> result = qrTokenService.validatePresence(token, validatedBy);
        return (Boolean) result.get("success") ? ResponseEntity.ok(result) : ResponseEntity.badRequest().body(result);
    }

    @PostMapping("/{token}/reject")
    public ResponseEntity<Map<String, Object>> rejectPresence(
            @PathVariable String token,
            @RequestBody Map<String, String> request) {

        String validatedBy = request.get("validatedBy");
        if (validatedBy == null || validatedBy.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "validatedBy est requis"));
        }

        Map<String, Object> result = qrTokenService.rejectPresence(token, validatedBy, request.get("reason"));
        return (Boolean) result.get("success") ? ResponseEntity.ok(result) : ResponseEntity.badRequest().body(result);
    }

    @GetMapping("/voting/{votingToken}/validate")
    public ResponseEntity<Map<String, Object>> validateVotingToken(@PathVariable String votingToken) {
        boolean isValid = qrTokenService.isVotingTokenValid(votingToken);
        return ResponseEntity.ok(Map.of("valid", isValid, "message", isValid ? "Token valide" : "Token invalide ou expiré"));
    }

    @GetMapping("/voting/{votingToken}/info")
    public ResponseEntity<Map<String, Object>> getVotingTokenInfo(@PathVariable String votingToken) {
        return qrTokenService.getVotingTokenInfo(votingToken)
                .map(qrToken -> ResponseEntity.ok(Map.of(
                    "success", true,
                    "data", Map.of(
                        "userId", qrToken.getUserId(),
                        "name", qrToken.getName(),
                        "email", qrToken.getEmail(),
                        "subGroupId", qrToken.getSubGroupId() != null ? qrToken.getSubGroupId() : "",
                        "subGroupName", qrToken.getSubGroupName() != null ? qrToken.getSubGroupName() : "",
                        "electionId", qrToken.getElectionId()
                    )
                )))
                .orElse(ResponseEntity.ok(Map.of("success", false, "message", "Token de vote invalide ou expiré")));
    }

    @GetMapping("/stats/{electionId}")
    public ResponseEntity<Map<String, Object>> getPresenceStats(@PathVariable String electionId) {
        return ResponseEntity.ok(qrTokenService.getPresenceStats(electionId));
    }
}
