package com.clubhub.treasury.service;

import com.clubhub.treasury.dto.request.CreateCotisationRuleRequest;
import com.clubhub.treasury.entity.CotisationRule;
import com.clubhub.treasury.entity.Payment;
import com.clubhub.treasury.exception.TreasuryException;
import com.clubhub.treasury.repository.CotisationRuleRepository;
import com.clubhub.treasury.repository.PaymentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class CotisationService {

    private final CotisationRuleRepository ruleRepository;
    private final PaymentRepository paymentRepository;
    private final AuditService auditService;

    @Transactional
    public CotisationRule createRule(Long clubId, CreateCotisationRuleRequest req, Long actorId, String actorEmail) {
        CotisationRule rule = CotisationRule.builder()
                .clubId(clubId)
                .name(req.getName())
                .amount(req.getAmount())
                .frequency(req.getFrequency())
                .startDate(req.getStartDate())
                .endDate(req.getEndDate())
                .allowExemption(req.isAllowExemption())
                .allowInstallments(req.isAllowInstallments())
                .maxInstallments(req.getMaxInstallments())
                .active(true)
                .build();
        CotisationRule saved = ruleRepository.save(rule);
        auditService.log(actorId, actorEmail, clubId, "COTISATION_RULE_CREATED", "CotisationRule", saved.getId(), null, saved.toString(), null);
        return saved;
    }

    public List<CotisationRule> getActiveRules(Long clubId) {
        return ruleRepository.findByClubIdAndActiveTrue(clubId);
    }

    @Transactional
    public List<Payment> assignToMembers(Long ruleId, List<Long> memberIds, Long clubId) {
        CotisationRule rule = ruleRepository.findById(ruleId)
                .orElseThrow(() -> new TreasuryException("Cotisation rule not found", 404));

        List<Payment> payments = new ArrayList<>();
        for (Long memberId : memberIds) {
            LocalDate dueDate = computeNextDueDate(rule);
            if (rule.isAllowInstallments() && rule.getMaxInstallments() != null) {
                for (int i = 1; i <= rule.getMaxInstallments(); i++) {
                    Payment p = Payment.builder()
                            .memberId(memberId)
                            .clubId(clubId)
                            .cotisationRule(rule)
                            .amount(rule.getAmount().divide(BigDecimal.valueOf(rule.getMaxInstallments()), 3, RoundingMode.HALF_UP))
                            .dueDate(dueDate.plusMonths(i - 1))
                            .installmentNumber(i)
                            .totalInstallments(rule.getMaxInstallments())
                            .build();
                    payments.add(paymentRepository.save(p));
                }
            } else {
                Payment p = Payment.builder()
                        .memberId(memberId)
                        .clubId(clubId)
                        .cotisationRule(rule)
                        .amount(rule.getAmount())
                        .dueDate(dueDate)
                        .build();
                payments.add(paymentRepository.save(p));
            }
        }
        return payments;
    }

    private LocalDate computeNextDueDate(CotisationRule rule) {
        LocalDate base = LocalDate.now().isAfter(rule.getStartDate()) ? LocalDate.now() : rule.getStartDate();
        return switch (rule.getFrequency()) {
            case MONTHLY -> base.withDayOfMonth(1).plusMonths(1);
            case QUARTERLY -> base.withDayOfMonth(1).plusMonths(3);
            case ANNUAL -> base.withDayOfYear(1).plusYears(1);
        };
    }
}
