package esprit.com.clubhub.repository;
import esprit.com.clubhub.entity.Club;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface ClubRepo extends MongoRepository<Club, String> {}