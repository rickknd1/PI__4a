package com.example.cstore.service;

import com.example.cstore.entity.Order;
import com.example.cstore.entity.OrderItem;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.*;
import org.springframework.http.client.HttpComponentsClientHttpRequestFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.CompletableFuture;

/**
 * Cross-service integration: Clubstore -> Treasury.
 *
 * Flow declenche depuis OrderService quand une commande passe en CONFIRMED.
 *
 * Pattern miroir de EventManagement.TreasuryIntegrationService :
 *  - RestTemplate (HttpComponents pour supporter PATCH) vers
 *    http://localhost:8085/api/v1/treasury/{clubId}/expenses
 *  - POST /expenses : utilise le cookie de l'appelant (n'importe quel role authentifie)
 *  - PATCH /validate : login interne en TRESORIER (Rick) — exige hasRole('TRESORIER')
 *  - PATCH /approve  : login interne en PRESIDENT (Ahmed) — exige hasRole('PRESIDENT')
 *
 * Cookies systeme caches 1h pour eviter de spammer /api/auth/login.
 *
 * Erreurs : log + swallow. La commande Clubstore reste sauvegardee meme si Treasury est down.
 */
@Service
@Slf4j
public class TreasuryRecettesService {

    // Use HttpComponentsClientHttpRequestFactory so RestTemplate supports HTTP PATCH
    private final RestTemplate restTemplate = new RestTemplate(new HttpComponentsClientHttpRequestFactory());
    private final ObjectMapper objectMapper = new ObjectMapper();

    // Treasury service tourne sur 8085 (8082 = Voice service)
    private static final String TREASURY_BASE = "http://localhost:8085/api/v1/treasury";
    private static final String TREASURY_ML_RETRAIN = "http://localhost:8085/api/v1/demo/ml/retrain";
    private static final String AUTH_LOGIN_URL = "http://localhost:8081/api/auth/login";

    // Comptes systeme
    private static final String TRESORIER_EMAIL = "rick.tresorier@clubhub.tn";
    private static final String TRESORIER_PASSWORD = "Test1234!";
    private static final String PRESIDENT_EMAIL = "president@clubhub.tn";
    private static final String PRESIDENT_PASSWORD = "Test1234!";

    private static final long DEFAULT_CLUB_ID = 1L;
    private static final long COOKIE_TTL_MS = 60L * 60L * 1000L;

    private volatile String tresorierCookie;
    private volatile long tresorierCookieExpiry = 0L;
    private volatile String presidentCookie;
    private volatile long presidentCookieExpiry = 0L;

    /**
     * Cree une trace dans Treasury quand une commande boutique passe en CONFIRMED/PAID,
     * puis chaine validate (TRESORIER) + approve (PRESIDENT) pour qu'elle compte
     * dans le solde net et l'IA.
     *
     * @param order      la commande Clubstore validee
     * @param jwtCookie  le header Cookie JWT forwarde depuis l'OrderController (peut etre null)
     */
    public void recordOrderAsRecette(Order order, String jwtCookie) {
        if (order == null || order.getTotalAmount() == null
                || order.getTotalAmount().compareTo(BigDecimal.ZERO) <= 0) {
            log.info("Skipping treasury integration for order {}: invalid amount",
                    order != null ? order.getId() : "null");
            return;
        }

        try {
            BigDecimal total = order.getTotalAmount();

            String productSummary = "";
            if (order.getItems() != null && !order.getItems().isEmpty()) {
                StringBuilder sb = new StringBuilder();
                for (OrderItem it : order.getItems()) {
                    if (sb.length() > 0) sb.append(", ");
                    sb.append(it.getProductName())
                      .append(" x").append(it.getQuantity());
                }
                productSummary = sb.toString();
            }

            // Treasury exige 3 quotes (validation @Size(min=3,max=3))
            List<Map<String, Object>> quotes = new ArrayList<>();
            for (int i = 0; i < 3; i++) {
                Map<String, Object> quote = new LinkedHashMap<>();
                quote.put("providerName", "Boutique ClubHub");
                quote.put("amount", total);
                quote.put("description", "Vente boutique - " +
                        (productSummary.isEmpty() ? "commande" : productSummary));
                quotes.add(quote);
            }

            Map<String, Object> body = new LinkedHashMap<>();
            body.put("title", "[RECETTE BOUTIQUE] " + order.getOrderNumber());
            body.put("description", "Recette automatique boutique - Commande "
                    + order.getOrderNumber()
                    + " - Membre " + order.getMemberId()
                    + (productSummary.isEmpty() ? "" : " - " + productSummary));
            body.put("amount", total);
            body.put("quotes", quotes);

            // POST avec le cookie de l'appelant si fourni, sinon fallback compte tresorier systeme
            String postCookie = (jwtCookie != null && !jwtCookie.isBlank())
                    ? jwtCookie
                    : ("jwt=" + getTresorierCookie());
            HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, buildHeaders(postCookie));

            String url = TREASURY_BASE + "/" + DEFAULT_CLUB_ID + "/expenses";
            log.info("Sending recette to Treasury: POST {} | order={} amount={}",
                    url, order.getOrderNumber(), total);

            ResponseEntity<String> response = restTemplate.exchange(
                    url, HttpMethod.POST, request, String.class);

            if (response.getStatusCode().is2xxSuccessful()) {
                log.info("Recette boutique tracee dans Treasury pour commande {}. Response: {}",
                        order.getOrderNumber(), response.getBody());

                String expenseId = extractExpenseId(response.getBody());
                if (expenseId != null) {
                    validateAndApprove(expenseId, DEFAULT_CLUB_ID);
                } else {
                    log.warn("Could not extract expense id from Treasury response for order {}",
                            order.getOrderNumber());
                }
            } else {
                log.warn("Treasury returned non-2xx: {} for order {}",
                        response.getStatusCode(), order.getOrderNumber());
            }

        } catch (Exception e) {
            log.error("Failed to push recette to Treasury for order {}: {}",
                    order.getOrderNumber(), e.getMessage());
        }
    }

    /**
     * Helper: chain PATCH /validate (TRESORIER) + PATCH /approve (PRESIDENT)
     * + async ML retrain. Chaque etape utilise le compte systeme adequat.
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

        // Step 3: async ML retrain
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
     * Lit prioritairement le token du body, fallback sur Set-Cookie.
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

            JsonNode node = objectMapper.readTree(resp.getBody());
            JsonNode tokenNode = node.get("token");
            if (tokenNode != null && !tokenNode.isNull()) {
                String token = tokenNode.asText();
                log.info("Internal {} login OK ({}...)", label, token.length() > 20 ? token.substring(0, 20) : token);
                return token;
            }

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
