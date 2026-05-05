package tn.esprit.clubhub.Repository;

import tn.esprit.clubhub.Entity.BorrowedItem;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface BorrowedItemRepository extends MongoRepository<BorrowedItem, String> {
    List<BorrowedItem> findByLenderNameContainingIgnoreCase(String lenderName);
    List<BorrowedItem> findByEventId(String eventId);
    List<BorrowedItem> findByStatus(String status);
}