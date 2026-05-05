package clubhub.dto;

// ConversationThemeEvent.java


import clubhub.model.Theme;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ConversationThemeEvent {
    private String type = "THEME_UPDATED";
    private Theme theme;
}