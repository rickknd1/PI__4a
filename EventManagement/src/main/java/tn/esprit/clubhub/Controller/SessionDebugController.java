package tn.esprit.clubhub.Controller;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import tn.esprit.clubhub.Security.SessionService;
import tn.esprit.clubhub.Security.SessionUser;

import java.util.Enumeration;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Read-only diagnostic endpoint used to debug "session ended" / 401
 * problems on session-aware endpoints (RSVP, feedback, …).
 *
 * <p>Hit it from the browser <b>while signed in</b>:
 * <pre>
 *   GET http://localhost:8084/api/session/debug
 * </pre>
 * It echoes back exactly what the Backend sees (cookies, decoded JWT
 * identity, name lookup result) so we can tell whether the cookie
 * crossed the gateway, whether the JWT secret matches user-service,
 * and whether the user-service lookup is reachable.
 *
 * <p>Safe to ship — never returns the raw JWT, only the resolved
 * identity.
 */
@RestController
@RequestMapping("/api/session")
public class SessionDebugController {

    @Autowired
    private SessionService sessionService;

    @GetMapping("/debug")
    public ResponseEntity<Map<String, Object>> debug(HttpServletRequest request) {
        Map<String, Object> body = new LinkedHashMap<>();

        body.put("method", request.getMethod());
        body.put("uri", request.getRequestURI());
        body.put("origin", header(request, "origin"));
        body.put("host", header(request, "host"));
        body.put("xForwardedFor", header(request, "x-forwarded-for"));

        body.put("cookies", listCookies(request));
        body.put("cookieHeader", header(request, "cookie"));

        // The Bearer header is the cross-origin fallback. Surface it so we
        // can distinguish "browser silently dropped the cookie" from
        // "the SPA never sent any credentials at all".
        String auth = header(request, "authorization");
        body.put("authorizationHeader", auth == null ? "<none>"
                : auth.length() <= 24 ? auth : auth.substring(0, 24) + "...");

        SessionUser me = sessionService.currentUser(request);
        if (me == null) {
            body.put("authenticated", false);
            body.put("reason",
                    "currentUser() returned null — see Backend log for the exact cause "
                  + "(no jwt cookie / invalid jwt / missing claim / secret mismatch).");
        } else {
            body.put("authenticated", true);
            body.put("user", Map.of(
                    "id",       nullSafe(me.id()),
                    "email",    nullSafe(me.email()),
                    "role",     nullSafe(me.role()),
                    "fullName", nullSafe(me.fullName())
            ));
        }

        return ResponseEntity.ok(body);
    }

    private static Object listCookies(HttpServletRequest req) {
        Cookie[] cookies = req.getCookies();
        if (cookies == null) return "<none>";
        Map<String, Object> map = new LinkedHashMap<>();
        for (Cookie c : cookies) {
            int len = c.getValue() == null ? 0 : c.getValue().length();
            map.put(c.getName(), Map.of(
                    "length", len,
                    "preview", len <= 12 ? c.getValue() : c.getValue().substring(0, 12) + "..."
            ));
        }
        return map;
    }

    private static String header(HttpServletRequest req, String name) {
        Enumeration<String> values = req.getHeaders(name);
        if (values == null || !values.hasMoreElements()) return null;
        return values.nextElement();
    }

    private static String nullSafe(String s) { return s == null ? "" : s; }
}
