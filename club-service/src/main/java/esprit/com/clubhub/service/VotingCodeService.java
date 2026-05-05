package esprit.com.clubhub.service;

import esprit.com.clubhub.entity.VotingCode;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.List;

@Service
public class VotingCodeService {

    private static final SecureRandom random = new SecureRandom();

    public String generateUniqueCode() {
        int code = 10000000 + random.nextInt(90000000);
        return String.valueOf(code);
    }

    public List<VotingCode> generateVotingCodes(List<String> userIds, List<String> emails) {
        List<VotingCode> votingCodes = new ArrayList<>();
        for (int i = 0; i < userIds.size(); i++) {
            votingCodes.add(new VotingCode(userIds.get(i), emails.get(i), generateUniqueCode()));
        }
        return votingCodes;
    }

    public boolean validateVotingCode(List<VotingCode> votingCodes, String email, String code) {
        return votingCodes.stream()
            .anyMatch(vc -> vc.getEmail().equals(email) && vc.getCode().equals(code) && !vc.isUsed());
    }

    public void markCodeAsUsed(List<VotingCode> votingCodes, String email, String code) {
        votingCodes.stream()
            .filter(vc -> vc.getEmail().equals(email) && vc.getCode().equals(code))
            .findFirst()
            .ifPresent(vc -> {
                vc.setUsed(true);
                vc.setUsedAt(java.time.LocalDateTime.now());
            });
    }
}
