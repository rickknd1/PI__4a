package esprit.com.instantvoicemanagment;

import esprit.com.instantvoicemanagment.service.ModerationService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.web.client.RestTemplate;

@SpringBootApplication
public class InstantVoiceManagmentApplication {

    private static final Logger log = LoggerFactory.getLogger("AI-Moderation");

    public static void main(String[] args) {
        SpringApplication.run(InstantVoiceManagmentApplication.class, args);
    }

    @Bean
    CommandLineRunner scanHistoryOnStartup(ModerationService moderationService) {
        return args -> new Thread(() -> {
            waitForPythonService();
            moderationService.scanHistory();
        }, "ai-history-scan").start();
    }

    private void waitForPythonService() {
        RestTemplate rt = new RestTemplate();
        log.info("[AI] Waiting for Python service to be ready...");
        for (int i = 0; i < 90; i++) {
            try {
                rt.getForObject("http://localhost:8000/health", String.class);
                log.info("[AI] Python service is ready — starting history scan.");
                return;
            } catch (Exception ignored) {}
            try { Thread.sleep(2000); } catch (InterruptedException ie) {
                Thread.currentThread().interrupt();
                return;
            }
        }
        log.warn("[AI] Python service did not respond after 3 minutes — skipping history scan.");
    }
}
