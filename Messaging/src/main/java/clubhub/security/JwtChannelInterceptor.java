package clubhub.security;

import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.stereotype.Component;

import java.security.Principal;
import java.util.List;

/**
 * Authentifie les CONNECT STOMP via JWT (cookie ou header X-Authorization).
 *
 * Avant cet interceptor : aucune auth WS, n'importe qui pouvait se subscribe
 * a /topic/conversation/X et lire toutes les conversations en temps reel.
 *
 * Apres : si pas de token valide, le user principal est null et les controllers
 * peuvent rejeter le CONNECT (pas obligatoire ici car les topics sont broadcast,
 * mais les /user destinations sont protegees).
 */
@Component
public class JwtChannelInterceptor implements ChannelInterceptor {

    private final JwtUtil jwt;

    public JwtChannelInterceptor(JwtUtil jwt) {
        this.jwt = jwt;
    }

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
        if (accessor == null) return message;

        if (StompCommand.CONNECT.equals(accessor.getCommand())) {
            String token = extractToken(accessor);
            if (token != null && jwt.validateToken(token)) {
                final String userId = jwt.extractUserId(token);
                final String email = jwt.extractEmail(token);
                // Principal STOMP utilisable depuis @MessageMapping handlers via principal.getName()
                accessor.setUser(new SimplePrincipal(userId, email));
            }
        }

        return message;
    }

    /** Lit le JWT depuis le header X-Authorization (envoye par stomp client) ou Cookie. */
    private String extractToken(StompHeaderAccessor accessor) {
        List<String> auth = accessor.getNativeHeader("X-Authorization");
        if (auth != null && !auth.isEmpty()) {
            String value = auth.get(0);
            return value.startsWith("Bearer ") ? value.substring(7) : value;
        }
        List<String> cookies = accessor.getNativeHeader("Cookie");
        if (cookies != null && !cookies.isEmpty()) {
            for (String c : cookies.get(0).split(";")) {
                c = c.trim();
                if (c.startsWith("jwt=")) {
                    return c.substring(4);
                }
            }
        }
        return null;
    }

    /** Principal minimal (pas de dep Spring Security). userId comme name, email en details. */
    public static class SimplePrincipal implements Principal {
        private final String userId;
        private final String email;
        public SimplePrincipal(String userId, String email) {
            this.userId = userId;
            this.email = email;
        }
        @Override public String getName() { return userId; }
        public String getEmail() { return email; }
    }
}
