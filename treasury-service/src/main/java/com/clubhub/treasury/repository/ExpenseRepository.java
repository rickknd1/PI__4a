package com.clubhub.treasury.repository;
import com.clubhub.treasury.entity.Expense;
import com.clubhub.treasury.entity.Expense.ExpenseStatus;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.List;

public interface ExpenseRepository extends MongoRepository<Expense, String> {
    List<Expense> findByClubIdOrderByCreatedAtDesc(String clubId);
    List<Expense> findByClubIdAndStatus(String clubId, ExpenseStatus status);
    List<Expense> findBySubmittedByMemberIdAndClubId(String memberId, String clubId);
}
