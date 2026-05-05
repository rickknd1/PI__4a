package tn.esprit.virtual_event_management.controller;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

import java.util.Map;

/**
 * Signaling server pour WebRTC.
 * Spring Boot ne touche PAS aux données audio (peer-to-peer).
 * Il sert juste à transmettre les offres/answers/candidates ICE entre les clients.
 */
@Controller
public class SignalingController {
    private final SimpMessagingTemplate messagingTemplate;

    public SignalingController(SimpMessagingTemplate messagingTemplate) {
        this.messagingTemplate = messagingTemplate;
    }

    /**
     * Signal direct à un peer spécifique.
     * Client envoie sur : /app/signal/{targetId}
     * Le peer reçoit sur : /topic/signal/{targetId}
     */
    @MessageMapping("/signal/{targetId}")
    public void relaySignal(
            @DestinationVariable String targetId,
            Map<String, Object> signal
    ) {
        messagingTemplate.convertAndSend("/topic/signal/" + targetId, signal);
    }

    /**
     * Broadcast à tout le monde (join / leave).
     * Client envoie sur : /app/signal/broadcast
     * Tous reçoivent sur : /topic/signal/broadcast
     */
    @MessageMapping("/signal/broadcast")
    @SendTo("/topic/signal/broadcast")
    public Map<String, Object> broadcastSignal(Map<String, Object> signal) {
        return signal;
    }
}
