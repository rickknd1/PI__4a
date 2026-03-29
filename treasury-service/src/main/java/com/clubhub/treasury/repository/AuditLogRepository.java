package com.clubhub.treasury.repository;
import com.clubhub.treasury.entity.AuditLog;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface AuditLogRepository extends JpaRepository<AuditLog, Long> {
    List<AuditLog> findByClubIdOrderByTimestampDesc(Long clubId);
    List<AuditLog> findByEntityTypeAndEntityId(String entityType, Long entityId);
}
