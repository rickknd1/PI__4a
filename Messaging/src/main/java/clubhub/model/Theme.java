package clubhub.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class Theme {
    private String name;
    private String primaryColor;
    private String accentColor;
    private String bubbleColor;
    private String backgroundColor;
    @JsonProperty("isGradient")
    private boolean isGradient;
    private String gradientEndColor;
    private String backgroundImageUrl;

    public Theme(String name, String primaryColor, String accentColor, String bubbleColor, String backgroundColor, boolean isGradient, String gradientEndColor) {
        this.name = name;
        this.primaryColor = primaryColor;
        this.accentColor = accentColor;
        this.bubbleColor = bubbleColor;
        this.backgroundColor = backgroundColor;
        this.isGradient = isGradient;
        this.gradientEndColor = gradientEndColor;
    }
}