package clubhub.service;



import clubhub.model.Theme;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class ThemePresetService {

    private static final Theme DEFAULT_THEME = new Theme(
            "Classic Blue",
            "#0084FF",
            "#0084FF",
            "#0084FF",
            "#F0F2F5",
            false,
            null
    );

    public List<Theme> getPresets() {
        return List.of(
                DEFAULT_THEME,
                new Theme("Dark Mode", "#1E1E1E", "#00FF9F", "#00FF9F", "#121212", false, null),
                new Theme("Violet Dream", "#8B00FF", "#C77DFF", "#C77DFF", "#F3E8FF", false, null),
                new Theme("Rose Petal", "#FF2D95", "#FF79B5", "#FF79B5", "#FFF0F7", false, null),
                new Theme("Mint Fresh", "#00D4AA", "#4EFFC4", "#4EFFC4", "#E6FFF9", false, null),
                new Theme("Cyberpunk Neon", "#FF00FF", "#00FFFF", "#00FFAA", "#0A0A1F", true, "#1A1A4A"),
                new Theme("Golden Luxury", "#FFD700", "#FFAA00", "#FFDD66", "#1C1C1C", false, null),
                new Theme("Ocean Breeze", "#00BFFF", "#66D9FF", "#66D9FF", "#E6F7FF", false, null)
        );
    }

    public Theme getDefaultTheme() {
        return DEFAULT_THEME;
    }
}
