package tn.esprit.clubhub.Repository;

import tn.esprit.clubhub.Entity.Lender;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface LenderRepository extends MongoRepository<Lender, String> {

    List<Lender> findByNameContainingIgnoreCase(String name);

    List<Lender> findByIsActiveTrueOrderByTotalBorrowsDesc();

    // FIX: used in LenderController.getLenderDetails for persisted reliability badge
    Optional<Lender> findByName(String name);
}
