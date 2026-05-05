package tn.esprit.clubhub.Security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.security.Key;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Resolves the connected user identity from the {@code jwt} cookie issued
 * by user-service at login.
 *
 * <p>The Backend monolith does not own the auth flow — it merely shares the
 * JWT secret with user-service so it can decode the same token and trust
 * the embedded {@code email} / {@code userId} / {@code role} claims.</p>
 *
 * <p>For the display name (firstName + lastName) the JWT carries no claim,
 * so we look it up via {@code GET http://user-service/api/users/{id}}.
 * The response is cached per JWT for the lifetime of the application
 * to keep RSVP / feedback / event creation paths fast.</p>
 */
@Slf4j
@Service
public class SessionService {

    /**
     * Default matches {@code application.properties} and user-service — used only
     * if {@code jwt.secret} is absent from the environment (e.g. stale
     * {@code target/classes} after an IDE restart). Prefer setting the property
     * explicitly in production.
     */
    @Value("${jwt.secret:clubhub_super_secret_key_must_be_at_least_32_chars!}")
    private String jwtSecret;

    @Value("${user-service.base-url:http://localhost:8081}")
    private String userServiceBaseUrl;

    private final RestTemplate http = new RestTemplate();

    /** token → resolved fullName (nullable). Avoids a network hop per request. */
    private final Map<String, String> nameCache = new ConcurrentHashMap<>();

    /**
     * Returns the currently authenticated user, or {@code null} if the
     * request carries no valid {@code jwt} cookie. Controllers should
     * translate {@code null} into a 401.
     */
    public SessionUser currentUser(HttpServletRequest request) {
        // 1) HttpOnly cookie set by user-service at login. Works for
        //    same-origin requests but is blocked by SameSite=Lax on
        //    cross-origin XHR (e.g. SPA on :4200 calling gateway on :8084).
        // 2) Fallback to `Authorization: Bearer …` header. The Angular
        //    JwtInterceptor attaches this for cross-origin calls so the
        //    SPA still has a working session even when the cookie is dropped.
        // Resolved into a single effectively-final reference so the lambda
        // below (computeIfAbsent) can capture it.
        final String cookieToken = extractCookie(request, "jwt");
        final String token = cookieToken != null ? cookieToken : extractBearer(request);

        if (token == null) {
            log.warn("currentUser: no 'jwt' cookie nor Bearer header on {} {} (cookies present: {})",
                    request.getMethod(), request.getRequestURI(),
                    cookieNames(request));
            return null;
        }

        Claims claims;
        try {
            claims = parseClaims(token);
        } catch (JwtException | IllegalArgumentException e) {
            log.warn("currentUser: invalid jwt on {} {} → {}",
                    request.getMethod(), request.getRequestURI(), e.getMessage());
            return null;
        }

        String email  = claims.getSubject();
        String userId = (String) claims.get("userId");
        String role   = (String) claims.get("role");
        if (userId == null || email == null) {
            log.warn("currentUser: jwt missing required claims (userId={}, sub={})", userId, email);
            return null;
        }

        // Resolving the display name MUST NOT take down the whole session —
        // a flaky user-service should still let the user RSVP / submit
        // feedback / etc. We swallow any exception and fall back to the
        // email local-part inside resolveDisplayName().
        String fullName;
        try {
            fullName = nameCache.computeIfAbsent(token,
                    k -> resolveDisplayName(userId, token, email));
        } catch (Exception e) {
            log.warn("currentUser: name lookup failed for {} → {}", userId, e.getMessage());
            fullName = fallbackName(email);
        }

        return new SessionUser(userId, email, role, fullName);
    }

    private static String cookieNames(HttpServletRequest req) {
        Cookie[] cookies = req.getCookies();
        if (cookies == null || cookies.length == 0) return "<none>";
        StringBuilder sb = new StringBuilder();
        for (Cookie c : cookies) {
            if (sb.length() > 0) sb.append(',');
            sb.append(c.getName());
        }
        return sb.toString();
    }

    private static String fallbackName(String email) {
        if (email == null) return "Member";
        int at = email.indexOf('@');
        return at > 0 ? email.substring(0, at) : email;
    }

    // ── Helpers ──────────────────────────────────────────────────────────

    private static String extractCookie(HttpServletRequest req, String name) {
        Cookie[] cookies = req.getCookies();
        if (cookies == null) return null;
        for (Cookie c : cookies) {
            if (name.equals(c.getName())) return c.getValue();
        }
        return null;
    }

    private static String extractBearer(HttpServletRequest req) {
        String h = req.getHeader(HttpHeaders.AUTHORIZATION);
        if (h == null || h.isBlank()) return null;
        String trimmed = h.trim();
        if (trimmed.regionMatches(true, 0, "Bearer ", 0, 7)) {
            String token = trimmed.substring(7).trim();
            return token.isEmpty() ? null : token;
        }
        return null;
    }

    private Claims parseClaims(String token) {
        Key key = Keys.hmacShaKeyFor(jwtSecret.getBytes());
        return Jwts.parserBuilder()
                .setSigningKey(key)
                .build()
                .parseClaimsJws(token)
                .getBody();
    }

    /**
     * Best-effort lookup of {@code firstName lastName} from user-service.
     * Falls back to the email local-part when the network call fails so
     * RSVP confirmation emails still address the user by something
     * human-readable.
     */
    @SuppressWarnings("unchecked")
    private String resolveDisplayName(String userId, String token, String email) {
        try {
            String url = userServiceBaseUrl + "/api/users/" + userId;
            HttpHeaders headers = new HttpHeaders();
            // Re-attach the cookie so user-service authenticates the call
            headers.add(HttpHeaders.COOKIE, "jwt=" + token);

            ResponseEntity<Map> resp = http.exchange(
                    url, HttpMethod.GET, new HttpEntity<>(headers), Map.class);

            if (resp.getStatusCode().is2xxSuccessful() && resp.getBody() != null) {
                Object first = resp.getBody().get("firstName");
                Object last  = resp.getBody().get("lastName");
                String name = ((first == null ? "" : first.toString()) + " "
                            + (last  == null ? "" : last.toString())).trim();
                if (!name.isEmpty()) return name;
            }
        } catch (RestClientException e) {
            log.debug("user-service lookup failed for {} → {}", userId, e.getMessage());
        }
        // Reasonable fallback: "alice.smith@uni.fr" → "alice.smith"
        return fallbackName(email);
    }
}
