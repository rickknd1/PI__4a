package com.clubhub.treasury.controller;

import com.clubhub.treasury.entity.User;
import com.clubhub.treasury.security.Roles;
import com.clubhub.treasury.service.UserContextService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/users")
@PreAuthorize(Roles.AUTHENTICATED)
public class UserController {

    private final UserContextService userContextService;

    public UserController(UserContextService userContextService) {
        this.userContextService = userContextService;
    }

    @GetMapping("/{userId}")
    public ResponseEntity<User> getUser(@PathVariable String userId) {
        return ResponseEntity.ok(userContextService.getUser(userId));
    }

    @GetMapping("/club/{clubId}")
    public ResponseEntity<List<User>> getUsersByClub(@PathVariable Long clubId) {
        return ResponseEntity.ok(userContextService.getUsersByClub(clubId));
    }

    @GetMapping("/club/{clubId}/members")
    public ResponseEntity<List<User>> getMembersByClub(@PathVariable Long clubId) {
        return ResponseEntity.ok(userContextService.getMembersByClub(clubId));
    }

    @PostMapping
    public ResponseEntity<User> createUser(@RequestBody Map<String, String> body) {
        User user = userContextService.createUser(
                body.get("email"),
                body.get("firstName"),
                body.get("lastName"),
                body.getOrDefault("role", "MEMBRE"),
                Long.parseLong(body.getOrDefault("clubId", "1"))
        );
        return ResponseEntity.status(201).body(user);
    }

    @PutMapping("/{userId}")
    public ResponseEntity<User> updateUser(@PathVariable String userId, @RequestBody Map<String, String> body) {
        return ResponseEntity.ok(userContextService.updateUser(userId,
                body.get("firstName"), body.get("lastName"), body.get("role")));
    }

    @DeleteMapping("/{userId}")
    public ResponseEntity<Void> deleteUser(@PathVariable String userId) {
        userContextService.deleteUser(userId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{userId}/permissions")
    public ResponseEntity<Map<String, Boolean>> getPermissions(@PathVariable String userId) {
        return ResponseEntity.ok(Map.of(
                "canValidateExpense", userContextService.isTresorier(userId),
                "canApproveExpense", userContextService.isPresident(userId),
                "isPresident", userContextService.isPresident(userId),
                "isTresorier", userContextService.isTresorier(userId)
        ));
    }

    @PostMapping("/mock-login")
    @PreAuthorize("permitAll()")
    public ResponseEntity<User> mockLogin(@RequestBody Map<String, String> body) {
        String email = body.getOrDefault("email", "");
        User user = userContextService.getUserByEmail(email);
        if (user == null) return ResponseEntity.status(401).build();
        return ResponseEntity.ok(user);
    }
}
