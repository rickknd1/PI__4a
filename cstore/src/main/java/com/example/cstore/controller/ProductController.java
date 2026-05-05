package com.example.cstore.controller;

import com.example.cstore.entity.Product;
import com.example.cstore.service.ProductService;
import com.example.cstore.service.RecommendationService;
import com.example.cstore.service.AiPdfExtractorService;
import com.example.cstore.service.AiProductExtractorService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/products")
@RequiredArgsConstructor
public class ProductController {
    private final ProductService productService;
    private final RecommendationService recommendationService;
    private final AiPdfExtractorService aiPdfExtractorService;
    private final AiProductExtractorService aiProductExtractorService;

    @GetMapping
    public List<Product> getAllProducts() {
        return productService.getAllProducts();
    }

    @GetMapping("/{id}")
    public Product getProductById(@PathVariable String id) {
        return productService.getProductById(id);
    }

    @GetMapping("/type/{type}")
    public List<Product> getProductsByType(@PathVariable Product.ProductType type) {
        return productService.getProductsByType(type);
    }

    @GetMapping("/available")
    public List<Product> getAvailableProducts() {
        return productService.getAvailableProducts();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Product createProduct(@Valid @RequestBody Product product) {
        return productService.createProduct(product);
    }

    @PutMapping("/{id}")
    public Product updateProduct(@PathVariable String id, @Valid @RequestBody Product product) {
        return productService.updateProduct(id, product);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteProduct(@PathVariable String id) {
        productService.deleteProduct(id);
    }

    // ========== RECOMMENDATION ENDPOINT ==========
    @GetMapping("/{productId}/recommendations")
    public ResponseEntity<List<Product>> getRecommendations(@PathVariable String productId) {
        List<Product> recommendations = recommendationService.getSimilarProducts(productId);
        return ResponseEntity.ok(recommendations);
    }

    // ========== NEXT UPCOMING EVENT ENDPOINT ==========
    @GetMapping("/next-event")
    public ResponseEntity<Product> getNextUpcomingEvent() {
        Product nextEvent = productService.getNextUpcomingEvent();
        return ResponseEntity.ok(nextEvent);
    }

    // ========== AI PDF EXTRACTION ENDPOINT ==========
    @PostMapping("/extract-from-pdf")
    public ResponseEntity<Map<String, Object>> extractFromPdf(
            @RequestParam("file") MultipartFile file,
            @RequestParam("type") String type) throws Exception {

        String pdfText = aiPdfExtractorService.extractText(file);
        boolean isTicket = "TICKET".equals(type);
        Map<String, Object> extracted = aiProductExtractorService.extractFromPdf(pdfText, isTicket);
        return ResponseEntity.ok(extracted);
    }
}