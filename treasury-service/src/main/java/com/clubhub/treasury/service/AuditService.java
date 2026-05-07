package com.clubhub.treasury.service;

import com.clubhub.treasury.entity.AuditLog;
import com.clubhub.treasury.entity.AuditLog.ActionType;
import com.clubhub.treasury.repository.AuditLogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.List;

@Service
@RequiredArgsConstructor
public class AuditService {

    private final AuditLogRepository auditLogRepository;

    public void log(String actorId, String actorEmail, String clubId, String action,
                    String entityType, String entityId, String before, String after, BigDecimal amount) {
        AuditLog log = AuditLog.builder()
                .actorId(actorId)
                .actorEmail(actorEmail)
                .clubId(clubId)
                .action(ActionType.valueOf(action))
                .entityType(entityType)
                .entityId(entityId)
                .valuesBefore(before)
                .valuesAfter(after)
                .amount(amount)
                .build();
        auditLogRepository.save(log);
    }

    public List<AuditLog> getByClub(String clubId) {
        return auditLogRepository.findByClubIdOrderByTimestampDesc(clubId);
    }
}
