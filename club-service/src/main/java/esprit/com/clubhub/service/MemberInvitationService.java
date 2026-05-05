package esprit.com.clubhub.service;

import esprit.com.clubhub.dto.InviteMemberRequest;
import esprit.com.clubhub.dto.SetupPasswordRequest;
import esprit.com.clubhub.entity.Club;
import esprit.com.clubhub.entity.Member;
import esprit.com.clubhub.entity.MemberInvitation;
import esprit.com.clubhub.repository.ClubRepository;
import esprit.com.clubhub.repository.MemberInvitationRepo;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class MemberInvitationService {

    @Autowired
    private MemberInvitationRepo invitationRepo;

    @Autowired
    private ClubRepository clubRepository;

    @Autowired
    private EmailService emailService;

    @Autowired
    private RestTemplate restTemplate;

    @Value("${app.frontend.url:http://localhost:4200}")
    private String frontendUrl;

    private final String userServiceUrl = "http://localhost:8081/api/users";

    public MemberInvitation inviteMember(InviteMemberRequest request, String invitedById) {
        // Check duplicate pending invitation
        if (invitationRepo.existsByEmailAndClubIdAndUsed(request.getEmail(), request.getClubId(), false)) {
            throw new RuntimeException("Une invitation est déjà en attente pour cet email");
        }

        Club club = clubRepository.findById(request.getClubId())
                .orElseThrow(() -> new RuntimeException("Club non trouvé"));

        String inviterName = "Administrateur";
        if (invitedById != null && !invitedById.equals("system")) {
            try {
                @SuppressWarnings("unchecked")
                Map<String, Object> inviter = restTemplate.getForObject(
                        userServiceUrl + "/" + invitedById, Map.class);
                if (inviter != null) {
                    inviterName = inviter.get("firstName") + " " + inviter.get("lastName");
                }
            } catch (Exception e) {
                System.err.println("⚠️ Impossible de récupérer l'inviteur: " + e.getMessage());
            }
        }

        MemberInvitation invitation = new MemberInvitation();
        invitation.setEmail(request.getEmail());
        invitation.setFirstName(request.getFirstName());
        invitation.setLastName(request.getLastName());
        invitation.setRole(request.getRole());
        invitation.setCustomRoleId(request.getCustomRoleId());
        invitation.setClubId(request.getClubId());
        invitation.setClubName(club.getName());
        invitation.setInvitedBy(invitedById);
        invitation.setInvitedByName(inviterName);
        invitation.setToken(generateUniqueToken());

        invitation = invitationRepo.save(invitation);

        try {
            sendInvitationEmail(invitation);
        } catch (Exception e) {
            System.err.println("❌ Erreur envoi email invitation: " + e.getMessage());
        }

        return invitation;
    }

    private String generateUniqueToken() {
        String token;
        do {
            token = UUID.randomUUID().toString();
        } while (invitationRepo.findByToken(token).isPresent());
        return token;
    }

    private void sendInvitationEmail(MemberInvitation inv) {
        String link = frontendUrl + "/setup-password?token=" + inv.getToken();
        String subject = "Invitation à rejoindre " + inv.getClubName() + " sur ClubHub";
        String html = buildEmailHtml(inv, link);
        emailService.sendHtml(inv.getEmail(), subject, html);
    }

    private String buildEmailHtml(MemberInvitation inv, String link) {
        return """
            <!DOCTYPE html>
            <html>
            <head><meta charset="UTF-8">
            <style>
              body{font-family:Arial,sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto;padding:20px}
              .header{background:linear-gradient(135deg,#667eea,#764ba2);color:white;padding:30px;text-align:center;border-radius:10px 10px 0 0}
              .content{background:#f9f9f9;padding:30px;border-radius:0 0 10px 10px}
              .btn{display:inline-block;padding:15px 30px;background:linear-gradient(135deg,#667eea,#764ba2);color:white;text-decoration:none;border-radius:5px;margin:20px 0;font-weight:bold}
              .info{background:white;padding:15px;border-left:4px solid #667eea;margin:20px 0}
            </style></head>
            <body>
              <div class="header"><h1>🎉 Bienvenue sur ClubHub !</h1></div>
              <div class="content">
                <p>Bonjour <strong>%s %s</strong>,</p>
                <p>Vous avez été invité(e) à rejoindre le club <strong>%s</strong> par <strong>%s</strong>.</p>
                <div class="info">
                  <strong>📋 Détails :</strong>
                  <ul>
                    <li><strong>Club :</strong> %s</li>
                    <li><strong>Rôle :</strong> %s</li>
                    <li><strong>Invité par :</strong> %s</li>
                  </ul>
                </div>
                <p>Pour activer votre compte, cliquez ci-dessous :</p>
                <div style="text-align:center"><a href="%s" class="btn">Créer mon mot de passe</a></div>
                <p style="font-size:12px;color:#666">Si le bouton ne fonctionne pas : <a href="%s">%s</a></p>
                <p><strong>⚠️ Ce lien expire dans 7 jours.</strong></p>
              </div>
            </body></html>
            """.formatted(
                inv.getFirstName(), inv.getLastName(),
                inv.getClubName(), inv.getInvitedByName(),
                inv.getClubName(), inv.getRole(), inv.getInvitedByName(),
                link, link, link
        );
    }

    public MemberInvitation validateToken(String token) {
        MemberInvitation inv = invitationRepo.findByToken(token)
                .orElseThrow(() -> new RuntimeException("Token invalide"));
        if (inv.isUsed()) throw new RuntimeException("Cette invitation a déjà été utilisée");
        if (inv.isExpired()) throw new RuntimeException("Cette invitation a expiré");
        return inv;
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> setupPassword(SetupPasswordRequest request) {
        MemberInvitation inv = validateToken(request.getToken());

        Map<String, Object> userRequest = new HashMap<>();
        userRequest.put("firstName", inv.getFirstName());
        userRequest.put("lastName", inv.getLastName());
        userRequest.put("email", inv.getEmail());
        userRequest.put("password", request.getPassword());
        userRequest.put("role", inv.getRole());
        userRequest.put("customRoleId", inv.getCustomRoleId());
        userRequest.put("clubId", inv.getClubId());
        userRequest.put("phoneNumber", "");

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(userRequest, headers);

        Map<String, Object> userResponse = restTemplate.postForObject(userServiceUrl, entity, Map.class);

        if (userResponse == null) {
            throw new RuntimeException("Erreur lors de la création du compte utilisateur");
        }

        // user-service returns 'userId' in AuthResponse
        String userId = (String) userResponse.getOrDefault("userId",
                userResponse.get("id"));

        if (userId == null) {
            throw new RuntimeException("Erreur: ID utilisateur non reçu du user-service");
        }

        // Auto-add member to club
        try {
            Club club = clubRepository.findById(inv.getClubId())
                    .orElseThrow(() -> new RuntimeException("Club non trouvé"));
            Member member = new Member();
            member.setUserId(userId);
            member.setName(inv.getFirstName() + " " + inv.getLastName());
            member.setEmail(inv.getEmail());
            member.setRole(inv.getRole());
            member.setStatus("APPROVED");
            member.setJoinedDate(LocalDateTime.now());
            club.getMembers().add(member);
            clubRepository.save(club);
            System.out.println("✅ Membre ajouté au club: " + club.getName());
        } catch (Exception e) {
            System.err.println("❌ Erreur ajout membre au club: " + e.getMessage());
        }

        inv.setUsed(true);
        inv.setUsedAt(LocalDateTime.now());
        invitationRepo.save(inv);

        return userResponse;
    }

    public List<MemberInvitation> getClubInvitations(String clubId) {
        return invitationRepo.findByClubId(clubId);
    }

    public List<MemberInvitation> getPendingInvitations(String clubId) {
        return invitationRepo.findByClubIdAndUsed(clubId, false);
    }

    public void deleteInvitation(String invitationId) {
        invitationRepo.deleteById(invitationId);
    }

    public void resendInvitation(String invitationId) {
        MemberInvitation inv = invitationRepo.findById(invitationId)
                .orElseThrow(() -> new RuntimeException("Invitation non trouvée"));
        if (inv.isUsed()) throw new RuntimeException("Cette invitation a déjà été utilisée");
        inv.setExpiresAt(LocalDateTime.now().plusDays(7));
        invitationRepo.save(inv);
        try {
            sendInvitationEmail(inv);
        } catch (Exception e) {
            throw new RuntimeException("Erreur lors du renvoi: " + e.getMessage());
        }
    }
}
