package tn.esprit.virtual_event_management.config;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class CorsConfig implements WebMvcConfigurer{
    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/**")                          // Toutes les routes
                .allowedOriginPatterns("*")                 // ← Utilise allowedOriginPatterns au lieu de allowedOrigins("*")
                .allowedMethods("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS")
                .allowedHeaders("*")
                .exposedHeaders("Authorization", "Content-Type")
                .allowCredentials(true)                     // Garde true si tu utilises l'authentification plus tard
                .maxAge(3600);                              // Cache CORS pendant 1 heure
    }
}
