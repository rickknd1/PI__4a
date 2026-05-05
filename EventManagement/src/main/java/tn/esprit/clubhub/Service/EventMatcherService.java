package tn.esprit.clubhub.Service;

import org.springframework.stereotype.Service;
import tn.esprit.clubhub.Entity.Event;

import java.text.Normalizer;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class EventMatcherService {

    public MatchResult matchEvent(String rawName, List<Event> events) {
        if (rawName == null || rawName.isBlank() || events == null || events.isEmpty()) {
            return MatchResult.none();
        }

        String q = normalize(rawName);
        MatchResult best = MatchResult.none();

        for (Event e : events) {
            String title = normalize(e.getTitle());
            if (title.isBlank()) continue;

            double score = similarityScore(q, title);
            if (score > best.score()) {
                best = new MatchResult(e.getId(), e.getTitle(), score);
            }
        }

        // Threshold guard
        return best.score() >= 0.35 ? best : MatchResult.none();
    }

    private double similarityScore(String a, String b) {
        // token overlap + contains bonus
        Set<String> ta = tokens(a);
        Set<String> tb = tokens(b);
        if (ta.isEmpty() || tb.isEmpty()) return 0.0;

        long common = ta.stream().filter(tb::contains).count();
        double jaccard = (double) common / (ta.size() + tb.size() - common);

        double containsBonus = (a.contains(b) || b.contains(a)) ? 0.25 : 0.0;

        return Math.min(1.0, jaccard + containsBonus);
    }

    private Set<String> tokens(String s) {
        return normalize(s).lines()
                .flatMap(line -> List.of(line.split("\\s+")).stream())
                .filter(t -> t.length() >= 2)
                .collect(Collectors.toSet());
    }

    private String normalize(String s) {
        if (s == null) return "";
        String n = Normalizer.normalize(s, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9\\s]", " ")
                .replaceAll("\\s+", " ")
                .trim();
        return n;
    }

    public record MatchResult(String eventId, String eventName, double score) {
        public static MatchResult none() { return new MatchResult(null, null, 0.0); }
        public boolean found() { return eventId != null; }
    }
}