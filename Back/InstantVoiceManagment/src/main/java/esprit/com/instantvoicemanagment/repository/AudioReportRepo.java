package esprit.com.instantvoicemanagment.repository;

import esprit.com.instantvoicemanagment.entity.AudioReport;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AudioReportRepo extends MongoRepository<AudioReport, String> {
    List<AudioReport> findAllByOrderByCreatedAtDesc();
    List<AudioReport> findByStatusOrderByCreatedAtDesc(String status);
    List<AudioReport> findByReportedByUserIdOrderByCreatedAtDesc(String reportedByUserId);
}
