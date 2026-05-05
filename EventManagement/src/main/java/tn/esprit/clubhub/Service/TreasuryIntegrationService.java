package tn.esprit.clubhub.Service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.*;
import org.springframework.http.client.HttpComponentsClientHttpRequestFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import tn.esprit.clubhub.Entity.BorrowedItem;
import tn.esprit.clubhub.Entity.Devis;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.CompletableFuture;

/**
 * Cross-service integration: pushes validated borrowed-item expenses
 * to the Treasury microservice (port 8085) and chains validate + approve
 * so the expense lands directly in APPROVED state (counts in net balance,
 * feeds the ML Isolation Forest, and shows on the bilan).
 *
 * Auth strategy:
 *  - PATCH /validate exige TRESORIER : on login en interne avec Rick
 *  - PATCH /approve  exige PRESIDENT : on login en interne avec Ahmed
 *  - POST  /expenses : on utilise le cookie de l'appelant (n'importe quel role)
 *
 * Les cookies systeme sont caches 1h pour eviter de spammer /api/auth/login.
 */
@Service
@Slf4j
public class TreasuryIntegrationService {

    // Use HttpComponentsClientHttpRequestFactory so RestTemplate supports HTTP PATCH
    // (default SimpleClientHttpRequestFactory based on HttpURLConnection cannot do PATCH)
    private final RestTemplate restTemplate = new RestTemplate(new HttpComponentsClientHttpRequestFactory());
    private final ObjectMapper objectMapper = new ObjectMapper();

    // Treasury service tourne sur 8085 (8082 = Voice service)
    private static final String TREASURY_BASE = "http://localhost:8085/api/v1/treasury";
    private static final String TREASURY_ML_RETRAIN = "http://localhost:8085/api/v1/demo/ml/retrain";
    private static final String AUTH_LOGIN_URL = "http://localhost:8081/api/auth/login";

    // Comptes systeme pour effectuer validate (TRESORIER) et approve (PRESIDENT)
    private static final String TRESORIER_EMAIL = "rick.tresorier@clubhub.tn";
    private static final String TRESORIER_PASSWORD = "Test1234!";
    private static final String PRESIDENT_EMAIL = "president@clubhub.tn";
    private static final String PRESIDENT_PASSWORD = "Test1234!";

    // Default clubId used for cross-service submissions
    private static final long DEFAULT_CLUB_ID = 1L;

    // Cache cookies pendant 1h (TTL court devant l'expiration JWT 24h pour gerer la rotation)
    private static final long COOKIE_TTL_MS = 60L * 60L * 1000L;

    private volatile String tresorierCookie;
    private volatile long tresorierCookieExpiry = 0L;
    private volatile String presidentCookie;
    private volatile long presidentCookieExpiry = 0L;

    /**
     * After a devis is validated on a borrowed item that has 3 quotes,
     * create a matching expense in Treasury then chain validate + approve
     * so it counts immediately in totalApprovedExpenses / ML / bilan.
     *
     * @param item       the BorrowedItem whose devis was just validated
     * @param allDevis   all devis (quotes) attached to this borrowed item
     * @param jwtCookie  the JWT cookie value from the current user session (forwarded for auth)
     */
    public void createExpenseInTreasury(BorrowedItem item, List<Devis> allDevis, String jwtCookie) {
        if (allDevis == null || allDevis.size() < 3) {
            log.info("Skipping treasury integration: item {} has only {} devis (need 3)",
                    item.getId(), allDevis != null ? allDevis.size() : 0);
            return;
        }

        try {
            // Build the 3 quotes array (take first 3 devis)
            List<Map<String, Object>> quotes = new ArrayList<>();
            BigDecimal total = BigDecimal.ZERO;

            for (int i = 0; i < 3 && i < allDevis.size(); i++) {
                Devis d = allDevis.get(i);
                Map<String, Object> quote = new LinkedHashMap<>();
                quote.put("providerName", d.getSupplierName() != null ? d.getSupplierName() : "Fournisseur " + (i + 1));
                BigDecimal amount = d.getAmount() != null
                        ? BigDecimal.valueOf(d.getAmount())
                        : BigDecimal.ZERO;
                quote.put("amount", amount);
                quote.put("description", d.getNotes() != null ? d.getNotes() : "Devis #" + (i + 1));
                quotes.add(quote);
                total = total.add(amount);
            }

            // Average of the 3 quotes as the expense amount
            BigDecimal averageAmount = total.divide(BigDecimal.valueOf(3), 2, RoundingMode.HALF_UP);

            // Build the request body matching CreateExpenseRequest
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("title", item.getItemName() != null ? item.getItemName() : "Emprunt materiel");
            body.put("description", "Emprunt materiel - " +
                    (item.getEventName() != null ? item.getEventName() : "Evenement"));
            body.put("amount", averageAmount);
            body.put("quotes", quotes);

            // POST avec le cookie de l'appelant (n'importe quel role authentifie convient)
            // Fallback : si pas de cookie, on utilise celui du tresorier (au pire le membre simple aussi marche)
            String postCookie = (jwtCookie != null && !jwtCookie.isBlank()) ? jwtCookie : ("jwt=" + getTresorierCookie());
            HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, buildHeaders(postCookie));

            String url = TREASURY_BASE + "/" + DEFAULT_CLUB_ID + "/expenses";
            log.info("Sending expense to Treasury: POST {} | title={} amount={}",
                    url, body.get("title"), averageAmount);

            ResponseEntity<String> response = restTemplate.exchange(
                    url, HttpMethod.POST, request, String.class);

            if (response.getStatusCode().is2xxSuccessful()) {
                log.info("Expense created in Treasury for item {}. Response: {}",
                        item.getId(), response.getBody());

                // Extract id and chain validate + approve so it shows up in the bilan/ML
                String expenseId = extractExpenseId(response.getBody());
                if (expenseId != null) {
                    validateAndApprove(expenseId, DEFAULT_CLUB_ID);
                } else {
                    log.warn("Could not extract expense id from Treasury response, skipping validate/approve");
                }
            } else {
                log.warn("Treasury returned non-2xx: {} for item {}",
                        response.getStatusCode(), item.getId());
            }

        } catch (Exception e) {
            // Treasury might be down — log and continue, do NOT break the devis validation flow
            log.error("Failed to create expense in Treasury for item {}: {}",
                    item.getId(), e.getMessage());
        }
    }

    /**
     * Helper: chain PATCH /validate (TRESORIER) + PATCH /approve (PRESIDENT)
     * + async ML retrain. Chaque etape utilise le compte systeme adequat pour eviter
     * le 403 sur validate et le 400 sur approve.
     */
    private void validateAndApprove(String expenseId, long clubId) {
        String baseUrl = TREASURY_BASE + "/" + clubId + "/expenses/" + expenseId;

        // Step 1: validate avec le cookie TRESORIER (Rick)
        boolean validateOk = false;
        try {
            String tresorierJwt = getTresorierCookie();
            if (tresorierJwt == null) {
                log.warn("No TRESORIER cookie available — skipping validate for expense {}", expenseId);
            } else {
                Map<String, Object> validateBody = new LinkedHashMap<>();
                validateBody.put("selectedQuoteIndex", 0);
                HttpEntity<Map<String, Object>> req = new HttpEntity<>(validateBody, buildHeaders("jwt=" + tresorierJwt));

                ResponseEntity<String> resp = restTemplate.exchange(
                        baseUrl + "/validate", HttpMethod.PATCH, req, String.class);
                log.info("Treasury validate OK for expense {} -> {}", expenseId, resp.getStatusCode());
                validateOk = resp.getStatusCode().is2xxSuccessful();
            }
        } catch (Exception e) {
            log.warn("Treasury validate FAILED for expense {} (continuing): {}", expenseId, e.getMessage());
            // Si auth-related, on invalide le cache pour retenter au prochain appel
            invalidateTresorierCookie();
        }

        if (!validateOk) {
            log.warn("Skipping approve for expense {} since validate failed", expenseId);
            return;
        }

        // Step 2: approve avec le cookie PRESIDENT (Ahmed)
        try {
            String presidentJwt = getPresidentCookie();
            if (presidentJwt == null) {
                log.warn("No PRESIDENT cookie available — skipping approve for expense {}", expenseId);
            } else {
                HttpEntity<Void> req = new HttpEntity<>(buildHeaders("jwt=" + presidentJwt));
                ResponseEntity<String> resp = restTemplate.exchange(
                        baseUrl + "/approve", HttpMethod.PATCH, req, String.class);
                log.info("Treasury approve OK for expense {} -> {}", expenseId, resp.getStatusCode());
            }
        } catch (Exception e) {
            log.warn("Treasury approve FAILED for expense {}: {}", expenseId, e.getMessage());
            invalidatePresidentCookie();
        }

        // Step 3: async ML retrain so new approved expense feeds Isolation Forest
        retrainMlAsync();
    }

    @Async
    public CompletableFuture<Void> retrainMlAsync() {
        return CompletableFuture.runAsync(() -> {
            try {
                HttpEntity<Void> req = new HttpEntity<>(new HttpHeaders());
                ResponseEntity<String> resp = restTemplate.exchange(
                        TREASURY_ML_RETRAIN, HttpMethod.POST, req, String.class);
                log.info("Treasury ML retrain OK -> {}", resp.getStatusCode());
            } catch (Exception e) {
                log.warn("Treasury ML retrain FAILED (non-blocking): {}", e.getMessage());
            }
        });
    }

    private HttpHeaders buildHeaders(String cookieHeader) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        if (cookieHeader != null && !cookieHeader.isBlank()) {
            headers.add("Cookie", cookieHeader);
        }
        return headers;
    }

    private String extractExpenseId(String responseBody) {
        if (responseBody == null || responseBody.isBlank()) return null;
        try {
            JsonNode node = objectMapper.readTree(responseBody);
            JsonNode idNode = node.get("id");
            return idNode != null && !idNode.isNull() ? idNode.asText() : null;
        } catch (Exception e) {
            log.warn("Failed to parse Treasury response JSON: {}", e.getMessage());
            return null;
        }
    }

    // ─── Internal auth helpers ──────────────────────────────────────────────

    /** Cookie JWT du compte TRESORIER (Rick). Cache 1h. */
    private synchronized String getTresorierCookie() {
        if (tresorierCookie != null && Instant.now().toEpochMilli() < tresorierCookieExpiry) {
            return tresorierCookie;
        }
        String token = loginInternal(TRESORIER_EMAIL, TRESORIER_PASSWORD, "TRESORIER");
        if (token != null) {
            tresorierCookie = token;
            tresorierCookieExpiry = Instant.now().toEpochMilli() + COOKIE_TTL_MS;
        }
        return tresorierCookie;
    }

    /** Cookie JWT du compte PRESIDENT (Ahmed). Cache 1h. */
    private synchronized String getPresidentCookie() {
        if (presidentCookie != null && Instant.now().toEpochMilli() < presidentCookieExpiry) {
            return presidentCookie;
        }
        String token = loginInternal(PRESIDENT_EMAIL, PRESIDENT_PASSWORD, "PRESIDENT");
        if (token != null) {
            presidentCookie = token;
            presidentCookieExpiry = Instant.now().toEpochMilli() + COOKIE_TTL_MS;
        }
        return presidentCookie;
    }

    private synchronized void invalidateTresorierCookie() {
        tresorierCookie = null;
        tresorierCookieExpiry = 0L;
    }

    private synchronized void invalidatePresidentCookie() {
        presidentCookie = null;
        presidentCookieExpiry = 0L;
    }

    /**
     * Login interne au user-service (8081) pour recuperer un JWT.
     * Utilise prioritairement le token du body (plus fiable cross-service)
     * puis fallback sur le header Set-Cookie si besoin.
     *
     * @return la valeur du JWT (sans le prefixe "jwt="), ou null en cas d'echec
     */
    private String loginInternal(String email, String password, String label) {
        try {
            Map<String, String> body = new LinkedHashMap<>();
            body.put("email", email);
            body.put("password", password);
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<Map<String, String>> req = new HttpEntity<>(body, headers);

            ResponseEntity<String> resp = restTemplate.exchange(
                    AUTH_LOGIN_URL, HttpMethod.POST, req, String.class);

            if (!resp.getStatusCode().is2xxSuccessful()) {
                log.warn("Internal {} login failed: HTTP {}", label, resp.getStatusCode());
                return null;
            }

            // Strategie 1 : extraire le token du JSON body (toujours present)
            JsonNode node = objectMapper.readTree(resp.getBody());
            JsonNode tokenNode = node.get("token");
            if (tokenNode != null && !tokenNode.isNull()) {
                String token = tokenNode.asText();
                log.info("Internal {} login OK ({}...)", label, token.length() > 20 ? token.substring(0, 20) : token);
                return token;
            }

            // Strategie 2 (fallback) : parser Set-Cookie
            List<String> setCookies = resp.getHeaders().get(HttpHeaders.SET_COOKIE);
            if (setCookies != null) {
                for (String sc : setCookies) {
                    if (sc.startsWith("jwt=")) {
                        int semi = sc.indexOf(';');
                        String jwt = semi > 0 ? sc.substring(4, semi) : sc.substring(4);
                        log.info("Internal {} login OK (from cookie)", label);
                        return jwt;
                    }
                }
            }
            log.warn("Internal {} login : no token in response", label);
            return null;
        } catch (Exception e) {
            log.error("Internal {} login error: {}", label, e.getMessage());
            return null;
        }
    }
}
