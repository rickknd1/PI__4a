package com.clubhub.treasury.repository;
import com.clubhub.treasury.entity.Budget;
import org.springframework.data.jpa.repository.JpaRepository;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface BudgetRepository extends JpaRepository<Budget, Long> {
    List<Budget> findByClubId(Long clubId);
    Optional<Budget> findByClubIdAndPeriodStartLessThanEqualAndPeriodEndGreaterThanEqual(Long clubId, LocalDate date1, LocalDate date2);
}
