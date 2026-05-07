package com.clubhub.treasury.repository;
import com.clubhub.treasury.entity.Payment;
import com.clubhub.treasury.entity.Payment.PaymentStatus;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.time.LocalDate;
import java.util.List;

public interface PaymentRepository extends MongoRepository<Payment, String> {
    List<Payment> findByClubIdAndStatus(String clubId, PaymentStatus status);
    List<Payment> findByMemberIdAndClubId(String memberId, String clubId);
    List<Payment> findByStatusAndDueDateBefore(PaymentStatus status, LocalDate date);
    List<Payment> findByClubIdOrderByCreatedAtDesc(String clubId);
}
