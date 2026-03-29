package com.clubhub.treasury.repository;
import com.clubhub.treasury.entity.CotisationRule;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface CotisationRuleRepository extends JpaRepository<CotisationRule, Long> {
    List<CotisationRule> findByClubIdAndActiveTrue(Long clubId);
    List<CotisationRule> findByClubId(Long clubId);
}
