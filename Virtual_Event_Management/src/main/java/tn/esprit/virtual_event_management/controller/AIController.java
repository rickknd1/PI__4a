package tn.esprit.virtual_event_management.controller;

import lombok.AllArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import tn.esprit.virtual_event_management.service.GeminiService;
@AllArgsConstructor
@RestController
@RequestMapping("/api/ai")
public class AIController {

    private final GeminiService geminiService;

    @PostMapping("/parse")
    public String parse(@RequestBody String prompt) {
        return geminiService.extractEvent(prompt);
    }
}
