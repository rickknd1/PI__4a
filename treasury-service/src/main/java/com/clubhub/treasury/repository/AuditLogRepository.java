package com.clubhub.treasury.repository;
import com.clubhub.treasury.entity.AuditLog;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.List;

public interface AuditLogRepository extends MongoRepository<AuditLog, String> {
    List<AuditLog> findByClubIdOrderByTimestampDesc(Long clubId);
    List<AuditLog> findByEntityTypeAndEntityId(String entityType, String entityId);
}
