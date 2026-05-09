package esprit.com.clubhub.config;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpRequest;
import org.springframework.http.client.ClientHttpRequestExecution;
import org.springframework.http.client.ClientHttpRequestInterceptor;
import org.springframework.http.client.ClientHttpResponse;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.context.request.RequestAttributes;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.io.IOException;
import java.util.List;

@Configuration
public class AppConfig {

    /**
     * RestTemplate avec un intercepteur qui propage l'authentification de la
     * requete entrante (cookie jwt OU header Authorization Bearer) vers les
     * appels sortants vers les autres microservices.
     *
     * Pourquoi : depuis l'introduction du filtre multi-tenant cote user-service
     * (GET /api/users renvoie uniquement les users du club de l'appelant),
     * les appels service-to-service sans auth tombent en 403. Sans propagation,
     * ClubService.ensureBureauMembersInCommitteeChannel() ne pouvait plus
     * recuperer la liste des users -> les voice channels n'etaient jamais
     * crees pour les nouveaux comites.
     *
     * On regarde d'abord le cookie "jwt" (chemin standard ClubHub),
     * puis on retombe sur le header Authorization si present (utile dans les
     * tests automatises).
     */
    @Bean
    public RestTemplate restTemplate() {
        RestTemplate rt = new RestTemplate();
        rt.getInterceptors().add(new JwtForwardingInterceptor());
        return rt;
    }

    private static class JwtForwardingInterceptor implements ClientHttpRequestInterceptor {
        @Override
        public ClientHttpResponse intercept(HttpRequest request, byte[] body,
                                            ClientHttpRequestExecution execution) throws IOException {
            // Si l'appel est deja authentifie (header explicite pose par le code), on ne touche rien.
            if (request.getHeaders().containsKey(HttpHeaders.AUTHORIZATION)) {
                return execution.execute(request, body);
            }

            HttpServletRequest currentRequest = currentRequest();
            if (currentRequest != null) {
                String token = extractToken(currentRequest);
                if (token != null && !token.isEmpty()) {
                    request.getHeaders().add(HttpHeaders.AUTHORIZATION, "Bearer " + token);
                    // Forward aussi le cookie jwt pour les services qui ne lisent que les cookies.
                    request.getHeaders().add(HttpHeaders.COOKIE, "jwt=" + token);
                }
            }
            return execution.execute(request, body);
        }

        private HttpServletRequest currentRequest() {
            RequestAttributes attrs = RequestContextHolder.getRequestAttributes();
            if (attrs instanceof ServletRequestAttributes sra) {
                return sra.getRequest();
            }
            return null;
        }

        private String extractToken(HttpServletRequest request) {
            // 1) cookie jwt (chemin principal cote ClubHub).
            Cookie[] cookies = request.getCookies();
            if (cookies != null) {
                for (Cookie c : cookies) {
                    if ("jwt".equals(c.getName()) && c.getValue() != null && !c.getValue().isEmpty()) {
                        return c.getValue();
                    }
                }
            }
            // 2) Authorization Bearer header (fallback / tests).
            List<String> auths = List.of();
            try { auths = java.util.Collections.list(request.getHeaders(HttpHeaders.AUTHORIZATION)); }
            catch (Exception ignored) { }
            for (String a : auths) {
                if (a != null && a.startsWith("Bearer ")) return a.substring("Bearer ".length()).trim();
            }
            String single = request.getHeader(HttpHeaders.AUTHORIZATION);
            if (single != null && single.startsWith("Bearer ")) return single.substring("Bearer ".length()).trim();
            return null;
        }
    }
}
