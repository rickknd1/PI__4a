package com.clubhub.treasury.repository;
import com.clubhub.treasury.entity.Receipt;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.Optional;

public interface ReceiptRepository extends MongoRepository<Receipt, String> {
    Optional<Receipt> findByPaymentId(String paymentId);
    Optional<Receipt> findByReceiptNumber(String receiptNumber);
}
