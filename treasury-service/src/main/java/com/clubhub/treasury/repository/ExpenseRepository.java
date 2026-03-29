package com.clubhub.treasury.repository;
import com.clubhub.treasury.entity.Expense;
import com.clubhub.treasury.entity.Expense.ExpenseStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.math.BigDecimal;
import java.util.List;

public interface ExpenseRepository extends JpaRepository<Expense, Long> {
    List<Expense> findByClubIdOrderByCreatedAtDesc(Long clubId);
    List<Expense> findByClubIdAndStatus(Long clubId, ExpenseStatus status);
    List<Expense> findBySubmittedByMemberIdAndClubId(Long memberId, Long clubId);

    @Query("SELECT SUM(e.amount) FROM Expense e WHERE e.clubId = :clubId AND e.status = 'APPROVED'")
    BigDecimal sumApprovedByClubId(@Param("clubId") Long clubId);
}
