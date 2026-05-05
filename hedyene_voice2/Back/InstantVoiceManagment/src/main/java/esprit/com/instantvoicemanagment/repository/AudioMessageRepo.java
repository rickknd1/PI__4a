package esprit.com.instantvoicemanagment.repository;

import esprit.com.instantvoicemanagment.entity.AudioMessage;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AudioMessageRepo extends MongoRepository<AudioMessage, String> {
    List<AudioMessage> findByChannelIdOrderByCreatedAtDesc(String channelId);

    @Query("{ $or: [ { 'aiModerated': false }, { 'aiModerated': { $exists: false } } ] }")
    List<AudioMessage> findUnmoderated();
}
