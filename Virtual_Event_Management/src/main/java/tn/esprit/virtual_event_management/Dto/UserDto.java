package tn.esprit.virtual_event_management.Dto;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

@Data
public class UserDto {
    @JsonProperty("id")
    private String id;

    private String firstName;
    private String lastName;
    private String email;
}
