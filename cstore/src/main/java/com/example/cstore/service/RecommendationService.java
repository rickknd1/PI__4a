package com.example.cstore.service;

import com.example.cstore.entity.Product;
import com.example.cstore.repository.ProductRepository;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class RecommendationService {

    private final ProductRepository productRepository;

    public RecommendationService(ProductRepository productRepository) {
        this.productRepository = productRepository;
    }

    public List<Product> getSimilarProducts(String productId) {
        Optional<Product> currentOpt = productRepository.findById(productId);
        if (currentOpt.isEmpty()) return List.of();

        Product current = currentOpt.get();
        List<Product> allOthers = productRepository.findAll().stream()
                .filter(p -> !p.getId().equals(productId))
                .collect(Collectors.toList());

        if (allOthers.isEmpty()) return List.of();

        // Prepare current product data
        Set<String> currentWords = extractSignificantWords(current.getName() + " " + (current.getDescription() != null ? current.getDescription() : ""));
        String currentType = String.valueOf(current.getProductType());

        // Calculate scores for each other product
        Map<Product, Double> scores = new HashMap<>();
        for (Product other : allOthers) {
            String otherText = other.getName() + " " + (other.getDescription() != null ? other.getDescription() : "");
            Set<String> otherWords = extractSignificantWords(otherText);
            double wordSimilarity = jaccardSimilarity(currentWords, otherWords);
            double typeBoost = currentType.equals(other.getProductType()) ? 0.3 : 0.0;
            double total = wordSimilarity + typeBoost;
            if (total > 0.2) { // minimum similarity threshold
                scores.put(other, total);
            }
        }

        // If no good matches, fallback to products of the same type (if any)
        if (scores.isEmpty()) {
            List<Product> sameType = allOthers.stream()
                    .filter(p -> p.getProductType().equals(currentType))
                    .limit(4)
                    .collect(Collectors.toList());
            if (!sameType.isEmpty()) return sameType;
            // As last resort, return any 2 products (but this is rare)
            return allOthers.stream().limit(2).collect(Collectors.toList());
        }

        // Return top 4 matches
        return scores.entrySet().stream()
                .sorted(Map.Entry.<Product, Double>comparingByValue().reversed())
                .limit(4)
                .map(Map.Entry::getKey)
                .collect(Collectors.toList());
    }

    private Set<String> extractSignificantWords(String text) {
        if (text == null) return Set.of();
        return Arrays.stream(text.toLowerCase().split("[^a-zA-Z0-9àâçéèêëîïôûùüÿñ]+"))
                .filter(word -> word.length() > 2 && !isStopWord(word))
                .collect(Collectors.toSet());
    }

    private boolean isStopWord(String word) {
        Set<String> stopWords = Set.of(
                "les", "des", "pour", "avec", "sans", "the", "and", "for", "with", "from", "this", "that",
                "official", "authentique", "original", "nouveau", "nouvelle", "taille", "couleur"
        );
        return stopWords.contains(word);
    }

    private double jaccardSimilarity(Set<String> set1, Set<String> set2) {
        if (set1.isEmpty() && set2.isEmpty()) return 0.0;
        Set<String> intersection = new HashSet<>(set1);
        intersection.retainAll(set2);
        Set<String> union = new HashSet<>(set1);
        union.addAll(set2);
        return (double) intersection.size() / union.size();
    }
}