package esprit.com.clubhub.controller;

import esprit.com.clubhub.entity.CustomRole;
import esprit.com.clubhub.service.CustomRoleService;
import esprit.com.clubhub.service.PermissionService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/roles")
public class CustomRoleController {

    private final CustomRoleService customRoleService;
    private final PermissionService permissionService;

    public CustomRoleController(CustomRoleService customRoleService, PermissionService permissionService) {
        this.customRoleService = customRoleService;
        this.permissionService = permissionService;
    }

    // GET /api/roles/permissions - Liste toutes les permissions disponibles
    @GetMapping("/permissions")
    public ResponseEntity<List<CustomRoleService.PermissionDTO>> getAllPermissions() {
        return ResponseEntity.ok(customRoleService.getAllPermissions());
    }

    // POST /api/roles - Créer un nouveau rôle personnalisé
    @PostMapping
    public ResponseEntity<?> createRole(@RequestBody CustomRole role) {
        try {
            CustomRole created = customRoleService.createRole(role);
            return ResponseEntity.ok(created);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    // GET /api/roles/club/{clubId} - Récupérer tous les rôles d'un club
    @GetMapping("/club/{clubId}")
    public ResponseEntity<List<CustomRole>> getRolesByClub(@PathVariable String clubId) {
        return ResponseEntity.ok(customRoleService.getRolesByClub(clubId));
    }

    // GET /api/roles/{id} - Récupérer un rôle par ID
    @GetMapping("/{id}")
    public ResponseEntity<CustomRole> getRoleById(@PathVariable String id) {
        return ResponseEntity.ok(customRoleService.getRoleById(id));
    }

    // PUT /api/roles/{id} - Mettre à jour un rôle
    @PutMapping("/{id}")
    public ResponseEntity<CustomRole> updateRole(@PathVariable String id, @RequestBody CustomRole role) {
        return ResponseEntity.ok(customRoleService.updateRole(id, role));
    }

    // DELETE /api/roles/{id} - Supprimer un rôle
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteRole(@PathVariable String id) {
        customRoleService.deleteRole(id);
        return ResponseEntity.noContent().build();
    }

    // GET /api/roles/club/{clubId}/users/{userId}/permissions
    // Endpoint appelé par le frontend PermissionService pour charger les permissions
    @GetMapping("/club/{clubId}/users/{userId}/permissions")
    public ResponseEntity<List<String>> getUserPermissions(
            @PathVariable String clubId,
            @PathVariable String userId) {
        return ResponseEntity.ok(permissionService.getUserPermissions(userId));
    }
}
