package com.clubhub.treasury.repository;

import com.clubhub.treasury.entity.User;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.List;
import java.util.Optional;

public interface UserRepository extends MongoRepository<User, String> {
    List<User> findByClubId(String clubId);
    Optional<User> findByEmail(String email);
    List<User> findByClubIdAndRole(String clubId, User.UserRole role);
}
