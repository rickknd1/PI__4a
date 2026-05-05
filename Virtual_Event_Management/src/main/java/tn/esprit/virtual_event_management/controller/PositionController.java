package tn.esprit.virtual_event_management.controller;

import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.stereotype.Controller;
import tn.esprit.virtual_event_management.entity.PlayerState;

@Controller
public class PositionController {
    @MessageMapping("/position")
    @SendTo("/topic/positions")
    public PlayerState broadcastPosition(PlayerState state) {
        return state;
    }
}
