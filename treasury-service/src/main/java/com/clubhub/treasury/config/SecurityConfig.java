package com.clubhub.treasury.config;

import com.clubhub.treasury.security.JwtCookieAuthFilter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity  // active @PreAuthorize / @PostAuthorize sur les controllers
public class SecurityConfig {

    private final JwtCookieAuthFilter jwtFilter;

    public SecurityConfig(JwtCookieAuthFilter jwtFilter) {
        this.jwtFilter = jwtFilter;
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .csrf(csrf -> csrf.disable())
            // CORS gere uniquement par le Gateway (port 8084). Le frontend doit appeler
            // les endpoints /api/v1/demo/** via le gateway (route ajoutee dans
            // gateway/application.properties). Pas de CORS ici sinon doublon Access-Control-Allow-Origin.
            .cors(cors -> cors.disable())
            .headers(headers -> headers.frameOptions(f -> f.sameOrigin())) // H2 console
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                // public — utilitaires
                .requestMatchers("/h2-console/**").permitAll()
                .requestMatchers("/swagger-ui/**", "/swagger-ui.html", "/api-docs/**", "/v3/api-docs/**").permitAll()
                .requestMatchers("/actuator/health", "/error").permitAll()
                // public — seed demo (a securiser en prod)
                .requestMatchers("/api/v1/demo/**").permitAll()
                // mock-login local (a retirer quand le module User est en place definitif)
                .requestMatchers("/api/v1/users/mock-login").permitAll()
                // tout le reste exige une authentification (cookie jwt)
                .anyRequest().authenticated()
            )
            .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        // Pas de wildcard quand allowCredentials = true
        config.setAllowedOrigins(List.of(
            "http://localhost:4200",  // frontend Angular (dev direct)
            "http://localhost:8084"   // Gateway Spring Cloud (entry point unique)
        ));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        config.setExposedHeaders(List.of("Set-Cookie"));
        config.setAllowCredentials(true);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}
