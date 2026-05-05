package com.clubhub.treasury.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;

/**
 * Lit et valide les JWT generes par le module User (esprit.com.clubhub).
 * Le secret doit etre identique des deux cotes (config jwt.secret).
 *
 * Claims attendus:
 *  - sub      : email
 *  - userId   : ObjectId Mongo (String)
 *  - role     : enum Role (PRESIDENT, TRESORIER, MEMBRE_SIMPLE, ...)
 */
@Component
public class JwtTokenProvider {

    private final SecretKey signingKey;

    public JwtTokenProvider(@Value("${jwt.secret}") String secret) {
        this.signingKey = Keys.hmacShaKeyFor(secret.getBytes());
    }

    public boolean validate(String token) {
        try {
            parseClaims(token);
            return true;
        } catch (JwtException | IllegalArgumentException e) {
            return false;
        }
    }

    public String getEmail(String token) {
        return parseClaims(token).getSubject();
    }

    public String getUserId(String token) {
        return (String) parseClaims(token).get("userId");
    }

    public String getRole(String token) {
        return (String) parseClaims(token).get("role");
    }

    private Claims parseClaims(String token) {
        return Jwts.parser()
                .verifyWith(signingKey)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }
}
