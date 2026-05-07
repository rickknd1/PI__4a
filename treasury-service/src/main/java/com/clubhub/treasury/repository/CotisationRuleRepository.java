package com.clubhub.treasury.repository;
import com.clubhub.treasury.entity.CotisationRule;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.List;

public interface CotisationRuleRepository extends MongoRepository<CotisationRule, String> {
    List<CotisationRule> findByClubIdAndActiveTrue(String clubId);
    List<CotisationRule> findByClubId(String clubId);
}
