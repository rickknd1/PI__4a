package tn.esprit.virtual_event_management.repository;

import org.springframework.data.mongodb.repository.MongoRepository;
import tn.esprit.virtual_event_management.entity.Role;
import tn.esprit.virtual_event_management.entity.User;

import java.util.List;
import java.util.Optional;

public interface UserRepository extends MongoRepository<User, String> {
    Optional<User> findByEmail(String email);
    List<User> findByRole(Role role);
    boolean existsByEmail(String email);
}
