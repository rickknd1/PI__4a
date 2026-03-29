package com.clubhub.treasury.repository;
import com.clubhub.treasury.entity.Receipt;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface ReceiptRepository extends JpaRepository<Receipt, Long> {
    Optional<Receipt> findByPaymentId(Long paymentId);
    Optional<Receipt> findByReceiptNumber(String receiptNumber);
}
