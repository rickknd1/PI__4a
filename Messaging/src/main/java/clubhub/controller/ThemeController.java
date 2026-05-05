package clubhub.controller;

// ThemeController.java


import clubhub.model.Theme;
import clubhub.service.ThemeService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/conversations")
@RequiredArgsConstructor
public class ThemeController {

    private final ThemeService themeService;

    @GetMapping("/themes/presets")
    public ResponseEntity<List<Theme>> getPresets() {
        return ResponseEntity.ok(themeService.getPresets());
    }

    @PostMapping("/{conversationId}/theme/generate")
    public ResponseEntity<Theme> generateTheme(
            @PathVariable String conversationId,
            @RequestHeader("userId") String userId,   // or from SecurityContext
            @RequestBody String prompt) {

        Theme theme = themeService.generateAndApplyTheme(conversationId, userId, prompt);
        return ResponseEntity.ok(theme);
    }

    @PutMapping("/{conversationId}/theme")
    public ResponseEntity<Theme> applyTheme(
            @PathVariable String conversationId,
            @RequestHeader("userId") String userId,
            @RequestBody Theme theme) {

        Theme updated = themeService.applyTheme(conversationId, userId, theme);
        return ResponseEntity.ok(updated);
    }
}