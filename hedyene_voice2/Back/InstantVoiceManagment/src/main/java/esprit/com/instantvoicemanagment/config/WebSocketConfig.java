package esprit.com.instantvoicemanagment.config;

import esprit.com.instantvoicemanagment.security.JwtHandshakeInterceptor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

    private final VoiceSignalingHandler voiceSignalingHandler;
    private final JwtHandshakeInterceptor jwtHandshakeInterceptor;

    public WebSocketConfig(VoiceSignalingHandler voiceSignalingHandler,
                           JwtHandshakeInterceptor jwtHandshakeInterceptor) {
        this.voiceSignalingHandler = voiceSignalingHandler;
        this.jwtHandshakeInterceptor = jwtHandshakeInterceptor;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(voiceSignalingHandler, "/ws/voice")
                .addInterceptors(jwtHandshakeInterceptor)
                .setAllowedOrigins("http://localhost:4200");
    }
}
