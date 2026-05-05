package esprit.com.clubhub.service;

import esprit.com.clubhub.entity.Role;
import esprit.com.clubhub.entity.User;
import esprit.com.clubhub.repository.UserRepo;
import org.springframework.stereotype.Service;
import java.util.List;
import java.util.Optional;

@Service
public class UserService {

    private final UserRepo userRepo;

    public UserService(UserRepo userRepo) {
        this.userRepo = userRepo;
    }

    public List<User> getAllUsers() {
        return userRepo.findAll();
    }

    public User getUserById(String id) {
        return userRepo.findById(id)
                .orElseThrow(() -> new RuntimeException("Utilisateur introuvable"));
    }

    public Optional<User> findUserById(String id) {
        return userRepo.findById(id);
    }

    public User updateUser(String id, User updated) {
        User existing = getUserById(id);
        existing.setFirstName(updated.getFirstName());
        existing.setLastName(updated.getLastName());
        existing.setPhoneNumber(updated.getPhoneNumber());
        existing.setRole(updated.getRole());

        // ✅ CORRIGÉ : utiliser clubId seulement
        if (updated.getClubId() != null) {
            existing.setClubId(updated.getClubId());
        }

        existing.setActive(updated.isActive());
        return userRepo.save(existing);
    }

    public User updateProfilePhoto(String id, String photoUrl) {
        User existing = getUserById(id);
        existing.setProfilePhoto(photoUrl);
        return userRepo.save(existing);
    }

    public void deleteUser(String id) {
        userRepo.deleteById(id);
    }

    public List<User> getSimpleMembers() {
        return userRepo.findByRole("MEMBRE_SIMPLE");  // ✅ role est maintenant un String
    }

    public List<User> getBureauMembers() {
        return userRepo.findAll().stream()
                .filter(u -> u.getRole() != null && !u.getRole().equals("MEMBRE_SIMPLE"))  // ✅ Comparaison de String
                .collect(java.util.stream.Collectors.toList());
    }

    public User assignPost(String id, String post) {
        User existing = getUserById(id);
        existing.setPost(post);
        return userRepo.save(existing);
    }

    public void clearPostByName(String postName) {
        userRepo.findByRole("MEMBRE_SIMPLE").stream()  // ✅ Changé en String
                .filter(u -> postName.equals(u.getPost()))
                .forEach(u -> {
                    u.setPost(null);
                    userRepo.save(u);
                });
    }

    // ===== MÉTHODES POUR COMPATIBILITÉ =====

    public List<User> getUsersByClub(String clubId) {
        return userRepo.findByClubId(clubId);
    }

    public User createUser(User user) {
        if (userRepo.existsByEmail(user.getEmail())) {
            throw new RuntimeException("Email déjà utilisé");
        }
        return userRepo.save(user);
    }
}