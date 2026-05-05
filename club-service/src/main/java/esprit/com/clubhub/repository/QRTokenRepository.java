package esprit.com.clubhub.repository;

import esprit.com.clubhub.entity.QRToken;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface QRTokenRepository extends MongoRepository<QRToken, String> {
    Optional<QRToken> findByToken(String token);
    Optional<QRToken> findByVotingToken(String votingToken);
    List<QRToken> findByElectionId(String electionId);
    List<QRToken> findByElectionIdAndStatus(String electionId, String status);
    Optional<QRToken> findByElectionIdAndUserId(String electionId, String userId);
    boolean existsByToken(String token);
    long countByElectionIdAndStatus(String electionId, String status);
}
