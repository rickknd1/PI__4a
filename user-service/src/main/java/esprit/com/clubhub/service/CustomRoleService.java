package esprit.com.clubhub.service;

import esprit.com.clubhub.entity.CustomRole;
import esprit.com.clubhub.entity.Permission;
import esprit.com.clubhub.repository.CustomRoleRepo;
import org.springframework.stereotype.Service;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class CustomRoleService {

    private final CustomRoleRepo customRoleRepo;

    public CustomRoleService(CustomRoleRepo customRoleRepo) {
        this.customRoleRepo = customRoleRepo;
    }

    // Récupérer toutes les permissions disponibles
    public List<PermissionDTO> getAllPermissions() {
        return Arrays.stream(Permission.values())
                .map(p -> new PermissionDTO(p.name(), p.getDescription()))
                .collect(Collectors.toList());
    }

    // Créer un rôle personnalisé
    public CustomRole createRole(CustomRole role) {
        // Vérifier si le rôle existe déjà pour ce club
        if (customRoleRepo.findByClubIdAndRoleName(role.getClubId(), role.getRoleName()).isPresent()) {
            throw new RuntimeException("Un rôle avec ce nom existe déjà pour ce club");
        }
        return customRoleRepo.save(role);
    }

    // Récupérer tous les rôles d'un club
    public List<CustomRole> getRolesByClub(String clubId) {
        return customRoleRepo.findByClubId(clubId);
    }

    // Récupérer un rôle par ID
    public CustomRole getRoleById(String id) {
        return customRoleRepo.findById(id)
                .orElseThrow(() -> new RuntimeException("Rôle introuvable"));
    }

    // Mettre à jour un rôle
    public CustomRole updateRole(String id, CustomRole updated) {
        CustomRole existing = getRoleById(id);
        existing.setRoleName(updated.getRoleName());
        existing.setDescription(updated.getDescription());
        existing.setPermissions(updated.getPermissions());
        existing.setActive(updated.isActive());
        return customRoleRepo.save(existing);
    }

    // Supprimer un rôle
    public void deleteRole(String id) {
        customRoleRepo.deleteById(id);
    }

    // Vérifier si un utilisateur a une permission
    public boolean hasPermission(String roleId, String permission) {
        CustomRole role = getRoleById(roleId);
        return role.getPermissions().contains(permission);
    }

    // DTO pour les permissions
    public static class PermissionDTO {
        private String code;
        private String description;

        public PermissionDTO(String code, String description) {
            this.code = code;
            this.description = description;
        }

        public String getCode() { return code; }
        public void setCode(String code) { this.code = code; }
        public String getDescription() { return description; }
        public void setDescription(String description) { this.description = description; }
    }
}
