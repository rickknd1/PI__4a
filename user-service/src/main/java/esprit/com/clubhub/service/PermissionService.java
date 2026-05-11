package esprit.com.clubhub.service;

import esprit.com.clubhub.entity.CustomRole;
import esprit.com.clubhub.entity.Permission;
import esprit.com.clubhub.entity.Role;
import esprit.com.clubhub.entity.User;
import esprit.com.clubhub.repository.UserRepo;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Service
public class PermissionService {

    private final UserRepo userRepo;
    private final CustomRoleService customRoleService;
    
    @Autowired
    private RestTemplate restTemplate;
    
    private String clubServiceUrl = "http://club-service:8083/api/clubs";

    public PermissionService(UserRepo userRepo, CustomRoleService customRoleService) {
        this.userRepo = userRepo;
        this.customRoleService = customRoleService;
    }
    
    /**
     * ✅ NOUVEAU: Vérifie dynamiquement si l'utilisateur est responsable d'un comité
     * en interrogeant le Club Service
     */
    private boolean isCommitteeResponsable(String userId, String clubId) {
        try {
            System.out.println("🔍 Vérification si userId " + userId + " est responsable d'un comité dans club " + clubId);
            
            // Appeler le Club Service pour récupérer le club
            String url = clubServiceUrl + "/" + clubId;
            Map<String, Object> club = restTemplate.getForObject(url, Map.class);
            
            if (club != null && club.containsKey("subGroups")) {
                List<Map<String, Object>> subGroups = (List<Map<String, Object>>) club.get("subGroups");
                
                // Vérifier si userId est responsableId d'un des comités
                for (Map<String, Object> subGroup : subGroups) {
                    String responsableId = (String) subGroup.get("responsableId");
                    if (userId.equals(responsableId)) {
                        String subGroupName = (String) subGroup.get("name");
                        System.out.println("✅ Utilisateur est responsable du comité: " + subGroupName);
                        return true;
                    }
                }
            }
            
            System.out.println("❌ Utilisateur n'est responsable d'aucun comité");
            return false;
        } catch (Exception e) {
            System.err.println("❌ Erreur lors de la vérification du statut de responsable: " + e.getMessage());
            return false;
        }
    }

    /**
     * Récupère toutes les permissions d'un utilisateur (système + personnalisées)
     * ✅ MODIFIÉ: Détection dynamique du statut de responsable de comité
     */
    public List<String> getUserPermissions(String userId) {
        User user = userRepo.findById(userId)
                .orElseThrow(() -> new RuntimeException("Utilisateur introuvable"));

        System.out.println("=== DEBUG PERMISSIONS ===");
        System.out.println("User ID: " + userId);
        System.out.println("User role: " + user.getRole());
        System.out.println("User clubId: " + user.getClubId());
        System.out.println("User customRoleId: " + user.getCustomRoleId());
        System.out.println("Is system role: " + user.isSystemRole());

        List<String> permissions = new ArrayList<>();

        // 1. Rôle système (PRESIDENT, RH, etc.)
        if (user.isSystemRole()) {
            System.out.println("✅ Rôle système: " + user.getSystemRole());
            permissions.addAll(getSystemRolePermissions(user.getSystemRole()));
        }

        // 2. Responsable de comité détecté dynamiquement (s'ajoute aux autres permissions)
        if (user.getClubId() != null && !user.getClubId().isEmpty()) {
            boolean isResponsable = isCommitteeResponsable(userId, user.getClubId());
            if (isResponsable) {
                System.out.println("✅ Responsable de comité détecté dynamiquement");
                permissions.addAll(getCommitteeResponsablePermissions());
            }
        }

        // 3. Rôle personnalisé (customRoleId) — toujours vérifié, jamais court-circuité
        if (user.getCustomRoleId() != null && !user.getCustomRoleId().isEmpty()) {
            System.out.println("✅ CustomRoleId: " + user.getCustomRoleId());
            try {
                CustomRole customRole = customRoleService.getRoleById(user.getCustomRoleId());
                if (customRole.isActive()) {
                    permissions.addAll(customRole.getPermissions());
                    System.out.println("✅ Permissions personnalisées ajoutées: " + customRole.getPermissions());
                } else {
                    System.out.println("❌ Rôle personnalisé inactif");
                }
            } catch (Exception e) {
                System.out.println("❌ Erreur récupération rôle personnalisé: " + e.getMessage());
            }
        }

        // Dédupliquer
        List<String> deduplicated = permissions.stream().distinct().collect(java.util.stream.Collectors.toList());
        System.out.println("📋 Permissions finales: " + deduplicated);
        System.out.println("========================");

        return deduplicated;
    }

    /**
     * Vérifie si un utilisateur a une permission spécifique
     */
    public boolean hasPermission(String userId, String permission) {
        List<String> userPermissions = getUserPermissions(userId);
        return userPermissions.contains(permission);
    }

    /**
     * Vérifie si un utilisateur a au moins une des permissions données
     */
    public boolean hasAnyPermission(String userId, String... permissions) {
        List<String> userPermissions = getUserPermissions(userId);
        for (String permission : permissions) {
            if (userPermissions.contains(permission)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Vérifie si un utilisateur a toutes les permissions données
     */
    public boolean hasAllPermissions(String userId, String... permissions) {
        List<String> userPermissions = getUserPermissions(userId);
        for (String permission : permissions) {
            if (!userPermissions.contains(permission)) {
                return false;
            }
        }
        return true;
    }

    /**
     * Permissions par défaut pour les rôles système
     */
    private List<String> getSystemRolePermissions(Role role) {
        List<String> permissions = new ArrayList<>();
        
        switch (role) {
            case PRESIDENT:
                // Le président a TOUTES les permissions
                for (Permission p : Permission.values()) {
                    permissions.add(p.name());
                }
                break;
                
            case VICE_PRESIDENT:
                permissions.add("VIEW_MEMBERS");
                permissions.add("ADD_MEMBERS");
                permissions.add("EDIT_MEMBERS");
                permissions.add("VIEW_SUBGROUPS");
                permissions.add("CREATE_SUBGROUPS");
                permissions.add("VIEW_ELECTIONS");
                permissions.add("CREATE_ELECTIONS");
                permissions.add("VIEW_EVENTS");
                permissions.add("CREATE_EVENTS");
                permissions.add("VIEW_CLUB_INFO");
                break;
                
            case SECRETAIRE_GENERALE:
                permissions.add("VIEW_MEMBERS");
                permissions.add("ADD_MEMBERS");
                permissions.add("EDIT_MEMBERS");
                permissions.add("APPROVE_MEMBERS");
                permissions.add("VIEW_SUBGROUPS");
                permissions.add("VIEW_ELECTIONS");
                permissions.add("VIEW_EVENTS");
                permissions.add("VIEW_CLUB_INFO");
                permissions.add("VIEW_REPORTS");
                permissions.add("CREATE_REPORTS");
                break;
                
            case TRESORIER:
                permissions.add("VIEW_MEMBERS");
                permissions.add("VIEW_CLUB_INFO");
                permissions.add("VIEW_EVENTS");
                permissions.add("VIEW_REPORTS");
                permissions.add("CREATE_REPORTS");
                permissions.add("VIEW_ANALYTICS");
                break;
                
            case RH:
                permissions.add("VIEW_MEMBERS");
                permissions.add("ADD_MEMBERS");
                permissions.add("EDIT_MEMBERS");
                permissions.add("DELETE_MEMBERS");
                permissions.add("APPROVE_MEMBERS");
                permissions.add("VIEW_SUBGROUPS");
                permissions.add("ASSIGN_TO_SUBGROUPS");
                break;
                
            case MEMBRE_SIMPLE:
                permissions.add("VIEW_MEMBERS");
                permissions.add("VIEW_SUBGROUPS");
                permissions.add("VIEW_ELECTIONS");
                permissions.add("VOTE_ELECTIONS");
                permissions.add("VIEW_EVENTS");
                permissions.add("VIEW_CLUB_INFO");
                permissions.add("JOIN_VOICE_CHANNELS");
                break;
        }
        
        return permissions;
    }

    /**
     * ✅ Permissions pour les responsables de comité
     * Un responsable de comité peut UNIQUEMENT:
     * - Assigner des membres à SON comité
     * - Retirer des membres de SON comité (pas supprimer du club)
     */
    private List<String> getCommitteeResponsablePermissions() {
        List<String> permissions = new ArrayList<>();
        
        // Permissions de base (comme un membre simple)
        permissions.add("VIEW_MEMBERS");
        permissions.add("VIEW_SUBGROUPS");
        permissions.add("VIEW_ELECTIONS");
        permissions.add("VOTE_ELECTIONS");
        permissions.add("VIEW_EVENTS");
        permissions.add("VIEW_CLUB_INFO");
        permissions.add("JOIN_VOICE_CHANNELS");
        
        // ✅ Permission spéciale: UNIQUEMENT assigner/retirer des membres de son comité
        permissions.add("ASSIGN_TO_SUBGROUPS");   // Assigner des membres à son comité
        
        System.out.println("📋 Permissions responsable de comité: " + permissions);
        
        return permissions;
    }
}
