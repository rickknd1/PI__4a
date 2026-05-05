package esprit.com.instantvoicemanagment.controller;

import esprit.com.instantvoicemanagment.entity.Channel;
import esprit.com.instantvoicemanagment.security.JwtUtil;
import esprit.com.instantvoicemanagment.service.ChannelService;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;

import java.util.Arrays;
import java.util.List;

@RestController
@RequestMapping("/api/channels")
@RequiredArgsConstructor
public class ChannelController {

    private final ChannelService channelService;
    private final JwtUtil jwtUtil;
    private final RestTemplate restTemplate = new RestTemplate();

    /**
     * Extrait le userId du JWT. Cookie "jwt" en priorite (cas standard via le
     * Gateway), sinon header "Authorization: Bearer <token>" en fallback.
     */
    private String getUserIdFromRequest(HttpServletRequest request) {
        if (request.getCookies() != null) {
            String fromCookie = Arrays.stream(request.getCookies())
                    .filter(c -> "jwt".equals(c.getName()))
                    .map(Cookie::getValue)
                    .filter(t -> t != null && !t.isEmpty())
                    .map(t -> {
                        try { return jwtUtil.extractUserId(t); }
                        catch (Exception e) { return null; }
                    })
                    .filter(id -> id != null)
                    .findFirst()
                    .orElse(null);
            if (fromCookie != null) return fromCookie;
        }
        String auth = request.getHeader("Authorization");
        if (auth != null && auth.startsWith("Bearer ")) {
            String token = auth.substring(7);
            try { return jwtUtil.extractUserId(token); }
            catch (Exception ignored) { }
        }
        return null;
    }

    private String getRoleFromRequest(HttpServletRequest request) {
        if (request.getCookies() != null) {
            String fromCookie = Arrays.stream(request.getCookies())
                    .filter(c -> "jwt".equals(c.getName()))
                    .map(Cookie::getValue)
                    .filter(t -> t != null && !t.isEmpty())
                    .map(t -> {
                        try { return jwtUtil.extractRole(t); }
                        catch (Exception e) { return null; }
                    })
                    .filter(r -> r != null)
                    .findFirst()
                    .orElse(null);
            if (fromCookie != null) return fromCookie;
        }
        String auth = request.getHeader("Authorization");
        if (auth != null && auth.startsWith("Bearer ")) {
            String token = auth.substring(7);
            try { return jwtUtil.extractRole(token); }
            catch (Exception ignored) { }
        }
        return null;
    }

    // GET channels for a user
    @GetMapping
    public List<Channel> getChannels(
            @RequestParam(required = false) String userId,
            @RequestParam(required = false) String role,
            @RequestParam(required = false) String userCommittee) {
        if (userId != null && !userId.isEmpty()) {
            return channelService.getChannelsForUser(userId, role, userCommittee);
        }
        return channelService.getAllChannels();
    }

    // GET channel by ID
    @GetMapping("/{id}")
    public ResponseEntity<Channel> getChannelById(@PathVariable String id) {
        return ResponseEntity.ok(channelService.getChannelById(id));
    }

    // POST create channel
    // Le createdBy est extrait du JWT (cookie ou Bearer). Les query params
    // userId/role restent acceptes en fallback pour ne pas casser les anciens
    // appels frontend, mais le JWT est prioritaire (source de verite).
    @PostMapping
    public ResponseEntity<?> createChannel(
            @RequestBody Channel channel,
            @RequestParam(required = false) String userId,
            @RequestParam(required = false) String role,
            HttpServletRequest request) {
        try {
            String jwtUserId = getUserIdFromRequest(request);
            String jwtRole = getRoleFromRequest(request);
            String effectiveUserId = (jwtUserId != null && !jwtUserId.isBlank()) ? jwtUserId : userId;
            String effectiveRole = (jwtRole != null && !jwtRole.isBlank()) ? jwtRole : role;
            return ResponseEntity.ok(channelService.createChannel(channel, effectiveUserId, effectiveRole));
        } catch (RuntimeException e) {
            return ResponseEntity.status(403).body(e.getMessage());
        }
    }

    // DELETE channel
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteChannel(@PathVariable String id) {
        channelService.deleteChannel(id);
        return ResponseEntity.noContent().build();
    }

    // POST add member to channel
    @PostMapping("/{id}/members/{memberId}")
    public ResponseEntity<Channel> addMember(
            @PathVariable String id,
            @PathVariable String memberId) {
        return ResponseEntity.ok(channelService.addMember(id, memberId));
    }

    // DELETE remove member from channel
    @DeleteMapping("/{id}/members/{memberId}")
    public ResponseEntity<?> removeMember(
            @PathVariable String id,
            @PathVariable String memberId) {
        try {
            java.util.Map<?, ?> user = restTemplate.getForObject(
                    "http://localhost:8081/api/users/" + memberId, java.util.Map.class);
            if (user != null && "PRESIDENT".equals(user.get("role"))) {
                return ResponseEntity.status(403).body("Cannot remove a PRESIDENT from a channel.");
            }
        } catch (Exception ignored) {
            // If the user service is unavailable, proceed (do not block)
        }
        return ResponseEntity.ok(channelService.removeMember(id, memberId));
    }

    // POST ensure a committee channel exists and add a member to it
    @PostMapping("/committee-channel/{committeeName}/{memberId}")
    public ResponseEntity<Channel> ensureCommitteeChannel(
            @PathVariable String committeeName,
            @PathVariable String memberId) {
        return ResponseEntity.ok(channelService.ensureCommitteeChannel(committeeName, memberId));
    }

    // DELETE remove a member from their old committee channel
    @DeleteMapping("/committee-channel/{committeeName}/{memberId}")
    public ResponseEntity<Void> removeFromCommitteeChannel(
            @PathVariable String committeeName,
            @PathVariable String memberId) {
        channelService.removeFromCommitteeChannel(committeeName, memberId);
        return ResponseEntity.noContent().build();
    }

    // POST sync member: remove from all wrong committee channels, add to correct one
    @PostMapping("/committee-channel/sync/{memberId}/{currentCommittee}")
    public ResponseEntity<Channel> syncMemberCommitteeChannel(
            @PathVariable String memberId,
            @PathVariable String currentCommittee) {
        return ResponseEntity.ok(channelService.syncMemberCommitteeChannel(memberId, currentCommittee));
    }
}
