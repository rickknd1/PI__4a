package clubhub.dto;

import clubhub.model.Theme;
import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class ThemeGenerationResultDTO {
    private Theme theme;
    private boolean success;
    private String message; // "success" or user-friendly error

}