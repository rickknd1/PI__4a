package esprit.com.clubhub.service;

import esprit.com.clubhub.dto.AuthResponse;
import esprit.com.clubhub.dto.LoginRequest;
import esprit.com.clubhub.dto.RegisterRequest;
import esprit.com.clubhub.entity.Role;
import esprit.com.clubhub.entity.User;
import esprit.com.clubhub.repository.UserRepo;
import esprit.com.clubhub.security.JwtUtil;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class AuthService {

    private final UserRepo userRepo;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;

    public AuthService(UserRepo userRepo,
                       PasswordEncoder passwordEncoder,
                       JwtUtil jwtUtil) {
        this.userRepo = userRepo;
        this.passwordEncoder = passwordEncoder;
        this.jwtUtil = jwtUtil;
    }

    public AuthResponse register(RegisterRequest request) {
        System.out.println("=== REGISTER DEBUG ===");
        System.out.println("Email: " + request.getEmail());
        System.out.println("Role: " + request.getRole());
        System.out.println("CustomRoleId: " + request.getCustomRoleId());
        System.out.println("=====================");
        
        if (userRepo.existsByEmail(request.getEmail())) {
            throw new RuntimeException("Un compte avec cet email existe déjà");
        }

        User user = new User();
        user.setFirstName(request.getFirstName());
        user.setLastName(request.getLastName());
        user.setPhoneNumber(request.getPhoneNumber());
        user.setEmail(request.getEmail());
        user.setPassword(passwordEncoder.encode(request.getPassword()));
        
        // ✅ Stocker le nom du rôle (système OU personnalisé)
        user.setRole(request.getRole());
        
        // ✅ Si c'est un rôle personnalisé, stocker aussi l'ID pour récupérer les permissions
        if (request.getCustomRoleId() != null && !request.getCustomRoleId().isEmpty()) {
            user.setCustomRoleId(request.getCustomRoleId());
            System.out.println("✅ CustomRoleId enregistré: " + request.getCustomRoleId());
        }
        
        user.setProfilePhoto(request.getProfilePhoto());
        
        // ✅ Stocker simplement l'ID du club (pas d'objet Club)
        if (request.getClubId() != null && !request.getClubId().isEmpty()) {
            user.setClubId(request.getClubId());
        }
        
        user.setActive(true);

        User saved = userRepo.save(user);
        
        System.out.println("✅ User sauvegardé - ID: " + saved.getId() + ", Role: " + saved.getRole() + ", CustomRoleId: " + saved.getCustomRoleId());

        String token = jwtUtil.generateToken(saved.getEmail(), saved.getId(), saved.getRole());
        return new AuthResponse(token, saved.getId(), saved.getEmail(),
                saved.getFirstName(), saved.getLastName(), saved.getPhoneNumber(),
                saved.getRole(), 
                saved.getClubId(),
                saved.getProfilePhoto());
    }

    public AuthResponse login(LoginRequest request) {
        User user = userRepo.findByEmail(request.getEmail())
                .orElseThrow(() -> new RuntimeException("Email ou mot de passe incorrect"));

        if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            throw new RuntimeException("Email ou mot de passe incorrect");
        }

        String token = jwtUtil.generateToken(user.getEmail(), user.getId(), user.getRole());
        return new AuthResponse(token, user.getId(), user.getEmail(),
                user.getFirstName(), user.getLastName(), user.getPhoneNumber(),
                user.getRole(),
                user.getClubId(),
                user.getProfilePhoto());
    }

    // ✅ MÉTHODE pour réinitialiser le mot de passe
    public void resetPassword(String email, String newPassword) {
        User user = userRepo.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("Utilisateur introuvable"));

        user.setPassword(passwordEncoder.encode(newPassword));
        userRepo.save(user);
    }

    /** Recupere le user par email (utilise par /api/auth/me pour refresh state frontend). */
    public User findUserByEmail(String email) {
        return userRepo.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("Utilisateur introuvable: " + email));
    }
}