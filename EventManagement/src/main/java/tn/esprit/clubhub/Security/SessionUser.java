package tn.esprit.clubhub.Security;

/**
 * Immutable identity of the currently authenticated user.
 *
 * Built by {@link SessionService} from the {@code jwt} cookie that the
 * user-service sets at login. Consumed by controllers that need to know
 * "who is doing this" (RSVP, feedback, event creation…) instead of
 * trusting whatever the frontend put in the request body.
 *
 * @param id        Mongo id of the user (claim "userId" in the JWT)
 * @param email     subject of the JWT — guaranteed unique per user
 * @param role      role string (e.g. "PRESIDENT", "MEMBRE_SIMPLE", …)
 * @param fullName  best-effort display name resolved from user-service.
 *                  Falls back to the email local-part when the lookup
 *                  fails (offline user-service, network glitch, …).
 */
public record SessionUser(
        String id,
        String email,
        String role,
        String fullName
) {
    /** True when the principal carries enough info to be persisted/audited. */
    public boolean isComplete() {
        return id != null && !id.isBlank()
            && email != null && !email.isBlank();
    }
}
