package esprit.com.instantvoicemanagment.repository;

import esprit.com.instantvoicemanagment.entity.Channel;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ChannelRepo extends MongoRepository<Channel, String> {
    List<Channel> findByMemberIdsContaining(String userId);
    java.util.Optional<Channel> findByNameAndCommitteeChannel(String name, boolean committeeChannel);
}