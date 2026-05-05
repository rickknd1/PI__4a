package esprit.com.clubhub.repository;

import esprit.com.clubhub.entity.User;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.List;
import java.util.Optional;

public interface UserRepo extends MongoRepository<User, String> {
    Optional<User> findByEmail(String email);
    boolean existsByEmail(String email);
    List<User> findByRole(String role);  // ✅ Changé de Role enum à String
    List<User> findByClubId(String clubId);
}