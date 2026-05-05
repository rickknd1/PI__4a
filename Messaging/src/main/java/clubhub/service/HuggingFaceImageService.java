package clubhub.service;

import org.springframework.stereotype.Service;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

@Service
public class HuggingFaceImageService {

    public String generateBackgroundImageUrl(String themeDescription) {
        String prompt = buildImagePrompt(themeDescription);
        String encodedPrompt = URLEncoder.encode(prompt, StandardCharsets.UTF_8)
                .replace("+", "%20");

        return "https://image.pollinations.ai/prompt/" + encodedPrompt
                + "?width=768&height=768&nologo=true&seed="
                + (int)(Math.random() * 999999);
    }

    private String buildImagePrompt(String userDescription) {
        return "chat app background wallpaper, " + userDescription
                + ", no text, no UI elements, seamless pattern, soft aesthetic, high quality, 4k";
    }
}