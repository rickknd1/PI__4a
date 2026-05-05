package com.example.cstore.repository;

import com.example.cstore.entity.Order;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.List;
import java.util.Optional;

public interface OrderRepository extends MongoRepository<Order, String> {
    List<Order> findByMemberId(String memberId);
    Optional<Order> findByOrderNumber(String orderNumber);
}