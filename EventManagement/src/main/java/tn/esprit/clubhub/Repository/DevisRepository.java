package tn.esprit.clubhub.Repository;

import tn.esprit.clubhub.Entity.Devis;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface DevisRepository extends MongoRepository<Devis, String> {
    List<Devis> findByBorrowedItemId(String borrowedItemId);
    List<Devis> findByBorrowedItemIdAndStatus(String borrowedItemId, String status);
}
