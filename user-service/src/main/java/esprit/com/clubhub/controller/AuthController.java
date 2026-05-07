package esprit.com.clubhub.controller;

import esprit.com.clubhub.dto.AuthResponse;
import esprit.com.clubhub.dto.LoginRequest;
import esprit.com.clubhub.dto.RegisterRequest;
import esprit.com.clubhub.service.AuthService;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody RegisterRequest request,
                                      HttpServletResponse response) {
        try {
            AuthResponse auth = authService.register(request);
            setJwtCookie(response, auth.getToken());

            // We DELIBERATELY keep the JWT in the response body. The cookie
            // alone is not enough because the Angular dev server runs on
            // :4200 while the API gateway is on :8084 — that's a cross-origin
            // request, and SameSite=Lax cookies are NOT sent on cross-origin
            // XHR/fetch. The frontend stores the token in localStorage and
            // the JwtInterceptor sends it back as `Authorization: Bearer …`,
            // which the Backend's SessionService also understands.
            return ResponseEntity.ok(auth);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequest request,
                                   HttpServletResponse response) {
        try {
            AuthResponse auth = authService.login(request);
            setJwtCookie(response, auth.getToken());

            // See comment in #register — we keep the token in the body so
            // the SPA can use it on cross-origin XHR calls where the
            // SameSite=Lax cookie would not be transmitted.
            return ResponseEntity.ok(auth);
        } catch (RuntimeException e) {
            return ResponseEntity.status(401).body(e.getMessage());
        }
    }

    @PostMapping("/logout")
    public ResponseEntity<?> logout(HttpServletResponse response) {
        ResponseCookie cookie = ResponseCookie.from("jwt", "")
                .httpOnly(true)
                .secure(false)
                .path("/")
                .maxAge(0)
                .sameSite("Lax")
                .build();
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
        return ResponseEntity.ok("Logged out");
    }

    private void setJwtCookie(HttpServletResponse response, String token) {
        ResponseCookie cookie = ResponseCookie.from("jwt", token)
                .httpOnly(true)
                .secure(false)
                .path("/")
                .maxAge(86400)
                .sameSite("Lax")
                .build();
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
    }
    @GetMapping("/check")
    public ResponseEntity<?> checkSession() {
        return ResponseEntity.ok("Session valid");
    }

    /**
     * Retourne le user courant a partir du JWT cookie. Permet au frontend de
     * refresh son state apres modifications cote backend (ex: le president a
     * ete relie a un nouveau club, son state local est obsolete).
     */
    @GetMapping("/me")
    public ResponseEntity<?> me() {
        org.springframework.security.core.Authentication auth =
            org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || "anonymousUser".equals(auth.getPrincipal())) {
            return ResponseEntity.status(401).body(Map.of("error", "Not authenticated"));
        }
        String email = (String) auth.getPrincipal();
        try {
            return ResponseEntity.ok(authService.findUserByEmail(email));
        } catch (RuntimeException e) {
            return ResponseEntity.status(404).body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Reset password — protege par auth.
     *
     * Avant : endpoint public, n'importe qui pouvait reset n'importe quel email
     * (CVE majeure). Maintenant : seul l'utilisateur connecte peut changer son
     * propre mot de passe (verifie via JWT cookie). Pour le flow "mot de passe
     * oublie" classique avec token email, voir setup-password (qui utilise un
     * token UUID expire 7j envoye dans l'email d'invitation).
     */
    @PostMapping("/reset-password")
    public ResponseEntity<?> resetPassword(@RequestBody Map<String, String> body,
                                           jakarta.servlet.http.HttpServletRequest request) {
        try {
            // L'authentification a deja ete validee par JwtAuthFilter en amont.
            // L'email du user connecte vient du token, pas du body — un attaquant
            // ne peut donc pas reset le mot de passe d'un autre user.
            org.springframework.security.core.Authentication auth =
                org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
            if (auth == null || !auth.isAuthenticated() || "anonymousUser".equals(auth.getPrincipal())) {
                return ResponseEntity.status(401).body("Authentification requise");
            }
            String authedEmail = (String) auth.getPrincipal();

            String newPassword = body.get("newPassword");
            if (newPassword == null || newPassword.length() < 6) {
                return ResponseEntity.badRequest().body("Nouveau mot de passe requis (minimum 6 caracteres)");
            }

            authService.resetPassword(authedEmail, newPassword);
            return ResponseEntity.ok("Mot de passe reinitialise avec succes");
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }
}