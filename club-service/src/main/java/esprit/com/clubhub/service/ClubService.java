package esprit.com.clubhub.service;

import esprit.com.clubhub.dto.UserDto;
import esprit.com.clubhub.entity.Club;
import esprit.com.clubhub.entity.ClubRules;
import esprit.com.clubhub.entity.Member;
import esprit.com.clubhub.entity.SubGroup;
import esprit.com.clubhub.entity.*;
import esprit.com.clubhub.dto.SubGroupRecommendation;
import esprit.com.clubhub.repository.ClubRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.util.ArrayList;
import java.time.LocalDateTime;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

@Service
public class ClubService {

    @Autowired
    private ClubRepository clubRepository;
    
    @Autowired
    private RestTemplate restTemplate;
    
    private String userServiceUrl = "http://user-service:8081/api/users";  // ✅ Corrigé: ajout de /api
    @Value("${voice.service.channels-url:http://voice-service:8082/api/channels}")
    private String voiceChannelsUrl;
    private static final Set<String> BUREAU_ROLES = Set.of(
            "BUREAU",
            "SUPER_ADMIN",
            "PRESIDENT",
            "VICE_PRESIDENT",
            "RH",
            "SECRETAIRE_GENERALE",
            "SECRETAIRE_GENERAL",
            "TRESORIER",
            "TREASURER"
    );
    
    public UserDto getUserById(String userId) {
        try {
            return restTemplate.getForObject(userServiceUrl + "/" + userId, UserDto.class);
        } catch (Exception e) {
            System.err.println("Erreur appel User Service: " + e.getMessage());
            return null;
        }
    }

    // ========== CRUD DE BASE ==========

    public Club createClub(Club club) {
        // Initialisation par défaut
        if (club.getMembers() == null) {
            club.setMembers(new java.util.ArrayList<>());
        }
        if (club.getSubGroups() == null) {
            club.setSubGroups(new java.util.ArrayList<>());
        }
        if (club.getRules() == null) {
            club.setRules(new ClubRules());
        }
        return clubRepository.save(club);
    }

    public List<Club> getAllClubs() {
        return clubRepository.findAll();
    }

    public Optional<Club> getClubById(String id) {
        return clubRepository.findById(id);
    }

    public Club updateClub(String id, Club clubDetails) {
        Club club = clubRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Club non trouvé"));

        System.out.println("=== UPDATE CLUB ===");
        System.out.println("Members reçus: " + (clubDetails.getMembers() != null ? clubDetails.getMembers().size() : "null"));
        System.out.println("Members existants: " + club.getMembers().size());

        // Mise à jour des champs simples
        if (clubDetails.getName() != null) club.setName(clubDetails.getName());
        if (clubDetails.getDescription() != null) club.setDescription(clubDetails.getDescription());
        if (clubDetails.getCategory() != null) club.setCategory(clubDetails.getCategory());
        if (clubDetails.getVisibility() != null) club.setVisibility(clubDetails.getVisibility());
        if (clubDetails.getLogoUrl() != null) club.setLogoUrl(clubDetails.getLogoUrl());
        if (clubDetails.getColorPalette() != null) club.setColorPalette(clubDetails.getColorPalette());
        if (clubDetails.getRules() != null) club.setRules(clubDetails.getRules());

        // ⚠️ NE PAS toucher aux membres et sous-groupes si non fournis
        // On garde ceux qui existent déjà
        if (clubDetails.getMembers() != null && !clubDetails.getMembers().isEmpty()) {
            System.out.println("⚠️ ATTENTION: Remplacement des membres!");
            club.setMembers(clubDetails.getMembers());
        } else {
            System.out.println("✅ Conservation des membres existants: " + club.getMembers().size());
        }

        if (clubDetails.getSubGroups() != null && !clubDetails.getSubGroups().isEmpty()) {
            club.setSubGroups(clubDetails.getSubGroups());
        } else {
            System.out.println("✅ Conservation des sous-groupes existants: " + club.getSubGroups().size());
        }

        return clubRepository.save(club);
    }

    public void deleteClub(String id) {
        clubRepository.deleteById(id);
    }

    // ========== GESTION DES MEMBRES ==========

    public Club addMemberRequest(String clubId, Member member) {
        Club club = clubRepository.findById(clubId)
                .orElseThrow(() -> new RuntimeException("Club non trouvé"));
        System.out.println("=== ADD MEMBER ===");
        System.out.println("Membre reçu complet: " + member.toString());  // ← AJOUTER
        System.out.println("Status reçu: " + member.getStatus());  // ← AJOUTER
        System.out.println("Role reçu: " + member.getRole());

        boolean exists = club.getMembers().stream()
                .anyMatch(m -> m.getUserId().equals(member.getUserId()));

        if (!exists) {
            // ✅ Respecter le status envoyé, sinon PENDING par défaut
            if (member.getStatus() == null || member.getStatus().isEmpty()) {
                member.setStatus("APPROVED");
            }
            // ✅ Respecter le role envoyé, sinon MEMBER par défaut
            if (member.getRole() == null || member.getRole().isEmpty()) {
                member.setRole("MEMBER");
            }
            member.setJoinedDate(LocalDateTime.now());
            club.getMembers().add(member);
            return clubRepository.save(club);
        }
        return club;
    }

    public Club approveMember(String clubId, String userId) {
        Club club = clubRepository.findById(clubId)
                .orElseThrow(() -> new RuntimeException("Club non trouvé"));

        club.getMembers().stream()
                .filter(m -> m.getUserId().equals(userId))
                .findFirst()
                .ifPresent(member -> member.setStatus("APPROVED"));

        return clubRepository.save(club);
    }

    public Club rejectMember(String clubId, String userId) {
        Club club = clubRepository.findById(clubId)
                .orElseThrow(() -> new RuntimeException("Club non trouvé"));

        club.getMembers().removeIf(m -> m.getUserId().equals(userId));
        return clubRepository.save(club);
    }

    public Club changeMemberRole(String clubId, String userId, String newRole) {
        Club club = clubRepository.findById(clubId)
                .orElseThrow(() -> new RuntimeException("Club non trouvé"));

        System.out.println("=== CHANGEMENT RÔLE ===");
        System.out.println("Club: " + clubId);
        System.out.println("User: " + userId);
        System.out.println("Nouveau rôle: " + newRole);

        club.getMembers().stream()
                .filter(m -> m.getUserId().equals(userId))
                .findFirst()
                .ifPresent(member -> {
                    String oldRole = member.getRole();
                    member.setRole(newRole);
                    System.out.println("Rôle changé de " + oldRole + " à " + newRole);
                });

        Club saved = clubRepository.save(club);

        // Sync role to user-service so permission checks work correctly
        try {
            String url = userServiceUrl + "/" + userId + "/role";
            Map<String, String> roleUpdate = new HashMap<>();
            roleUpdate.put("role", newRole);
            HttpEntity<Map<String, String>> request = new HttpEntity<>(roleUpdate);
            restTemplate.exchange(url, HttpMethod.PUT, request, String.class);
            System.out.println("✅ Rôle synchronisé dans user-service: " + newRole);
        } catch (Exception e) {
            System.err.println("❌ Erreur synchronisation rôle user-service: " + e.getMessage());
        }

        return saved;
    }

    // ========== GESTION DES SOUS-GROUPES ==========

    public Club addSubGroup(String clubId, SubGroup subGroup) {
        Club club = clubRepository.findById(clubId)
                .orElseThrow(() -> new RuntimeException("Club non trouvé"));

        subGroup.setId(UUID.randomUUID().toString());
        if (subGroup.getMemberIds() == null) {
            subGroup.setMemberIds(new ArrayList<>());
        }
        club.getSubGroups().add(subGroup);
        Club saved = clubRepository.save(club);

        // Keep Instant Voice committee channel in sync:
        // - committee channel is created on subgroup creation
        // - subgroup members + bureau members are present in voice channel
        syncVoiceCommitteeChannelMembership(subGroup.getName(), subGroup.getMemberIds());
        return saved;
    }

    public Club removeSubGroup(String clubId, String subGroupId) {
        Club club = clubRepository.findById(clubId)
                .orElseThrow(() -> new RuntimeException("Club non trouvé"));

        club.getSubGroups().removeIf(sg -> sg.getId().equals(subGroupId));
        return clubRepository.save(club);
    }

    public Club assignToSubGroup(String clubId, String userId, String subGroupId, String subGroupRole) {
        System.out.println("=== ASSIGN TO SUBGROUP SERVICE ===");
        System.out.println("ClubId: " + clubId);
        System.out.println("UserId: " + userId);
        System.out.println("SubGroupId: " + subGroupId);
        System.out.println("SubGroupRole: " + subGroupRole);
        
        Club club = clubRepository.findById(clubId)
                .orElseThrow(() -> new RuntimeException("Club non trouvé"));

        // ✅ Récupérer le mode d'appartenance aux comités
        CommitteeMembershipMode mode = club.getRules() != null && club.getRules().getCommitteeMembershipMode() != null
                ? club.getRules().getCommitteeMembershipMode()
                : CommitteeMembershipMode.MULTIPLE_ALLOWED;
        
        System.out.println("📋 Mode d'appartenance aux comités: " + mode);
        
        // ✅ Trouver le membre
        Member member = club.getMembers().stream()
                .filter(m -> m.getUserId().equals(userId))
                .findFirst()
                .orElse(null);
        
        if (member == null) {
            throw new RuntimeException("Membre non trouvé dans le club");
        }
        
        // ✅ RÈGLE 1: Mode SINGLE_ONLY - Un membre ne peut être que dans UN SEUL comité
        if (mode == CommitteeMembershipMode.SINGLE_ONLY) {
            // ✅ FIX: Vérifier dans TOUS les sous-groupes, pas seulement member.subGroupId
            // car en mode MULTIPLE_ALLOWED, subGroupId peut être écrasé
            SubGroup existingSubGroup = club.getSubGroups().stream()
                    .filter(sg -> !sg.getId().equals(subGroupId) && sg.getMemberIds().contains(userId))
                    .findFirst()
                    .orElse(null);
            
            if (existingSubGroup != null) {
                // Le membre est déjà dans un autre comité
                String currentSubGroupName = existingSubGroup.getName();
                System.err.println("❌ Mode SINGLE_ONLY: Le membre est déjà dans le comité '" + currentSubGroupName + "'");
                throw new RuntimeException("Ce club n'autorise qu'un seul comité par membre. Le membre est déjà dans le comité '" + currentSubGroupName + "'. Veuillez d'abord le retirer de ce comité.");
            }
        }
        
        // ✅ RÈGLE 2: Mode MULTIPLE_ALLOWED - Un membre peut être RESPONSABLE d'UN SEUL comité
        if (mode == CommitteeMembershipMode.MULTIPLE_ALLOWED && subGroupRole.equals("RESPONSABLE")) {
            // Vérifier si le membre est déjà responsable d'un autre comité
            boolean isAlreadyResponsable = club.getSubGroups().stream()
                    .anyMatch(sg -> !sg.getId().equals(subGroupId) && userId.equals(sg.getResponsableId()));
            
            if (isAlreadyResponsable) {
                // Trouver le comité dont il est déjà responsable
                SubGroup currentResponsableSubGroup = club.getSubGroups().stream()
                        .filter(sg -> !sg.getId().equals(subGroupId) && userId.equals(sg.getResponsableId()))
                        .findFirst()
                        .orElse(null);
                
                String currentSubGroupName = currentResponsableSubGroup != null ? currentResponsableSubGroup.getName() : "un comité";
                System.err.println("❌ Mode MULTIPLE_ALLOWED: Le membre est déjà RESPONSABLE du comité '" + currentSubGroupName + "'");
                throw new RuntimeException("Un membre ne peut être RESPONSABLE que d'UN SEUL comité. Ce membre est déjà responsable du comité '" + currentSubGroupName + "'. Il peut rejoindre ce comité en tant que MEMBRE_COMITE.");
            }
        }
        
        // ✅ RÈGLE 3: Mode MULTIPLE_ALLOWED - Un RESPONSABLE ne peut appartenir qu'à SON comité
        if (mode == CommitteeMembershipMode.MULTIPLE_ALLOWED) {
            // Vérifier si le membre est déjà RESPONSABLE d'un autre comité
            SubGroup responsableSubGroup = club.getSubGroups().stream()
                    .filter(sg -> userId.equals(sg.getResponsableId()))
                    .findFirst()
                    .orElse(null);
            
            if (responsableSubGroup != null && !responsableSubGroup.getId().equals(subGroupId)) {
                // Le membre est responsable d'un autre comité
                String responsableSubGroupName = responsableSubGroup.getName();
                System.err.println("❌ Mode MULTIPLE_ALLOWED: Le membre est RESPONSABLE du comité '" + responsableSubGroupName + "' et ne peut pas rejoindre un autre comité");
                throw new RuntimeException("Un responsable de comité ne peut appartenir qu'à son propre comité. Ce membre est responsable du comité '" + responsableSubGroupName + "'. Pour rejoindre un autre comité, il doit d'abord quitter son rôle de responsable.");
            }
        }

        // ✅ Trouver le sous-groupe
        SubGroup subGroup = club.getSubGroups().stream()
                .filter(sg -> sg.getId().equals(subGroupId))
                .findFirst()
                .orElseThrow(() -> new RuntimeException("Sous-groupe non trouvé"));
        
        System.out.println("📋 Sous-groupe trouvé: " + subGroup.getName());

        // Mettre à jour le membre dans le club
        club.getMembers().stream()
                .filter(m -> m.getUserId().equals(userId))
                .findFirst()
                .ifPresent(m -> {
                    System.out.println("👤 Membre trouvé: " + m.getName() + " (rôle actuel: " + m.getRole() + ")");

                    // Premier comité : sauvegarder le rôle initial et passer à COMMITTEE_MEMBER
                    if (!"COMMITTEE_MEMBER".equals(m.getRole()) && m.getInitialRole() == null) {
                        m.setInitialRole(m.getRole());
                        System.out.println("📝 Rôle initial sauvegardé: " + m.getRole());
                    }
                    m.setRole("COMMITTEE_MEMBER");

                    m.setSubGroupId(subGroupId);
                    m.setSubGroupRole(subGroupRole);
                    System.out.println("✅ Membre " + userId + " assigné avec rôle comité: " + subGroupRole);
                });

        // Mettre à jour le sous-groupe
        club.getSubGroups().stream()
                .filter(sg -> sg.getId().equals(subGroupId))
                .findFirst()
                .ifPresent(sg -> {
                    if (!sg.getMemberIds().contains(userId)) {
                        sg.getMemberIds().add(userId);
                        System.out.println("✅ Membre ajouté à la liste du sous-groupe");
                    }

                    if (sg.getMemberRoles() == null) {
                        sg.setMemberRoles(new HashMap<>());
                    }
                    sg.getMemberRoles().put(userId, subGroupRole);
                    System.out.println("✅ Rôle du membre mis à jour dans memberRoles: " + subGroupRole);

                    if (subGroupRole.equals("RESPONSABLE")) {
                        sg.setResponsableId(userId);
                        System.out.println("✅ ResponsableId mis à jour: " + userId);
                    } else if (userId.equals(sg.getResponsableId())) {
                        sg.setResponsableId(null);
                        System.out.println("🔄 ResponsableId effacé (rétrogradation de " + userId + ")");
                    }
                });

        // Synchroniser COMMITTEE_MEMBER dans le user-service
        try {
            String url = userServiceUrl + "/" + userId + "/role";
            Map<String, String> roleUpdate = new HashMap<>();
            roleUpdate.put("role", "COMMITTEE_MEMBER");
            HttpEntity<Map<String, String>> request = new HttpEntity<>(roleUpdate);
            restTemplate.exchange(url, HttpMethod.PUT, request, String.class);
            System.out.println("✅ Rôle COMMITTEE_MEMBER synchronisé dans user-service");
        } catch (Exception e) {
            System.err.println("❌ Erreur synchronisation user-service: " + e.getMessage());
        }

        Club savedClub = clubRepository.save(club);
        // Ensure assigned member is present in the committee voice channel.
        ensureVoiceCommitteeMember(subGroup.getName(), userId);
        // Ensure all bureau members are always present in committee channels.
        ensureBureauMembersInCommitteeChannel(subGroup.getName());
        System.out.println("✅ Club sauvegardé");
        System.out.println("===================================");
        return savedClub;
    }

    public Club removeFromSubGroup(String clubId, String subGroupId, String userId) {
        Club club = clubRepository.findById(clubId)
                .orElseThrow(() -> new RuntimeException("Club non trouvé"));
        final String[] committeeNameHolder = {null};
        final boolean[] wasResponsableHolder = {false};

        // Retirer l'userId de la liste memberIds du sous-groupe
        club.getSubGroups().stream()
                .filter(sg -> sg.getId().equals(subGroupId))
                .findFirst()
                .ifPresent(sg -> {
                    committeeNameHolder[0] = sg.getName();
                    sg.getMemberIds().remove(userId);
                    // Determine RESPONSABLE status from the subgroup itself (not from member.subGroupId)
                    if (userId.equals(sg.getResponsableId())) {
                        wasResponsableHolder[0] = true;
                        sg.setResponsableId(null);
                    }
                    if (sg.getMemberRoles() != null) {
                        sg.getMemberRoles().remove(userId);
                    }
                });

        // Check if member still belongs to any other subgroup after this removal
        // (subGroup memberIds already updated above, so this reflects the new state)
        final boolean stillInOtherCommittee = club.getSubGroups().stream()
                .anyMatch(sg -> !sg.getId().equals(subGroupId) && sg.getMemberIds().contains(userId));

        System.out.println("🔍 Encore dans d'autres comités après retrait: " + stillInOtherCommittee);

        club.getMembers().stream()
                .filter(m -> m.getUserId().equals(userId))
                .findFirst()
                .ifPresent(m -> {
                    String initialRole = m.getInitialRole();

                    // Clear primary subgroup pointer if it pointed to this subgroup
                    if (subGroupId.equals(m.getSubGroupId())) {
                        m.setSubGroupId(null);
                        m.setSubGroupRole(null);
                    }

                    if (stillInOtherCommittee) {
                        // Member still belongs to other committees — keep COMMITTEE_MEMBER
                        System.out.println("✅ Membre encore dans d'autres comités, rôle COMMITTEE_MEMBER conservé");
                    } else {
                        // Last committee removed — restore initial role
                        String roleToRestore = (initialRole != null) ? initialRole : "MEMBRE_SIMPLE";
                        System.out.println("🔄 Restauration du rôle initial: " + roleToRestore);
                        m.setRole(roleToRestore);
                        m.setInitialRole(null);

                        try {
                            String url = userServiceUrl + "/" + userId + "/role";
                            Map<String, String> roleUpdate = new HashMap<>();
                            roleUpdate.put("role", roleToRestore);
                            HttpEntity<Map<String, String>> request = new HttpEntity<>(roleUpdate);
                            restTemplate.exchange(url, HttpMethod.PUT, request, String.class);
                            System.out.println("✅ Rôle restauré dans user-service: " + roleToRestore);
                        } catch (Exception e) {
                            System.err.println("❌ Erreur restauration rôle user-service: " + e.getMessage());
                        }
                    }
                });

        Club saved = clubRepository.save(club);
        // Remove user from committee voice channel too.
        if (committeeNameHolder[0] != null && !committeeNameHolder[0].isBlank()) {
            removeVoiceCommitteeMember(committeeNameHolder[0], userId);
            ensureBureauMembersInCommitteeChannel(committeeNameHolder[0]);
        }
        return saved;
    }

    public SubGroupRecommendation recommendRole(String clubId, String userId) {
        Club club = clubRepository.findById(clubId)
                .orElseThrow(() -> new RuntimeException("Club non trouvé"));

        SubGroupRecommendation recommendation = new SubGroupRecommendation();

        if (club.getSubGroups() != null && !club.getSubGroups().isEmpty()) {
            SubGroup recommended = club.getSubGroups().get(0);
            recommendation.setSubGroupId(recommended.getId());
            recommendation.setSubGroupName(recommended.getName());
            recommendation.setReason("Basé sur vos centres d'intérêt");
        } else {
            recommendation.setSubGroupName("Général");
            recommendation.setReason("Aucun sous-groupe disponible");
        }

        recommendation.setSuggestedRole("MEMBER");
        return recommendation;
    }
    public Club updateSubGroup(String clubId, String subGroupId, SubGroup updatedSubGroup) {
        Club club = clubRepository.findById(clubId)
                .orElseThrow(() -> new RuntimeException("Club non trouvé"));

        club.getSubGroups().stream()
                .filter(sg -> sg.getId().equals(subGroupId))
                .findFirst()
                .ifPresent(sg -> {
                    if (updatedSubGroup.getName() != null) sg.setName(updatedSubGroup.getName());
                    if (updatedSubGroup.getDescription() != null) sg.setDescription(updatedSubGroup.getDescription());
                });

        return clubRepository.save(club);
    }

    private void syncVoiceCommitteeChannelMembership(String committeeName, List<String> subGroupMemberIds) {
        if (committeeName == null || committeeName.isBlank()) return;
        if (subGroupMemberIds != null) {
            for (String memberId : subGroupMemberIds) {
                ensureVoiceCommitteeMember(committeeName, memberId);
            }
        }
        ensureBureauMembersInCommitteeChannel(committeeName);
    }

    private void ensureBureauMembersInCommitteeChannel(String committeeName) {
        try {
            ResponseEntity<List> resp = restTemplate.getForEntity(userServiceUrl, List.class);
            List<?> users = resp.getBody();
            if (users == null) return;
            for (Object item : users) {
                if (!(item instanceof Map<?, ?> userMap)) continue;
                String role = normalize(userMap.get("role"));
                if (!isBureauRole(role)) continue;
                String userId = firstNonBlank(userMap.get("userId"), userMap.get("id"), userMap.get("_id"));
                ensureVoiceCommitteeMember(committeeName, userId);
            }
        } catch (Exception e) {
            System.err.println("⚠️ Impossible de synchroniser les membres bureau dans le channel voice du comité '" +
                    committeeName + "': " + e.getMessage());
        }
    }

    private boolean isBureauRole(String role) {
        return role != null && BUREAU_ROLES.contains(role.trim().toUpperCase());
    }

    private void ensureVoiceCommitteeMember(String committeeName, String memberId) {
        if (committeeName == null || committeeName.isBlank() || memberId == null || memberId.isBlank()) return;
        try {
            String url = voiceChannelsUrl
                    + "/committee-channel/"
                    + URLEncoder.encode(committeeName, StandardCharsets.UTF_8)
                    + "/"
                    + URLEncoder.encode(memberId, StandardCharsets.UTF_8);
            restTemplate.postForEntity(url, new HashMap<>(), Object.class);
        } catch (Exception e) {
            System.err.println("⚠️ Impossible d'ajouter '" + memberId + "' au channel voice du comité '" +
                    committeeName + "': " + e.getMessage());
        }
    }

    private void removeVoiceCommitteeMember(String committeeName, String memberId) {
        if (committeeName == null || committeeName.isBlank() || memberId == null || memberId.isBlank()) return;
        try {
            String url = voiceChannelsUrl
                    + "/committee-channel/"
                    + URLEncoder.encode(committeeName, StandardCharsets.UTF_8)
                    + "/"
                    + URLEncoder.encode(memberId, StandardCharsets.UTF_8);
            restTemplate.exchange(url, HttpMethod.DELETE, null, Void.class);
        } catch (Exception e) {
            System.err.println("⚠️ Impossible de retirer '" + memberId + "' du channel voice du comité '" +
                    committeeName + "': " + e.getMessage());
        }
    }

    private String normalize(Object value) {
        return value == null ? "" : value.toString().trim();
    }

    private String firstNonBlank(Object... values) {
        for (Object v : values) {
            String s = normalize(v);
            if (!s.isBlank()) return s;
        }
        return "";
    }
}