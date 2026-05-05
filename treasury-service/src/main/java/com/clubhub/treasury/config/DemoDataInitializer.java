package com.clubhub.treasury.config;

import com.clubhub.treasury.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

/**
 * Auto-seed la base de demo au demarrage si elle est vide.
 * Active uniquement sur le profil "dev" pour eviter de seeder en prod.
 *
 * Pourquoi via HTTP plutot que d'appeler le service directement ?
 * Le seed inclut @Transactional + invocation des services ML qui
 * dependent de la disponibilite complete du contexte Spring.
 * On differe l'appel jusqu'a ce que Tomcat ait demarre, pour eviter
 * les race conditions au boot.
 */
@Configuration
@Profile("dev")
public class DemoDataInitializer implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(DemoDataInitializer.class);

    @Autowired
    private UserRepository userRepo;

    @Override
    public void run(String... args) {
        long userCount = userRepo.count();
        if (userCount > 0) {
            log.info("Demo data deja presente ({} users), pas de re-seed", userCount);
            return;
        }

        // Lancer le seed dans un thread separe apres demarrage de Tomcat
        new Thread(() -> {
            try {
                Thread.sleep(2000);  // attend que Tomcat soit pret
                HttpClient client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
                HttpRequest request = HttpRequest.newBuilder()
                        .uri(URI.create("http://localhost:8085/api/v1/demo/seed"))
                        .POST(HttpRequest.BodyPublishers.noBody())
                        .timeout(Duration.ofSeconds(60))
                        .build();
                HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
                if (response.statusCode() == 200) {
                    log.info("=== AUTO-SEED REUSSI : demo prete sur http://localhost:4200 ===");
                } else {
                    log.warn("Auto-seed retour HTTP {}", response.statusCode());
                }
            } catch (Exception e) {
                log.warn("Auto-seed echoue (non bloquant): {}", e.getMessage());
            }
        }, "demo-auto-seed").start();
    }
}
