package esprit.com.clubhub.controller;

import esprit.com.clubhub.service.PermissionService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/permissions")
public class PermissionController {

    private final PermissionService permissionService;

    public PermissionController(PermissionService permissionService) {
        this.permissionService = permissionService;
    }

    // GET /api/permissions/user/{userId} - Récupérer toutes les permissions d'un utilisateur
    @GetMapping("/user/{userId}")
    public ResponseEntity<List<String>> getUserPermissions(@PathVariable String userId) {
        return ResponseEntity.ok(permissionService.getUserPermissions(userId));
    }

    // POST /api/permissions/check - Vérifier si un utilisateur a une permission
    @PostMapping("/check")
    public ResponseEntity<Map<String, Boolean>> checkPermission(@RequestBody Map<String, String> request) {
        String userId = request.get("userId");
        String permission = request.get("permission");
        
        boolean hasPermission = permissionService.hasPermission(userId, permission);
        return ResponseEntity.ok(Map.of("hasPermission", hasPermission));
    }
}
