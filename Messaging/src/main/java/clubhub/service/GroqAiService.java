package clubhub.service;

import clubhub.enums.Difficulty;
import clubhub.model.GameLeaderboard;
import clubhub.model.GameSession;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.openai.OpenAiChatModel;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Service
public class GroqAiService {

    private static final Logger log = LoggerFactory.getLogger(GroqAiService.class);

    private final ChatClient chatClient;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public GroqAiService(OpenAiChatModel chatModel) {
        this.chatClient = ChatClient.create(chatModel);
    }

    public List<GameSession.Question> generateQuestions(String category, Difficulty difficulty, int count) {
        String systemPrompt = """
                You are an expert trivia game master. Generate exactly %d multiple-choice questions.
                
                Category: %s
                Difficulty: %s
                
                CRITICAL RULES:
                1. Return ONLY a valid JSON array. No markdown, no code blocks, no extra text.
                2. Each question must have exactly 4 options.
                3. correctAnswer must match ONE option EXACTLY.
                4. Keep options SHORT (1-5 words max).
                5. Keep fun facts SHORT (1-2 sentences max).
                6. Do NOT use quotes, newlines, or special characters like \\n \\" inside strings.
                
                JSON format:
                [
                  {
                    "index": 0,
                    "questionText": "Short question?",
                    "options": ["Option A", "Option B", "Option C", "Option D"],
                    "correctAnswer": "Option A",
                    "aiFunFact": "Short fun fact.",
                    "aiWrongExplanation": "Brief explanation."
                  }
                ]
                """.formatted(count, category, difficulty.name());

        try {
            String response = chatClient.prompt()
                    .system(systemPrompt)
                    .user("Generate the questions now as a JSON array.")
                    .call()
                    .content();

            if (response == null || response.isBlank()) {
                throw new RuntimeException("Empty response from Groq");
            }

            log.info("Groq raw response length: {} characters", response.length());

            // Clean markdown wrappers
            response = response.replaceAll("```json\\s*", "").replaceAll("```\\s*", "").trim();

            // Handle if wrapped in an object like {"questions": [...]}
            if (response.startsWith("{")) {
                JsonNode node = objectMapper.readTree(response);
                if (node.has("questions")) {
                    response = node.get("questions").toString();
                } else {
                    // Find any array field
                    var fields = node.fields();
                    while (fields.hasNext()) {
                        var entry = fields.next();
                        if (entry.getValue().isArray()) {
                            response = entry.getValue().toString();
                            break;
                        }
                    }
                }
            }

            // Attempt to repair truncated JSON
            response = repairTruncatedJson(response);

            List<Map<String, Object>> rawList = objectMapper.readValue(response, new TypeReference<>() {});

            List<GameSession.Question> questions = new ArrayList<>();
            for (Map<String, Object> map : rawList) {
                try {
                    questions.add(convertToQuestion(map));
                } catch (Exception e) {
                    log.warn("Skipping invalid question: {}", e.getMessage());
                }
            }

            if (questions.isEmpty()) {
                throw new RuntimeException("No valid questions could be parsed");
            }

            log.info("Successfully parsed {} questions", questions.size());
            return questions;

        } catch (Exception e) {
            // Groq API unavailable (missing/invalid GROQ_API_KEY, rate limit, network).
            // Fall back to a static curated question set so the trivia feature
            // remains usable for demos and offline development. The fallback is
            // deterministic per (category, difficulty) and capped to `count`.
            log.warn("Groq unavailable ({}). Falling back to static questions.", e.getMessage());
            return staticFallback(category, difficulty, count);
        }
    }

    /**
     * Curated offline question bank used when the Groq API is not reachable.
     * Keeps the trivia mini-game functional for demos without an API key.
     * Questions are intentionally generic (Culture générale) so they stay
     * relevant regardless of the requested category.
     */
    private List<GameSession.Question> staticFallback(String category, Difficulty difficulty, int count) {
        String[][] bank = new String[][] {
            // questionText, optA, optB, optC, optD, correct, funFact
            {"Quelle est la capitale de la France ?", "Lyon", "Paris", "Marseille", "Toulouse", "Paris",
             "Paris est la capitale de la France depuis le 10ᵉ siècle."},
            {"Combien de continents y a-t-il sur Terre ?", "5", "6", "7", "8", "7",
             "Les 7 continents sont : Afrique, Antarctique, Asie, Europe, Océanie, Amérique du Nord et du Sud."},
            {"Quel est le plus grand océan du monde ?", "Atlantique", "Pacifique", "Indien", "Arctique", "Pacifique",
             "L'océan Pacifique couvre environ un tiers de la surface de la Terre."},
            {"Qui a peint la Joconde ?", "Picasso", "Van Gogh", "Léonard de Vinci", "Monet", "Léonard de Vinci",
             "Léonard de Vinci a peint la Joconde entre 1503 et 1519."},
            {"Quelle planète est connue comme la planète rouge ?", "Vénus", "Mars", "Jupiter", "Saturne", "Mars",
             "Mars doit sa couleur rouge à l'oxyde de fer présent à sa surface."},
            {"En quelle année l'Homme a-t-il marché sur la Lune ?", "1965", "1969", "1972", "1975", "1969",
             "Neil Armstrong a posé le pied sur la Lune le 21 juillet 1969."},
            {"Quel est l'élément chimique de symbole O ?", "Or", "Osmium", "Oxygène", "Olive", "Oxygène",
             "L'oxygène constitue environ 21% de l'atmosphère terrestre."},
            {"Combien de joueurs dans une équipe de football sur le terrain ?", "9", "10", "11", "12", "11",
             "Une équipe de football comporte 11 joueurs : 1 gardien et 10 joueurs de champ."},
            {"Quelle langue est parlée au Brésil ?", "Espagnol", "Portugais", "Brésilien", "Anglais", "Portugais",
             "Le Brésil est la plus grande nation lusophone du monde."},
            {"Qui a écrit Roméo et Juliette ?", "Hugo", "Shakespeare", "Molière", "Voltaire", "Shakespeare",
             "Roméo et Juliette a été écrite par William Shakespeare vers 1595."},
            {"Quel est le plus long fleuve du monde ?", "Nil", "Amazone", "Yangtsé", "Mississippi", "Nil",
             "Le Nil mesure environ 6 650 km."},
            {"Combien y a-t-il de cordes sur une guitare standard ?", "4", "5", "6", "7", "6",
             "Une guitare classique standard comporte 6 cordes."},
            {"Quel pays a inventé la pizza ?", "France", "Italie", "Grèce", "Espagne", "Italie",
             "La pizza moderne est née à Naples au 18ᵉ siècle."},
            {"Quelle est la monnaie du Japon ?", "Yuan", "Won", "Yen", "Baht", "Yen",
             "Le yen est la monnaie officielle du Japon depuis 1871."},
            {"Combien de minutes dans une heure ?", "30", "45", "60", "90", "60",
             "Le système sexagésimal vient des Babyloniens."},
            {"Quel est le plus haut sommet du monde ?", "Mont Blanc", "K2", "Everest", "Kilimandjaro", "Everest",
             "L'Everest culmine à 8 848,86 mètres."},
            {"Combien de couleurs dans un arc-en-ciel ?", "5", "6", "7", "8", "7",
             "Rouge, orange, jaune, vert, bleu, indigo, violet."},
            {"Qui a inventé l'ampoule électrique ?", "Tesla", "Edison", "Bell", "Marconi", "Edison",
             "Thomas Edison a breveté son ampoule en 1879."},
            {"Quelle est la mer la plus salée ?", "Mer Rouge", "Mer Morte", "Mer Méditerranée", "Mer Caspienne", "Mer Morte",
             "La Mer Morte a une salinité d'environ 34%, soit ~10× celle des océans."},
            {"De quelle couleur est le drapeau japonais ?", "Bleu et blanc", "Blanc et rouge", "Rouge et or", "Vert et blanc", "Blanc et rouge",
             "Le disque rouge symbolise le soleil, surnom du Japon : « pays du soleil levant »."},
        };
        int n = Math.min(count, bank.length);
        List<GameSession.Question> out = new ArrayList<>();
        for (int i = 0; i < n; i++) {
            String[] row = bank[i];
            GameSession.Question q = new GameSession.Question();
            q.setIndex(i);
            q.setQuestionText(row[0]);
            List<String> opts = new ArrayList<>();
            opts.add(row[1]); opts.add(row[2]); opts.add(row[3]); opts.add(row[4]);
            q.setOptions(opts);
            q.setCorrectAnswer(row[5]);
            q.setAiFunFact(row[6]);
            q.setAiWrongExplanation("La bonne réponse est « " + row[5] + " ».");
            q.setRevealed(false);
            out.add(q);
        }
        return out;
    }

    private String repairTruncatedJson(String json) {
        if (json.endsWith("]")) {
            return json;
        }

        log.warn("Attempting to repair truncated JSON...");

        // Find last complete element
        int lastComplete = json.lastIndexOf("},");
        if (lastComplete > 0) {
            json = json.substring(0, lastComplete + 1) + "]";
            log.info("Repaired JSON by removing incomplete element");
        } else {
            // Try basic closure
            json = json + "\"}]";
            log.info("Attempted basic JSON repair");
        }

        return json;
    }

    @SuppressWarnings("unchecked")
    private GameSession.Question convertToQuestion(Map<String, Object> map) {
        GameSession.Question q = new GameSession.Question();
        q.setIndex(map.get("index") != null ? ((Number) map.get("index")).intValue() : 0);
        q.setQuestionText((String) map.get("questionText"));

        List<String> options = (List<String>) map.get("options");
        if (options == null || options.size() != 4) {
            throw new IllegalArgumentException("Question must have exactly 4 options");
        }
        q.setOptions(options);
        q.setCorrectAnswer((String) map.get("correctAnswer"));
        q.setAiFunFact((String) map.getOrDefault("aiFunFact", "Interesting fact!"));
        q.setAiWrongExplanation((String) map.getOrDefault("aiWrongExplanation", "Better luck next time!"));
        q.setRevealed(false);
        return q;
    }

    public String generateFunFact(String questionText, String correctAnswer) {
        String prompt = "Question: " + questionText + "\nCorrect Answer: " + correctAnswer +
                "\nGive a short, fun, educational fact (1-2 sentences). Return only the text, no quotes.";
        try {
            return chatClient.prompt().user(prompt).call().content().trim();
        } catch (Exception e) {
            log.warn("Groq generateFunFact failed: {}", e.getMessage());
            return "La bonne réponse était « " + correctAnswer + " ».";
        }
    }

    public String generateWrongExplanation(String questionText, String correctAnswer, String selectedAnswer) {
        String prompt = "Question: " + questionText +
                "\nCorrect: " + correctAnswer +
                "\nPlayer chose: " + selectedAnswer +
                "\nGive a short, friendly, educational explanation why the correct answer is right. 1-2 sentences. Return only the text.";
        try {
            return chatClient.prompt().user(prompt).call().content().trim();
        } catch (Exception e) {
            log.warn("Groq generateWrongExplanation failed: {}", e.getMessage());
            return "Pas tout à fait — la bonne réponse était « " + correctAnswer + " ».";
        }
    }

    public String generatePlayerTitle(int totalPoints, int correctCount, long avgResponseTimeMs) {
        String prompt = "Player stats: " + totalPoints + " points, " + correctCount +
                " correct, avg time " + avgResponseTimeMs + "ms. " +
                "Give a fun short title (max 5 words) with one emoji. Return only the title, no quotes.";
        try {
            return chatClient.prompt().user(prompt).call().content().trim();
        } catch (Exception e) {
            log.warn("Groq generatePlayerTitle failed: {}", e.getMessage());
            if (correctCount >= 4) return "🏆 Champion du Quiz";
            if (correctCount >= 2) return "🎯 Joueur prometteur";
            return "🌱 Nouveau venu";
        }
    }

    public String generateGameSummary(List<GameLeaderboard.LeaderboardEntry> leaderboard, String category) {
        String prompt = "Write a fun, energetic 3-5 sentence summary for a " + category +
                " trivia game. Highlight the winner and make it positive. Return only the text, no quotes.";
        try {
            return chatClient.prompt().user(prompt).call().content().trim();
        } catch (Exception e) {
            log.warn("Groq generateGameSummary failed: {}", e.getMessage());
            return "🎉 Partie terminée ! Bravo à tous les participants pour ce quiz "
                    + category + ". À la prochaine partie !";
        }
    }
}