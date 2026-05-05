package esprit.com.clubhub.repository;

import esprit.com.clubhub.entity.Club;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface ClubRepository extends MongoRepository<Club, String> {
    List<Club> findByNameContainingIgnoreCase(String name);
    List<Club> findByCategory(String category);
    java.util.Optional<Club> findFirstByMembers_UserId(String userId);
}