package com.clubhub.treasury.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Arrays;
import java.util.List;

/**
 * Lit le cookie 'jwt' (pose par le module User sur port 8081) sur chaque requete.
 * Si valide, alimente le SecurityContext avec ROLE_<role> et l'email comme principal.
 * Stocke aussi userId comme details pour acces depuis les controllers.
 */
@Component
public class JwtCookieAuthFilter extends OncePerRequestFilter {

    private final JwtTokenProvider jwt;
    private final String cookieName;

    public JwtCookieAuthFilter(JwtTokenProvider jwt,
                               @Value("${jwt.cookie-name:jwt}") String cookieName) {
        this.jwt = jwt;
        this.cookieName = cookieName;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest req,
                                    HttpServletResponse res,
                                    FilterChain chain) throws ServletException, IOException {

        String token = extractToken(req);

        if (token != null && jwt.validate(token)) {
            String email  = jwt.getEmail(token);
            String userId = jwt.getUserId(token);
            String role   = jwt.getRole(token);

            UsernamePasswordAuthenticationToken auth =
                new UsernamePasswordAuthenticationToken(
                    email,
                    null,
                    List.of(new SimpleGrantedAuthority("ROLE_" + role))
                );
            // userId accessible via SecurityContextHolder.getContext().getAuthentication().getDetails()
            auth.setDetails(userId);
            SecurityContextHolder.getContext().setAuthentication(auth);
        }

        chain.doFilter(req, res);
    }

    private String extractToken(HttpServletRequest req) {
        // 1. Cookie jwt (cas standard avec module User)
        if (req.getCookies() != null) {
            String fromCookie = Arrays.stream(req.getCookies())
                .filter(c -> cookieName.equals(c.getName()))
                .map(Cookie::getValue)
                .findFirst()
                .orElse(null);
            if (fromCookie != null) return fromCookie;
        }
        // 2. Fallback header Authorization: Bearer (utile pour Swagger/Postman)
        String header = req.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")) {
            return header.substring(7);
        }
        return null;
    }
}
