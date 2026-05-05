package com.clubhub.treasury.entity;

import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

import java.time.LocalDateTime;

@Document(collection = "users")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class User {

    @Id
    private String id;

    @Indexed(unique = true)
    @Field("email")
    private String email;

    @Field("first_name")
    private String firstName;

    @Field("last_name")
    private String lastName;

    private UserRole role;

    @Indexed
    @Field("club_id")
    private Long clubId;

    private LocalDateTime createdAt = LocalDateTime.now();

    public String getFullName() { return firstName + " " + lastName; }

    public enum UserRole {
        PRESIDENT, VICE_PRESIDENT, SECRETAIRE_GENERALE, TRESORIER, RH, MEMBRE_SIMPLE,
        MEMBRE_BUREAU, MEMBRE  // legacy
    }
}
