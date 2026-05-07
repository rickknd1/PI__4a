package com.clubhub.treasury.repository;

import com.clubhub.treasury.entity.Notification;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.List;

public interface NotificationRepository extends MongoRepository<Notification, String> {
    List<Notification> findByRecipientIdOrderByCreatedAtDesc(String recipientId);
    List<Notification> findByClubIdOrderByCreatedAtDesc(String clubId);
    List<Notification> findByRecipientIdAndReadFalseOrderByCreatedAtDesc(String recipientId);
    long countByRecipientIdAndReadFalse(String recipientId);
}
