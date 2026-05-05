
package tn.esprit.virtual_event_management.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import tn.esprit.virtual_event_management.entity.EventReview;
import tn.esprit.virtual_event_management.entity.VirtualEvent;
import tn.esprit.virtual_event_management.repository.EventReviewRepository;
import tn.esprit.virtual_event_management.repository.VirtualEventRepository;
import tn.esprit.virtual_event_management.service.ProfanityCheckService;

import java.time.LocalDateTime;
import java.util.List;

@RestController
@RequestMapping("/api/event-reviews")
@RequiredArgsConstructor
public class EventReviewController {

    private final EventReviewRepository reviewRepository;
    private final VirtualEventRepository eventRepository;
    private final ProfanityCheckService profanityCheckService;

    @PostMapping
    public ResponseEntity<?> addReview(@RequestBody ReviewRequest request) {

        if (request.rating() < 1 || request.rating() > 5) {
            return ResponseEntity.badRequest().body("Rating must be between 1 and 5");
        }

        if (request.comment() == null || request.comment().isBlank()) {
            return ResponseEntity.badRequest().body("Comment is required");
        }

        VirtualEvent event = eventRepository.findById(request.eventId())
                .orElseThrow(() -> new RuntimeException("Event not found"));

        if (!isEventFinished(event)) {
            return ResponseEntity.badRequest().body("You can review this event only after it ends");
        }

        boolean hasBadWords = profanityCheckService.containsProfanity(request.comment());

        if (hasBadWords) {
            return ResponseEntity.badRequest().body("Comment rejected: bad words detected");
        }

        EventReview review = reviewRepository
                .findByEventIdAndUserId(request.eventId(), request.userId())
                .orElse(EventReview.builder()
                        .eventId(request.eventId())
                        .userId(request.userId())
                        .createdAt(LocalDateTime.now())
                        .build());

        review.setUserName(request.userName());
        review.setRating(request.rating());
        review.setComment(request.comment());
        review.setApproved(true);
        review.setFlagged(false);
        review.setReason("Allowed");

        return ResponseEntity.ok(reviewRepository.save(review));
    }

    @GetMapping("/{eventId}")
    public ResponseEntity<List<EventReview>> getReviews(@PathVariable String eventId) {
        return ResponseEntity.ok(
                reviewRepository.findByEventIdAndApprovedTrueOrderByCreatedAtDesc(eventId)
        );
    }

    @GetMapping("/{eventId}/summary")
    public ResponseEntity<ReviewSummary> getSummary(@PathVariable String eventId) {
        List<EventReview> reviews =
                reviewRepository.findByEventIdAndApprovedTrueOrderByCreatedAtDesc(eventId);

        if (reviews.isEmpty()) {
            return ResponseEntity.ok(new ReviewSummary(0.0, 0));
        }

        double average = reviews.stream()
                .mapToInt(EventReview::getRating)
                .average()
                .orElse(0.0);

        average = Math.round(average * 10.0) / 10.0;

        return ResponseEntity.ok(new ReviewSummary(average, reviews.size()));
    }

    private boolean isEventFinished(VirtualEvent event) {
        LocalDateTime now = LocalDateTime.now();

        if (event.getEndAt() != null) {
            return now.isAfter(event.getEndAt());
        }

        if (event.getScheduledAt() == null) {
            return false;
        }

        return now.isAfter(event.getScheduledAt().plusHours(2));
    }

    public record ReviewRequest(
            String eventId,
            String userId,
            String userName,
            int rating,
            String comment
    ) {}

    public record ReviewSummary(
            double averageRating,
            long totalReviews
    ) {}
}