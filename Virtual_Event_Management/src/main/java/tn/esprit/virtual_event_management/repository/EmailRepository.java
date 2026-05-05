package tn.esprit.virtual_event_management.repository;

import org.springframework.data.mongodb.repository.MongoRepository;
import tn.esprit.virtual_event_management.entity.Email;

public interface EmailRepository extends MongoRepository<Email, String> {
}
