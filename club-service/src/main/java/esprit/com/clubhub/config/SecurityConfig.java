package esprit.com.clubhub.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    /**
     * CORS is intentionally disabled here.
     *
     * The Spring Cloud Gateway (port 8084) is responsible for answering
     * pre-flight OPTIONS requests and adding the proper CORS headers on
     * downstream responses. If we also enable CORS here, the browser would
     * receive duplicate `Access-Control-Allow-Origin` headers and reject
     * the response.
     *
     * Same setup as user-service.
     */
    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
                .csrf(csrf -> csrf.disable())
                .cors(cors -> cors.disable())
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .anyRequest().permitAll()
                );
        return http.build();
    }
}
