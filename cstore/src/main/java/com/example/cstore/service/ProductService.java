package com.example.cstore.service;

import com.example.cstore.entity.Product;
import com.example.cstore.repository.ProductRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Comparator;

@Service
@RequiredArgsConstructor
public class ProductService {
    private final ProductRepository productRepository;

    public List<Product> getAllProducts() {
        return productRepository.findAll();
    }

    public Product getProductById(String id) {
        return productRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Produit non trouvé avec l'id: " + id));
    }

    public List<Product> getProductsByType(Product.ProductType type) {
        return productRepository.findByProductType(type);
    }

    public List<Product> getAvailableProducts() {
        return productRepository.findByIsAvailableTrue();
    }

    public Product createProduct(Product product) {
        product.setCreatedAt(LocalDateTime.now());
        product.setUpdatedAt(LocalDateTime.now());

        // Initialisation des valeurs par défaut
        if (product.getIsAvailable() == null) {
            product.setIsAvailable(true);
        }

        if (product.getStockQuantity() == null) {
            product.setStockQuantity(0);
        }

        // Pour les billets, initialiser totalTickets et availableTickets
        if (product.getProductType() == Product.ProductType.EVENT_TICKET) {
            if (product.getTotalTickets() == null) {
                product.setTotalTickets(product.getStockQuantity());
            }
            if (product.getAvailableTickets() == null) {
                product.setAvailableTickets(product.getTotalTickets());
            }
        } else {
            // Pour les non-tickets, initialiser à 0 pour éviter les nulls
            if (product.getTotalTickets() == null) {
                product.setTotalTickets(0);
            }
            if (product.getAvailableTickets() == null) {
                product.setAvailableTickets(0);
            }
        }

        return productRepository.save(product);
    }

    public Product updateProduct(String id, Product productDetails) {
        Product product = getProductById(id);
        product.setName(productDetails.getName());
        product.setDescription(productDetails.getDescription());
        product.setPrice(productDetails.getPrice());
        product.setStockQuantity(productDetails.getStockQuantity());
        product.setImageUrl(productDetails.getImageUrl());
        product.setIsAvailable(productDetails.getIsAvailable());
        product.setUpdatedAt(LocalDateTime.now());

        if (productDetails.getProductType() == Product.ProductType.EVENT_TICKET) {
            product.setEventName(productDetails.getEventName());
            product.setEventDate(productDetails.getEventDate());
            product.setVenue(productDetails.getVenue());
            if (productDetails.getTotalTickets() != null) {
                product.setTotalTickets(productDetails.getTotalTickets());
            }
            if (productDetails.getAvailableTickets() != null) {
                product.setAvailableTickets(productDetails.getAvailableTickets());
            }
        } else {
            // Pour les non-tickets, s'assurer que ces champs ne sont pas null
            if (product.getTotalTickets() == null) {
                product.setTotalTickets(0);
            }
            if (product.getAvailableTickets() == null) {
                product.setAvailableTickets(0);
            }
        }

        return productRepository.save(product);
    }

    public void deleteProduct(String id) {
        productRepository.deleteById(id);
    }

    public void updateStock(String productId, int quantity) {
        Product product = getProductById(productId);

        // Initialiser stock si null
        Integer currentStock = product.getStockQuantity();
        if (currentStock == null) {
            currentStock = 0;
            product.setStockQuantity(0);
        }

        int newStock = currentStock - quantity;
        if (newStock < 0) {
            throw new RuntimeException("Stock insuffisant pour: " + product.getName());
        }
        product.setStockQuantity(newStock);
        if (newStock == 0) {
            product.setIsAvailable(false);
        }
        productRepository.save(product);
    }

    public void updateAvailableTickets(String productId, int quantity) {
        Product product = getProductById(productId);

        if (product.getProductType() != Product.ProductType.EVENT_TICKET) {
            // Pour les non-tickets, ne rien faire (pas d'erreur)
            return;
        }

        // Initialiser availableTickets si null
        Integer available = product.getAvailableTickets();
        if (available == null) {
            available = product.getTotalTickets();
            if (available == null) {
                available = product.getStockQuantity();
            }
            if (available == null) {
                available = 0;
            }
            product.setAvailableTickets(available);
        }

        int newAvailable = available - quantity;
        if (newAvailable < 0) {
            throw new RuntimeException("Plus assez de places disponibles pour: " + product.getName());
        }
        product.setAvailableTickets(newAvailable);
        productRepository.save(product);
    }

    // NEW METHOD: Get next upcoming event (ticket with future date)
    public Product getNextUpcomingEvent() {
        List<Product> allTickets = productRepository.findByProductType(Product.ProductType.EVENT_TICKET);
        LocalDateTime now = LocalDateTime.now();
        return allTickets.stream()
                .filter(ticket -> ticket.getEventDate() != null && ticket.getEventDate().isAfter(now))
                .min(Comparator.comparing(Product::getEventDate))
                .orElse(null);
    }
}