package clubhub.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class OllamaRequestDTO {
    private String model;
    private String prompt;
    private boolean stream;
    private Map<String, Object> options;
}