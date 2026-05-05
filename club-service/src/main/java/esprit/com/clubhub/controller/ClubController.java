package esprit.com.clubhub.controller;

import esprit.com.clubhub.dto.SubGroupRecommendation;  // Garder seulement celui-ci
import esprit.com.clubhub.entity.Club;
import esprit.com.clubhub.entity.Member;
import esprit.com.clubhub.entity.SubGroup;
import esprit.com.clubhub.security.JwtUtil;
import esprit.com.clubhub.service.ClubService;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
// ❌ Supprimer l'import de Map (plus utilisé)
// import java.util.Map;

@RestController
@RequestMapping("/api/clubs")
public class ClubController {

    @Autowired
    private ClubService clubService;

    @Autowired
    private JwtUtil jwtUtil;

    /**
     * Extrait le userId du JWT — cookie "jwt" en priorite, sinon header
     * "Authorization: Bearer <token>". Retourne null si aucun token valide.
     */
    private String getUserIdFromRequest(HttpServletRequest request) {
        // 1) cookie jwt (cas standard ClubHub)
        if (request.getCookies() != null) {
            String fromCookie = Arrays.stream(request.getCookies())
                    .filter(c -> "jwt".equals(c.getName()))
                    .map(Cookie::getValue)
                    .filter(t -> t != null && !t.isEmpty())
                    .map(t -> {
                        try { return jwtUtil.extractUserId(t); }
                        catch (Exception e) { return null; }
                    })
                    .filter(id -> id != null)
                    .findFirst()
                    .orElse(null);
            if (fromCookie != null) return fromCookie;
        }
        // 2) header Authorization: Bearer <token>
        String auth = request.getHeader("Authorization");
        if (auth != null && auth.startsWith("Bearer ")) {
            String token = auth.substring(7);
            try { return jwtUtil.extractUserId(token); }
            catch (Exception ignored) { }
        }
        return null;
    }

    // ========== CRUD DE BASE ==========

    @GetMapping
    public List<Club> getAllClubs() {
        return clubService.getAllClubs();
    }

    @GetMapping("/{id}")
    public ResponseEntity<Club> getClubById(@PathVariable String id) {
        return clubService.getClubById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<Club> createClub(@RequestBody Club club, HttpServletRequest request) {
        // Extrait le userId du JWT (cookie ou header) et l'utilise comme
        // createdBy si le client n'a pas fourni explicitement la valeur. Ceci
        // corrige le bug "createdBy: null" sur les clubs nouvellement crees.
        String userId = getUserIdFromRequest(request);
        if (userId != null && (club.getCreatedBy() == null || club.getCreatedBy().isBlank())) {
            club.setCreatedBy(userId);
        }
        Club createdClub = clubService.createClub(club);
        return new ResponseEntity<>(createdClub, HttpStatus.CREATED);
    }

    @PutMapping("/{id}")
    public ResponseEntity<Club> updateClub(@PathVariable String id, @RequestBody Club club) {
        try {
            Club updatedClub = clubService.updateClub(id, club);
            return ResponseEntity.ok(updatedClub);
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteClub(@PathVariable String id) {
        clubService.deleteClub(id);
        return ResponseEntity.noContent().build();
    }

    // ========== GESTION DES MEMBRES ==========

    @PostMapping("/{clubId}/members")
    public ResponseEntity<Club> addMemberRequest(@PathVariable String clubId, @RequestBody Member member) {
        try {
            Club updated = clubService.addMemberRequest(clubId, member);
            return ResponseEntity.ok(updated);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @PutMapping("/{clubId}/members/{userId}/approve")
    public ResponseEntity<Club> approveMember(@PathVariable String clubId, @PathVariable String userId) {
        try {
            Club updated = clubService.approveMember(clubId, userId);
            return ResponseEntity.ok(updated);
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @DeleteMapping("/{clubId}/members/{userId}")
    public ResponseEntity<Club> rejectMember(@PathVariable String clubId, @PathVariable String userId) {
        try {
            Club updated = clubService.rejectMember(clubId, userId);
            return ResponseEntity.ok(updated);
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @PutMapping("/{clubId}/members/{userId}/role")
    public ResponseEntity<Club> changeMemberRole(@PathVariable String clubId,
                                                 @PathVariable String userId,
                                                 @RequestParam String role) {
        try {
            Club updated = clubService.changeMemberRole(clubId, userId, role);
            return ResponseEntity.ok(updated);
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    // ========== GESTION DES SOUS-GROUPES ==========

    @PostMapping("/{clubId}/subgroups")
    public ResponseEntity<Club> addSubGroup(@PathVariable String clubId, @RequestBody SubGroup subGroup) {
        try {
            Club updated = clubService.addSubGroup(clubId, subGroup);
            return ResponseEntity.ok(updated);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @DeleteMapping("/{clubId}/subgroups/{subGroupId}")
    public ResponseEntity<Club> removeSubGroup(@PathVariable String clubId, @PathVariable String subGroupId) {
        try {
            Club updated = clubService.removeSubGroup(clubId, subGroupId);
            return ResponseEntity.ok(updated);
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @PutMapping("/{clubId}/members/{userId}/subgroup/{subGroupId}")
    public ResponseEntity<Club> assignToSubGroup(@PathVariable String clubId,
                                                 @PathVariable String userId,
                                                 @PathVariable String subGroupId,
                                                 @RequestBody(required = false) Map<String, String> requestBody) {
        try {
            // ✅ Récupérer le subGroupRole depuis le body (par défaut: MEMBRE)
            String subGroupRole = (requestBody != null && requestBody.containsKey("subGroupRole")) 
                ? requestBody.get("subGroupRole") 
                : "MEMBRE";
            
            System.out.println("=== ASSIGN TO SUBGROUP ===");
            System.out.println("ClubId: " + clubId);
            System.out.println("UserId: " + userId);
            System.out.println("SubGroupId: " + subGroupId);
            System.out.println("SubGroupRole: " + subGroupRole);
            
            Club updated = clubService.assignToSubGroup(clubId, userId, subGroupId, subGroupRole);
            return ResponseEntity.ok(updated);
        } catch (RuntimeException e) {
            System.err.println("Erreur: " + e.getMessage());
            return ResponseEntity.notFound().build();
        }
    }

    @DeleteMapping("/{clubId}/subgroups/{subGroupId}/members/{userId}")
    public ResponseEntity<Club> removeFromSubGroup(@PathVariable String clubId,
                                                   @PathVariable String subGroupId,
                                                   @PathVariable String userId) {
        try {
            Club updated = clubService.removeFromSubGroup(clubId, subGroupId, userId);
            return ResponseEntity.ok(updated);
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    // ========== SERVICES MÉTIER AVANCÉS ==========


    @GetMapping("/{clubId}/recommend-role/{userId}")
    public ResponseEntity<SubGroupRecommendation> recommendRole(@PathVariable String clubId,
                                                                @PathVariable String userId) {
        SubGroupRecommendation recommendation = clubService.recommendRole(clubId, userId);
        return ResponseEntity.ok(recommendation);
    }
    @PutMapping("/{clubId}/subgroups/{subGroupId}")
    public ResponseEntity<Club> updateSubGroup(@PathVariable String clubId,
                                               @PathVariable String subGroupId,
                                               @RequestBody SubGroup subGroup) {
        try {
            Club updated = clubService.updateSubGroup(clubId, subGroupId, subGroup);
            return ResponseEntity.ok(updated);
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }
    @PutMapping("/{clubId}/members/{userId}")
    public ResponseEntity<Club> updateMember(@PathVariable String clubId,
                                             @PathVariable String userId,
                                             @RequestBody Map<String, String> memberData) {
        try {
            System.out.println("=== UPDATE MEMBER ===");
            System.out.println("ClubId: " + clubId);
            System.out.println("UserId: " + userId);
            System.out.println("Data: " + memberData);

            Club club = clubService.getClubById(clubId)
                    .orElseThrow(() -> new RuntimeException("Club non trouvé"));

            boolean updated = false;
            for (Member member : club.getMembers()) {
                if (member.getUserId().equals(userId)) {
                    if (memberData.containsKey("name")) {
                        member.setName(memberData.get("name"));
                        updated = true;
                    }
                    if (memberData.containsKey("email")) {
                        member.setEmail(memberData.get("email"));
                        updated = true;
                    }
                    if (memberData.containsKey("role")) {
                        member.setRole(memberData.get("role"));
                        updated = true;
                    }
                    break;
                }
            }

            if (updated) {
                Club saved = clubService.updateClub(clubId, club);
                System.out.println("✅ Membre mis à jour");
                return ResponseEntity.ok(saved);
            } else {
                return ResponseEntity.notFound().build();
            }
        } catch (RuntimeException e) {
            System.err.println("Erreur: " + e.getMessage());
            return ResponseEntity.badRequest().build();
        }
    }
    
    // ✅ NOUVEAU: Endpoint pour vérifier si un utilisateur est responsable d'un comité
    @GetMapping("/{clubId}/is-responsable/{userId}")
    public ResponseEntity<Map<String, Object>> isResponsable(@PathVariable String clubId,
                                                              @PathVariable String userId) {
        try {
            Club club = clubService.getClubById(clubId)
                    .orElseThrow(() -> new RuntimeException("Club non trouvé"));

            for (SubGroup subGroup : club.getSubGroups()) {
                if (userId.equals(subGroup.getResponsableId())) {
                    Map<String, Object> response = new java.util.HashMap<>();
                    response.put("isResponsable", true);
                    response.put("subGroupId", subGroup.getId());
                    response.put("subGroupName", subGroup.getName());
                    return ResponseEntity.ok(response);
                }
            }

            Map<String, Object> response = new java.util.HashMap<>();
            response.put("isResponsable", false);
            return ResponseEntity.ok(response);
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    // ✅ NOUVEAU: Endpoint pour récupérer tous les membres d'un comité par nom
    @GetMapping("/{clubId}/committee/{committeeName}/members")
    public ResponseEntity<Map<String, Object>> getCommitteeMembers(@PathVariable String clubId,
                                                                    @PathVariable String committeeName) {
        try {
            Club club = clubService.getClubById(clubId)
                    .orElseThrow(() -> new RuntimeException("Club non trouvé"));

            SubGroup subGroup = club.getSubGroups().stream()
                    .filter(sg -> committeeName.equalsIgnoreCase(sg.getName()))
                    .findFirst()
                    .orElse(null);

            if (subGroup == null) {
                Map<String, Object> response = new java.util.HashMap<>();
                response.put("error", "Comité '" + committeeName + "' non trouvé");
                return ResponseEntity.status(404).body(response);
            }

            // Build member list with name + email from club.members
            java.util.List<Map<String, Object>> memberList = new java.util.ArrayList<>();
            Map<String, Object> responsableInfo = null;

            for (String memberId : subGroup.getMemberIds()) {
                Member m = club.getMembers().stream()
                        .filter(cm -> cm.getUserId().equals(memberId))
                        .findFirst()
                        .orElse(null);

                Map<String, Object> memberInfo = new java.util.HashMap<>();
                memberInfo.put("userId", memberId);
                memberInfo.put("name", m != null ? m.getName() : memberId);
                memberInfo.put("email", m != null ? m.getEmail() : "");
                String committeeRole = subGroup.getMemberRoles() != null
                        ? subGroup.getMemberRoles().getOrDefault(memberId, "MEMBRE_COMITE")
                        : "MEMBRE_COMITE";
                memberInfo.put("committeeRole", committeeRole);

                if (memberId.equals(subGroup.getResponsableId())) {
                    responsableInfo = memberInfo;
                } else {
                    memberList.add(memberInfo);
                }
            }

            Map<String, Object> response = new java.util.HashMap<>();
            response.put("committeeName", subGroup.getName());
            response.put("subGroupId", subGroup.getId());
            response.put("responsable", responsableInfo);
            response.put("members", memberList);
            response.put("totalCount", subGroup.getMemberIds().size());
            return ResponseEntity.ok(response);

        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }
}