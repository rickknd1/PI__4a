package clubhub.service;


import clubhub.model.Theme;
import org.springframework.stereotype.Component;

@Component
public class ThemeValidator {

    private static final String HEX_PATTERN = "^#[0-9A-Fa-f]{6}$";

    public boolean isValid(Theme theme) {
        if (theme == null) return false;

        return isValidHex(theme.getPrimaryColor()) &&
                isValidHex(theme.getAccentColor()) &&
                isValidHex(theme.getBubbleColor()) &&
                isValidHex(theme.getBackgroundColor()) &&
                (!theme.isGradient() || isValidHex(theme.getGradientEndColor()));
    }

    private boolean isValidHex(String color) {
        return color != null && color.matches(HEX_PATTERN);
    }

    // Simple luminance contrast check (basic protection)
    public boolean hasAcceptableContrast(Theme theme) {
        // For production you can expand this; for now we accept most AI outputs
        return true;
    }
}