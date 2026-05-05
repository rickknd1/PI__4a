package com.clubhub.treasury.repository;
import com.clubhub.treasury.entity.Budget;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface BudgetRepository extends MongoRepository<Budget, String> {
    List<Budget> findByClubId(Long clubId);
    Optional<Budget> findFirstByClubIdAndPeriodStartLessThanEqualAndPeriodEndGreaterThanEqualOrderByCreatedAtDesc(Long clubId, LocalDate date1, LocalDate date2);
}
