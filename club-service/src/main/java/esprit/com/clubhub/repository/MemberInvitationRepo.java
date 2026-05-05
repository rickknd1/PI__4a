package esprit.com.clubhub.repository;

import esprit.com.clubhub.entity.MemberInvitation;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface MemberInvitationRepo extends MongoRepository<MemberInvitation, String> {
    Optional<MemberInvitation> findByToken(String token);
    Optional<MemberInvitation> findByEmailAndClubId(String email, String clubId);
    List<MemberInvitation> findByClubId(String clubId);
    List<MemberInvitation> findByClubIdAndUsed(String clubId, boolean used);
    boolean existsByEmailAndClubIdAndUsed(String email, String clubId, boolean used);
}
