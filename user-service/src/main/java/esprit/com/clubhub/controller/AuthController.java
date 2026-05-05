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

    // ✅ ENDPOINT TEMPORAIRE pour réinitialiser le mot de passe
    @PostMapping("/reset-password")
    public ResponseEntity<?> resetPassword(@RequestBody Map<String, String> body) {
        try {
            String email = body.get("email");
            String newPassword = body.get("newPassword");
            
            if (email == null || newPassword == null) {
                return ResponseEntity.badRequest().body("Email et nouveau mot de passe requis");
            }
            
            authService.resetPassword(email, newPassword);
            return ResponseEntity.ok("Mot de passe réinitialisé avec succès");
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }
}