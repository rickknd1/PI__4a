package com.clubhub.treasury.service;

import com.clubhub.treasury.dto.response.DashboardResponse;
import com.clubhub.treasury.dto.response.DashboardResponse.MonthlyRevenue;
import com.clubhub.treasury.dto.response.PaymentResponse;
import com.clubhub.treasury.entity.Payment;
import com.clubhub.treasury.repository.BudgetRepository;
import com.clubhub.treasury.repository.PaymentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.format.TextStyle;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class DashboardService {

    private final PaymentRepository paymentRepository;
    private final BudgetRepository budgetRepository;

    public DashboardResponse getDashboard(Long clubId) {
        BigDecimal totalCollected = Optional.ofNullable(paymentRepository.sumPaidByClubId(clubId)).orElse(BigDecimal.ZERO);
        BigDecimal totalPending = Optional.ofNullable(paymentRepository.sumPendingByClubId(clubId)).orElse(BigDecimal.ZERO);
        long membersUp = Optional.ofNullable(paymentRepository.countMembersUpToDate(clubId)).orElse(0L);
        long membersLate = Optional.ofNullable(paymentRepository.countMembersLate(clubId)).orElse(0L);

        double recoveryRate = 0;
        BigDecimal total = totalCollected.add(totalPending);
        if (total.compareTo(BigDecimal.ZERO) > 0) {
            recoveryRate = totalCollected.divide(total, 4, RoundingMode.HALF_UP)
                    .multiply(BigDecimal.valueOf(100)).doubleValue();
        }

        int budgetPct = budgetRepository
                .findByClubIdAndPeriodStartLessThanEqualAndPeriodEndGreaterThanEqual(clubId, LocalDate.now(), LocalDate.now())
                .map(b -> b.getConsumptionPercentage())
                .orElse(0);

        // Monthly revenue last 6 months
        List<MonthlyRevenue> monthly = new ArrayList<>();
        for (int i = 5; i >= 0; i--) {
            LocalDate d = LocalDate.now().minusMonths(i);
            List<Payment> payments = paymentRepository.findPaidByClubIdAndMonth(clubId, d.getMonthValue(), d.getYear());
            BigDecimal rev = payments.stream().map(Payment::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
            monthly.add(MonthlyRevenue.builder()
                    .month(d.getMonth().getDisplayName(TextStyle.SHORT, Locale.FRENCH))
                    .revenue(rev)
                    .build());
        }

        // Recent transactions (last 5)
        List<PaymentResponse> recent = paymentRepository.findByClubIdOrderByCreatedAtDesc(clubId)
                .stream().limit(5)
                .map(p -> PaymentResponse.builder()
                        .id(p.getId()).memberId(p.getMemberId()).amount(p.getAmount())
                        .status(p.getStatus()).dueDate(p.getDueDate()).paidAt(p.getPaidAt())
                        .build())
                .collect(Collectors.toList());

        return DashboardResponse.builder()
                .totalCollected(totalCollected)
                .totalPending(totalPending)
                .totalLate(BigDecimal.ZERO)
                .recoveryRate(recoveryRate)
                .membersUpToDate(membersUp)
                .membersLate(membersLate)
                .budgetConsumptionPercentage(budgetPct)
                .monthlyRevenue(monthly)
                .recentTransactions(recent)
                .build();
    }
}
