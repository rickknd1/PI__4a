package esprit.com.clubhub.service;

import esprit.com.clubhub.dto.EligibilityResult;
import esprit.com.clubhub.entity.Candidate;
import esprit.com.clubhub.entity.Club;
import esprit.com.clubhub.entity.Member;
import esprit.com.clubhub.entity.*;
import esprit.com.clubhub.repository.ClubRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Service
public class EligibilityService {

    @Autowired
    private ClubRepository clubRepository;

    /**
     * Vérifier si un membre peut être candidat à l'élection présidentielle
     */
    public EligibilityResult checkPresidentEligibility(String clubId, String userId, Candidate candidate) {
        Club club = clubRepository.findById(clubId)
                .orElseThrow(() -> new RuntimeException("Club non trouvé"));

        Member member = club.getMembers().stream()
                .filter(m -> m.getUserId().equals(userId))
                .findFirst()
                .orElseThrow(() -> new RuntimeException("Membre non trouvé"));

        EligibilityResult result = new EligibilityResult();
        result.setEligible(true);

        // Seule condition : être membre approuvé
        if (!member.getStatus().equals("APPROVED")) {
            result.setEligible(false);
            result.addReason("❌ Vous devez être un membre approuvé du club");
        }

        return result;
    }

    public EligibilityResult checkBureauEligibility(String clubId, String userId, Candidate candidate) {
        System.out.println("=== CHECK BUREAU ELIGIBILITY ===");
        System.out.println("ClubId: " + clubId + " UserId: " + userId);
        System.out.println("SubGroupTarget: " + candidate.getSubGroupTarget());

        Club club = clubRepository.findById(clubId)
                .orElseThrow(() -> new RuntimeException("Club non trouvé"));

        Member member = club.getMembers().stream()
                .filter(m -> m.getUserId().equals(userId))
                .findFirst()
                .orElseThrow(() -> new RuntimeException("Membre non trouvé dans ce club"));

        System.out.println("Membre: " + member.getName() + " status=" + member.getStatus() + " subGroupId=" + member.getSubGroupId());

        EligibilityResult result = new EligibilityResult();
        result.setEligible(true);

        // Condition 1 : Membre approuvé
        if (!"APPROVED".equals(member.getStatus())) {
            result.setEligible(false);
            result.addReason("❌ Vous devez être un membre approuvé du club");
            return result;
        }

        // Condition 2 : Un sous-groupe doit être choisi
        if (candidate.getSubGroupTarget() == null || candidate.getSubGroupTarget().isEmpty()) {
            result.setEligible(false);
            result.addReason("❌ Vous devez choisir un sous-groupe");
            return result;
        }

        // Condition 3 : Vérifier appartenance au sous-groupe (via memberIds OU subGroupId)
        String target = candidate.getSubGroupTarget();
        boolean inSubGroup = club.getSubGroups().stream().anyMatch(sg -> {
            boolean nameMatch = sg.getName().equalsIgnoreCase(target) ||
                    target.toLowerCase().contains(sg.getName().toLowerCase()) ||
                    sg.getName().toLowerCase().contains(target.toLowerCase());
            boolean memberInIds = sg.getMemberIds() != null && sg.getMemberIds().contains(userId);
            boolean memberBySubGroupId = sg.getId().equals(member.getSubGroupId());
            System.out.println("  SG '" + sg.getName() + "': nameMatch=" + nameMatch + " memberInIds=" + memberInIds + " memberBySubGroupId=" + memberBySubGroupId);
            return nameMatch && (memberInIds || memberBySubGroupId);
        });

        if (!inSubGroup) {
            result.setEligible(false);
            result.addReason("❌ Vous devez appartenir au sous-groupe '" + target + "' pour postuler");
        }

        return result;
    }
}