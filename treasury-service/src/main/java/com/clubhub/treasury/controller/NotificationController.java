package com.clubhub.treasury.controller;

import com.clubhub.treasury.entity.Notification;
import com.clubhub.treasury.security.Roles;
import com.clubhub.treasury.service.NotificationService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/treasury/{clubId}/notifications")
@PreAuthorize(Roles.AUTHENTICATED)
public class NotificationController {

    private final NotificationService notificationService;

    public NotificationController(NotificationService notificationService) {
        this.notificationService = notificationService;
    }

    @GetMapping
    @PreAuthorize(Roles.READ_REPORTS)
    public ResponseEntity<List<Notification>> getByClub(@PathVariable Long clubId) {
        return ResponseEntity.ok(notificationService.getByClub(clubId));
    }

    @GetMapping("/user/{userId}")
    public ResponseEntity<List<Notification>> getByUser(@PathVariable Long clubId, @PathVariable String userId) {
        return ResponseEntity.ok(notificationService.getByUser(userId));
    }

    @GetMapping("/user/{userId}/unread")
    public ResponseEntity<List<Notification>> getUnread(@PathVariable Long clubId, @PathVariable String userId) {
        return ResponseEntity.ok(notificationService.getUnread(userId));
    }

    @GetMapping("/user/{userId}/count")
    public ResponseEntity<Map<String, Long>> countUnread(@PathVariable Long clubId, @PathVariable String userId) {
        return ResponseEntity.ok(Map.of("unread", notificationService.countUnread(userId)));
    }

    @PatchMapping("/{notificationId}/read")
    public ResponseEntity<Void> markAsRead(@PathVariable Long clubId, @PathVariable String notificationId) {
        notificationService.markAsRead(notificationId);
        return ResponseEntity.ok().build();
    }

    @PatchMapping("/user/{userId}/read-all")
    public ResponseEntity<Void> markAllAsRead(@PathVariable Long clubId, @PathVariable String userId) {
        notificationService.markAllAsRead(userId);
        return ResponseEntity.ok().build();
    }
}
