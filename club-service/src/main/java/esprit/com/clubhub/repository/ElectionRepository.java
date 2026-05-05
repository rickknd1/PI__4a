package esprit.com.clubhub.repository;

import esprit.com.clubhub.entity.Election;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface ElectionRepository extends MongoRepository<Election, String> {
    List<Election> findByClubId(String clubId);
    List<Election> findByStatus(String status);
    List<Election> findByClubIdAndStatus(String clubId, String status);
}