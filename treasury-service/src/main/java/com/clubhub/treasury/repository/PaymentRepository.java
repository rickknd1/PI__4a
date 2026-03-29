package com.clubhub.treasury.repository;
import com.clubhub.treasury.entity.Payment;
import com.clubhub.treasury.entity.Payment.PaymentStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public interface PaymentRepository extends JpaRepository<Payment, Long> {
    List<Payment> findByClubIdAndStatus(Long clubId, PaymentStatus status);
    List<Payment> findByMemberIdAndClubId(Long memberId, Long clubId);
    List<Payment> findByStatusAndDueDateBefore(PaymentStatus status, LocalDate date);
    List<Payment> findByClubIdOrderByCreatedAtDesc(Long clubId);

    @Query("SELECT SUM(p.amount) FROM Payment p WHERE p.clubId = :clubId AND p.status = 'PAID'")
    BigDecimal sumPaidByClubId(@Param("clubId") Long clubId);

    @Query("SELECT SUM(p.amount) FROM Payment p WHERE p.clubId = :clubId AND p.status IN ('PENDING', 'LATE')")
    BigDecimal sumPendingByClubId(@Param("clubId") Long clubId);

    @Query("SELECT COUNT(DISTINCT p.memberId) FROM Payment p WHERE p.clubId = :clubId AND p.status = 'PAID'")
    Long countMembersUpToDate(@Param("clubId") Long clubId);

    @Query("SELECT COUNT(DISTINCT p.memberId) FROM Payment p WHERE p.clubId = :clubId AND p.status IN ('LATE', 'PENDING')")
    Long countMembersLate(@Param("clubId") Long clubId);

    @Query("SELECT p FROM Payment p WHERE p.clubId = :clubId AND EXTRACT(MONTH FROM p.paidAt) = :month AND EXTRACT(YEAR FROM p.paidAt) = :year AND p.status = 'PAID'")
    List<Payment> findPaidByClubIdAndMonth(@Param("clubId") Long clubId, @Param("month") int month, @Param("year") int year);
}
