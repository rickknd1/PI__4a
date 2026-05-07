package esprit.com.clubhub.config;

import esprit.com.clubhub.security.JwtAuthFilter;
import esprit.com.clubhub.security.JwtUtil;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    /**
     * CORS gere uniquement par le Gateway (port 8084).
     * Filter JWT lit le cookie pose par user-service ; sans cookie ou cookie invalide,
     * les endpoints sensibles renvoient 401/403 (avant: anyRequest().permitAll() —
     * n'importe qui sans JWT pouvait creer une election, un comite, un role custom).
     */
    private final JwtUtil jwtUtil;

    public SecurityConfig(JwtUtil jwtUtil) {
        this.jwtUtil = jwtUtil;
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
                .csrf(csrf -> csrf.disable())
                .cors(cors -> cors.disable())
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        // Endpoints publics : health, listing public des clubs (visibilite=PUBLIC),
                        // setup-password (lien envoye par email avec token UUID).
                        .requestMatchers("/actuator/**").permitAll()
                        .requestMatchers("/api/clubs/public/**").permitAll()
                        .requestMatchers("/api/invitations/setup-password/**").permitAll()
                        .requestMatchers("/api/invitations/accept/**").permitAll()
                        .requestMatchers("/api/qr-tokens/scan/**").permitAll()
                        // Tout le reste exige un JWT valide. Les controllers appliquent
                        // ensuite les regles fines (PRESIDENT only, membre du club, etc.)
                        // via @PreAuthorize ou checks manuels avec authentication.details (userId).
                        .anyRequest().authenticated()
                )
                .addFilterBefore(new JwtAuthFilter(jwtUtil),
                        UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }
}
