package clubhub.service;



import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Component
public class ThemeJsonSanitizer {

    private final ObjectMapper objectMapper;

    // Improved regex to capture the largest JSON object
    private static final Pattern JSON_OBJECT_PATTERN = Pattern.compile("\\{[\\s\\S]*?\\}(?=[^}]*$)", Pattern.MULTILINE);

    public ThemeJsonSanitizer(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public String extractCleanJson(String rawResponse) {
        if (rawResponse == null || rawResponse.trim().isEmpty()) {
            return null;
        }

        String cleaned = rawResponse.trim();

        // Remove markdown code blocks (more variations)
        cleaned = cleaned.replaceAll("(?i)```(?:json)?\\s*", "");
        cleaned = cleaned.replaceAll("```\\s*$", "");

        // Remove common prefixes/suffixes
        cleaned = cleaned.replaceAll("(?i)^(?:here'?s?|the theme is|json:?)\\s*[:\\s]*", "");
        cleaned = cleaned.replaceAll("\\s*Enjoy.*$|(?i)\\s*here is your.*$", "");

        cleaned = cleaned.trim();

        // Attempt 1: Direct parse after cleaning
        if (isValidJson(cleaned)) {
            return cleaned;
        }

        // Attempt 2: Regex extraction of largest JSON object
        Matcher matcher = JSON_OBJECT_PATTERN.matcher(cleaned);
        if (matcher.find()) {
            String candidate = matcher.group(0).trim();
            if (isValidJson(candidate)) {
                return candidate;
            }
        }

        // Attempt 3: Brute-force find first { and last }
        int start = cleaned.indexOf('{');
        int end = cleaned.lastIndexOf('}');
        if (start != -1 && end != -1 && end > start) {
            String candidate = cleaned.substring(start, end + 1).trim();
            if (isValidJson(candidate)) {
                return candidate;
            }
        }

        // Final aggressive trim
        cleaned = cleaned.replaceAll("\\s+$", ""); // remove trailing whitespace
        return isValidJson(cleaned) ? cleaned : null;
    }

    private boolean isValidJson(String text) {
        if (text == null || !text.startsWith("{") || !text.endsWith("}")) {
            return false;
        }
        try {
            JsonNode node = objectMapper.readTree(text);
            return node.isObject();
        } catch (Exception e) {
            return false;
        }
    }
}