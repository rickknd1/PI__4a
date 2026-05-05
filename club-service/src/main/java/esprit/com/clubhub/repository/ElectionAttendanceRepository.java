package esprit.com.clubhub.repository;

import esprit.com.clubhub.entity.ElectionAttendance;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ElectionAttendanceRepository extends MongoRepository<ElectionAttendance, String> {
    List<ElectionAttendance> findByElectionId(String electionId);
    Optional<ElectionAttendance> findByElectionIdAndUserId(String electionId, String userId);
    Optional<ElectionAttendance> findByVotingToken(String votingToken);
    boolean existsByElectionIdAndUserId(String electionId, String userId);
    long countByElectionId(String electionId);
    long countByElectionIdAndHasVoted(String electionId, boolean hasVoted);
}
