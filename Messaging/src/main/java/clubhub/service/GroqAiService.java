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
            log.error("Failed to generate questions from Groq: {}", e.getMessage());
            throw new RuntimeException("Failed to generate questions from Groq: " + e.getMessage(), e);
        }
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

        return chatClient.prompt().user(prompt).call().content().trim();
    }

    public String generateWrongExplanation(String questionText, String correctAnswer, String selectedAnswer) {
        String prompt = "Question: " + questionText +
                "\nCorrect: " + correctAnswer +
                "\nPlayer chose: " + selectedAnswer +
                "\nGive a short, friendly, educational explanation why the correct answer is right. 1-2 sentences. Return only the text.";

        return chatClient.prompt().user(prompt).call().content().trim();
    }

    public String generatePlayerTitle(int totalPoints, int correctCount, long avgResponseTimeMs) {
        String prompt = "Player stats: " + totalPoints + " points, " + correctCount +
                " correct, avg time " + avgResponseTimeMs + "ms. " +
                "Give a fun short title (max 5 words) with one emoji. Return only the title, no quotes.";

        return chatClient.prompt().user(prompt).call().content().trim();
    }

    public String generateGameSummary(List<GameLeaderboard.LeaderboardEntry> leaderboard, String category) {
        String prompt = "Write a fun, energetic 3-5 sentence summary for a " + category +
                " trivia game. Highlight the winner and make it positive. Return only the text, no quotes.";

        return chatClient.prompt().user(prompt).call().content().trim();
    }
}