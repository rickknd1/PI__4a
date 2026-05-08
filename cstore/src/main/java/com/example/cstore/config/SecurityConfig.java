package com.example.cstore.config;

import com.example.security.JwtAuthFilter;
import com.example.security.JwtUtil;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

/**
 * SecurityConfig du store-service (cstore).
 *
 * Avant : la classe etait vide et application.properties excluait
 * SecurityAutoConfiguration => tous les endpoints etaient publics, y compris
 * PUT /api/orders/{id}/status (n'importe qui pouvait passer une commande
 * en VALIDATED et donc declencher la conversion en recette Treasury).
 *
 * Apres :
 *  - GET /api/products/** et /actuator/** restent publics (catalogue + health).
 *  - Tout le reste exige un cookie JWT valide (pose par user-service).
 *  - @PreAuthorize sur OrderController applique des regles fines (admin only
 *    pour update status / list all).
 */
@Configuration
@EnableWebSecurity
@EnableMethodSecurity  // active @PreAuthorize sur les controllers
public class SecurityConfig {

    private final JwtUtil jwtUtil;

    public SecurityConfig(JwtUtil jwtUtil) {
        this.jwtUtil = jwtUtil;
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
                .csrf(csrf -> csrf.disable())
                // CORS deja configure dans com.example.cstore.config.CorsConfig
                // (WebMvcConfigurer pour http://localhost:4200). On desactive ici
                // pour eviter le doublon Access-Control-Allow-Origin.
                .cors(cors -> cors.disable())
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        // Catalogue produits public (lecture seule).
                        .requestMatchers(org.springframework.http.HttpMethod.GET, "/api/products/**").permitAll()
                        .requestMatchers("/actuator/**").permitAll()
                        // Tout le reste exige un JWT valide. Les controllers appliquent
                        // ensuite les regles fines via @PreAuthorize.
                        .anyRequest().authenticated()
                )
                .addFilterBefore(new JwtAuthFilter(jwtUtil),
                        UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }
}
