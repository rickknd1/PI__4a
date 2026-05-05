package tn.esprit.virtual_event_management.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.reactive.function.client.WebClient;
import tn.esprit.virtual_event_management.entity.User;

@Service
public class UserClientService {

    private final WebClient webClient;
    public UserClientService(WebClient.Builder builder) {
        this.webClient = builder.baseUrl("http://localhost:8081/api/users").build();
    }

    // 🔥 vérifier si user existe
    public boolean existsById(String userId) {
        try {
            return webClient.get()
                    .uri("/{id}", userId)
                    .retrieve()
                    .bodyToMono(Object.class)
                    .block() != null;
        } catch (Exception e) {
            return false;
        }
    }
}
