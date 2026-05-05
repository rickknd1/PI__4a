package com.example.cstore.repository;

import com.example.cstore.entity.Product;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.List;

public interface ProductRepository extends MongoRepository<Product, String> {
    List<Product> findByClubId(String clubId);
    List<Product> findByProductType(Product.ProductType productType);
    List<Product> findByIsAvailableTrue();
}
