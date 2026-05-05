package com.clubhub.treasury.service;

import com.clubhub.treasury.entity.User;
import com.clubhub.treasury.exception.TreasuryException;
import com.clubhub.treasury.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class UserContextService {

    private final UserRepository userRepository;

    public User getUser(String userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new TreasuryException("Utilisateur non trouve: " + userId, 404));
    }

    public User getUserByEmail(String email) {
        return userRepository.findByEmail(email).orElse(null);
    }

    public List<User> getUsersByClub(Long clubId) {
        return userRepository.findByClubId(clubId);
    }

    public List<User> getMembersByClub(Long clubId) {
        List<User> members = userRepository.findByClubIdAndRole(clubId, User.UserRole.MEMBRE);
        members.addAll(userRepository.findByClubIdAndRole(clubId, User.UserRole.MEMBRE_BUREAU));
        return members;
    }

    @Transactional
    public User createUser(String email, String firstName, String lastName, String role, Long clubId) {
        if (userRepository.findByEmail(email).isPresent()) {
            throw new TreasuryException("Email deja utilise: " + email, 409);
        }
        User user = User.builder()
                .email(email)
                .firstName(firstName)
                .lastName(lastName)
                .role(User.UserRole.valueOf(role))
                .clubId(clubId)
                .build();
        return userRepository.save(user);
    }

    @Transactional
    public User updateUser(String userId, String firstName, String lastName, String role) {
        User user = getUser(userId);
        if (firstName != null) user.setFirstName(firstName);
        if (lastName != null) user.setLastName(lastName);
        if (role != null) user.setRole(User.UserRole.valueOf(role));
        return userRepository.save(user);
    }

    @Transactional
    public void deleteUser(String userId) {
        userRepository.deleteById(userId);
    }

    public boolean isPresident(String userId) {
        return getUser(userId).getRole() == User.UserRole.PRESIDENT;
    }

    public boolean isTresorier(String userId) {
        return getUser(userId).getRole() == User.UserRole.TRESORIER;
    }

    public long countByClub(Long clubId) {
        return userRepository.findByClubId(clubId).size();
    }
}
