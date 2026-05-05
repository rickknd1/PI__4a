package esprit.com.clubhub.controller;

import esprit.com.clubhub.dto.AuthResponse;
import esprit.com.clubhub.dto.RegisterRequest;
import esprit.com.clubhub.entity.User;
import esprit.com.clubhub.repository.CustomRoleRepo;
import esprit.com.clubhub.security.JwtUtil;
import esprit.com.clubhub.service.AuthService;
import esprit.com.clubhub.service.UserService;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Arrays;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserService userService;
    private final AuthService authService;
    private final JwtUtil jwtUtil;
    private final CustomRoleRepo customRoleRepo;

    public UserController(UserService userService, AuthService authService, JwtUtil jwtUtil, CustomRoleRepo customRoleRepo) {
        this.userService = userService;
        this.authService = authService;
        this.jwtUtil = jwtUtil;
        this.customRoleRepo = customRoleRepo;
    }

    // Helper : extrait le userId depuis le cookie JWT
    private String getUserIdFromRequest(HttpServletRequest request) {
        if (request.getCookies() == null) return null;
        return Arrays.stream(request.getCookies())
                .filter(c -> "jwt".equals(c.getName()))
                .map(Cookie::getValue)
                .map(jwtUtil::extractUserId)
                .findFirst()
                .orElse(null);
    }

    // Helper : extrait le role depuis le cookie JWT
    private String getRoleFromRequest(HttpServletRequest request) {
        if (request.getCookies() == null) return null;
        return Arrays.stream(request.getCookies())
                .filter(c -> "jwt".equals(c.getName()))
                .map(Cookie::getValue)
                .map(jwtUtil::extractRole)
                .findFirst()
                .orElse(null);
    }

    // GET /api/users/me
    @GetMapping("/me")
    public ResponseEntity<AuthResponse> getMe(HttpServletRequest request) {
        String userId = getUserIdFromRequest(request);
        if (userId == null) return ResponseEntity.status(401).build();

        User user = userService.getUserById(userId);

        // ✅ CORRIGÉ : utiliser getClubId() au lieu de getClub()
        AuthResponse response = new AuthResponse(
                null,
                user.getId(),
                user.getEmail(),
                user.getFirstName(),
                user.getLastName(),
                user.getPhoneNumber(),
                user.getRole(),  // ✅ role est maintenant un String
                user.getClubId(),
                user.getProfilePhoto()
        );
        return ResponseEntity.ok(response);
    }

    // PUT /api/users/{id}/photo
    @PutMapping("/{id}/photo")
    public ResponseEntity<User> updatePhoto(
            @PathVariable String id,
            @RequestBody Map<String, String> body) {
        return ResponseEntity.ok(
                userService.updateProfilePhoto(id, body.get("photoUrl"))
        );
    }

    // GET /api/users
    @GetMapping
    public List<User> getAll() {
        return userService.getAllUsers();
    }

    /**
     * POST /api/users
     * Création d'un utilisateur par un administrateur (PRESIDENT, etc.).
     * Contrairement à /api/auth/register, on ne pose PAS de cookie JWT
     * pour ne pas écraser la session de l'admin connecté.
     *
     * Accepte un payload souple (Map) car le frontend envoie aussi des champs
     * non gérés par RegisterRequest (active, profilePhoto vide, etc.).
     */
    @PostMapping
    public ResponseEntity<?> createByAdmin(@RequestBody Map<String, Object> body) {
        try {
            RegisterRequest req = new RegisterRequest();
            req.setFirstName(asString(body.get("firstName")));
            req.setLastName(asString(body.get("lastName")));
            req.setEmail(asString(body.get("email")));
            req.setPassword(asString(body.get("password")));
            req.setPhoneNumber(asString(body.get("phoneNumber")));
            req.setRole(asString(body.get("role")));
            req.setCustomRoleId(asString(body.get("customRoleId")));
            req.setClubId(asString(body.get("clubId")));
            req.setProfilePhoto(asString(body.get("profilePhoto")));

            AuthResponse auth = authService.register(req);
            // ⚠️ On efface le token : aucune raison de l'exposer + le frontend
            //    n'en a pas besoin (il extrait juste l'userId pour ajouter le
            //    membre au club ensuite).
            auth.setToken(null);
            return ResponseEntity.ok(auth);
        } catch (RuntimeException e) {
            // Le frontend lit err.error.error pour le cas "Email déjà utilisé"
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    private String asString(Object value) {
        return value == null ? null : value.toString();
    }

    // GET /api/users/{id}
    @GetMapping("/{id}")
    public ResponseEntity<User> getById(@PathVariable String id) {
        return ResponseEntity.ok(userService.getUserById(id));
    }

    // PUT /api/users/{id}
    @PutMapping("/{id}")
    public ResponseEntity<User> update(@PathVariable String id,
                                       @RequestBody User updated) {
        return ResponseEntity.ok(userService.updateUser(id, updated));
    }

    // DELETE /api/users/{id}
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        userService.deleteUser(id);
        return ResponseEntity.noContent().build();
    }

    // DELETE /api/users/by-post/{postName}
    @DeleteMapping("/by-post/{postName}")
    public ResponseEntity<Void> clearPostByName(
            @PathVariable String postName,
            HttpServletRequest request) {
        String role = getRoleFromRequest(request);
        if (role == null) return ResponseEntity.status(401).build();
        if ("MEMBRE_SIMPLE".equals(role)) return ResponseEntity.status(403).build();
        userService.clearPostByName(postName);
        return ResponseEntity.noContent().build();
    }

    // Endpoint pour mettre à jour le rôle d'un utilisateur (appelé par Club Service)
    @PutMapping("/{userId}/role")
    public ResponseEntity<User> updateUserRole(
            @PathVariable String userId,
            @RequestBody Map<String, String> roleUpdate) {

        try {
            User user = userService.getUserById(userId);
            String newRole = roleUpdate.get("role");
            System.out.println("🔄 Mise à jour du rôle: " + user.getRole() + " → " + newRole);

            user.setRole(newRole);

            // Résoudre le customRoleId si le nouveau rôle correspond à un rôle personnalisé
            if (user.getClubId() != null) {
                customRoleRepo.findByClubIdAndRoleName(user.getClubId(), newRole)
                        .ifPresentOrElse(
                                customRole -> {
                                    user.setCustomRoleId(customRole.getId());
                                    System.out.println("✅ customRoleId résolu: " + customRole.getId() + " (" + customRole.getRoleName() + ")");
                                },
                                () -> {
                                    // Rôle système ou COMMITTEE_MEMBER → effacer le customRoleId
                                    user.setCustomRoleId(null);
                                    System.out.println("ℹ️ Rôle système/standard, customRoleId effacé");
                                }
                        );
            }

            User savedUser = userService.updateUser(userId, user);
            System.out.println("✅ Rôle mis à jour dans User service");
            return ResponseEntity.ok(savedUser);
        } catch (Exception e) {
            System.err.println("❌ Erreur: " + e.getMessage());
            return ResponseEntity.badRequest().build();
        }
    }

    // GET /api/users/members
    @GetMapping("/members")
    public ResponseEntity<List<User>> getSimpleMembers() {
        return ResponseEntity.ok(userService.getSimpleMembers());
    }

    // GET /api/users/bureau
    @GetMapping("/bureau")
    public ResponseEntity<List<User>> getBureauMembers() {
        return ResponseEntity.ok(userService.getBureauMembers());
    }

    // PUT /api/users/{id}/post
    @PutMapping("/{id}/post")
    public ResponseEntity<User> assignPost(
            @PathVariable String id,
            @RequestBody Map<String, String> body,
            HttpServletRequest request) {
        String role = getRoleFromRequest(request);
        if (role == null) return ResponseEntity.status(401).build();
        if ("MEMBRE_SIMPLE".equals(role)) return ResponseEntity.status(403).build();
        return ResponseEntity.ok(userService.assignPost(id, body.get("post")));
    }

    // ===== NOUVEAUX ENDPOINTS pour compatibilité avec Club Service =====

    // GET /api/users/club/{clubId}
    @GetMapping("/club/{clubId}")
    public ResponseEntity<List<User>> getUsersByClub(@PathVariable String clubId) {
        return ResponseEntity.ok(userService.getUsersByClub(clubId));
    }

    // PUT /api/users/{id}/club - Associer un club à un utilisateur
    @PutMapping("/{id}/club")
    public ResponseEntity<User> updateUserClub(
            @PathVariable String id,
            @RequestBody Map<String, String> body) {
        User user = userService.getUserById(id);
        user.setClubId(body.get("clubId"));
        return ResponseEntity.ok(userService.updateUser(id, user));
    }
}