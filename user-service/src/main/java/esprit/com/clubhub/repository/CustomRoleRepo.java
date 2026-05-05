package esprit.com.clubhub.repository;

import esprit.com.clubhub.entity.CustomRole;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface CustomRoleRepo extends MongoRepository<CustomRole, String> {
    List<CustomRole> findByClubId(String clubId);
    Optional<CustomRole> findByClubIdAndRoleName(String clubId, String roleName);
    List<CustomRole> findByClubIdAndIsActive(String clubId, boolean isActive);
}
