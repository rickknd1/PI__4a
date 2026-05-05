package esprit.com.instantvoicemanagment.entity;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Data
@Document(collection = "channels")
public class Channel {

    @Id
    private String id;

    private String name;
    @JsonProperty("isPrivate")
    private boolean isPrivate;
    private LocalDateTime createdAt = LocalDateTime.now();

    private List<String> memberIds = new ArrayList<>();
    private List<String> kickedMemberIds = new ArrayList<>();
    private String createdBy;

    @JsonProperty("isCommitteeChannel")
    private boolean committeeChannel;
}