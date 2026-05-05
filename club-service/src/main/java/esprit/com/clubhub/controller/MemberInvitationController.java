package esprit.com.clubhub.controller;

import esprit.com.clubhub.dto.InviteMemberRequest;
import esprit.com.clubhub.dto.SetupPasswordRequest;
import esprit.com.clubhub.entity.MemberInvitation;
import esprit.com.clubhub.service.MemberInvitationService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/invitations")
@CrossOrigin(origins = "*")
public class MemberInvitationController {

    @Autowired
    private MemberInvitationService invitationService;

    @PostMapping("/invite")
    public ResponseEntity<?> inviteMember(
            @RequestBody InviteMemberRequest request,
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        try {
            MemberInvitation invitation = invitationService.inviteMember(request, "system");
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("message", "Invitation envoyée avec succès");
            response.put("invitation", invitation);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    @GetMapping("/validate/{token}")
    public ResponseEntity<?> validateToken(@PathVariable String token) {
        try {
            MemberInvitation inv = invitationService.validateToken(token);
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "valid", true,
                    "invitation", Map.of(
                            "firstName", inv.getFirstName(),
                            "lastName", inv.getLastName(),
                            "email", inv.getEmail(),
                            "clubName", inv.getClubName(),
                            "role", inv.getRole()
                    )
            ));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("success", false, "valid", false, "message", e.getMessage()));
        }
    }

    @PostMapping("/setup-password")
    public ResponseEntity<?> setupPassword(@RequestBody SetupPasswordRequest request) {
        try {
            Map<String, Object> user = invitationService.setupPassword(request);
            return ResponseEntity.ok(Map.of("success", true, "message", "Compte créé avec succès", "user", user));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    @GetMapping("/club/{clubId}")
    public ResponseEntity<?> getClubInvitations(@PathVariable String clubId) {
        try {
            List<MemberInvitation> invitations = invitationService.getClubInvitations(clubId);
            return ResponseEntity.ok(Map.of("success", true, "invitations", invitations));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    @GetMapping("/club/{clubId}/pending")
    public ResponseEntity<?> getPendingInvitations(@PathVariable String clubId) {
        try {
            List<MemberInvitation> invitations = invitationService.getPendingInvitations(clubId);
            return ResponseEntity.ok(Map.of("success", true, "invitations", invitations));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    @PostMapping("/{id}/resend")
    public ResponseEntity<?> resendInvitation(@PathVariable String id) {
        try {
            invitationService.resendInvitation(id);
            return ResponseEntity.ok(Map.of("success", true, "message", "Invitation renvoyée avec succès"));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteInvitation(@PathVariable String id) {
        try {
            invitationService.deleteInvitation(id);
            return ResponseEntity.ok(Map.of("success", true, "message", "Invitation supprimée avec succès"));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("success", false, "message", e.getMessage()));
        }
    }
}
