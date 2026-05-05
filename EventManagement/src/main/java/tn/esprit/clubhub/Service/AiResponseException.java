package tn.esprit.clubhub.Service;

/**
 * Thrown by any {@link AiClient} when a call fails in a non-recoverable
 * way (network error, empty response, malformed JSON, HTTP error, …).
 *
 * <p>Callers (e.g. {@code EventAiService}, {@code PvAiService}) catch
 * this exception and fall back to the deterministic Java templates
 * (Tier 3), so the app never breaks for the end user.</p>
 */
public class AiResponseException extends RuntimeException {

    public AiResponseException(String message) {
        super(message);
    }

    public AiResponseException(String message, Throwable cause) {
        super(message, cause);
    }
}
