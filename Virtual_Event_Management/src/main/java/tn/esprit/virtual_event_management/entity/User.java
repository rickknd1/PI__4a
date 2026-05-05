package tn.esprit.virtual_event_management.entity;

import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.DBRef;



@AllArgsConstructor
@NoArgsConstructor
@Data
@Document(collection = "users")
public class User {
    @Id
    private String id;

    private String firstName;


    private String lastName;


    private String phoneNumber;

    private String email;


    private String password;

   private Role role;

    private String profilePhoto;

//
//    @DBRef
//    private Club club;

}
