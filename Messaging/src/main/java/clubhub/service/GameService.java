package clubhub.service;

import clubhub.enums.Difficulty;
import clubhub.enums.GameStatus;
import clubhub.model.GameAnswer;
import clubhub.model.GameLeaderboard;
import clubhub.model.GameSession;
import clubhub.repository.GameAnswerRepository;
import clubhub.repository.GameLeaderboardRepository;
import clubhub.repository.GameSessionRepository;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import java.util.stream.Collectors;

@Service
public class GameService {

    private final GameSessionRepository gameSessionRepository;
    private final GameAnswerRepository gameAnswerRepository;
    private final GameLeaderboardRepository gameLeaderboardRepository;
    private final GroqAiService groqAiService;
    private final ScheduledExecutorService scheduler;
    private final SimpMessagingTemplate messagingTemplate;

    private final Map<String, ScheduledFuture<?>> questionTimers = new ConcurrentHashMap<>();

    public GameService(GameSessionRepository gameSessionRepository,
                       GameAnswerRepository gameAnswerRepository,
                       GameLeaderboardRepository gameLeaderboardRepository,
                       GroqAiService groqAiService,
                       ScheduledExecutorService scheduler,
                       SimpMessagingTemplate messagingTemplate) {
        this.gameSessionRepository = gameSessionRepository;
        this.gameAnswerRepository = gameAnswerRepository;
        this.gameLeaderboardRepository = gameLeaderboardRepository;
        this.groqAiService = groqAiService;
        this.scheduler = scheduler;
        this.messagingTemplate = messagingTemplate;
    }

    // ==================== CREATE ====================

    public GameSession createGame(String conversationId, String createdBy, String category,
                                  Difficulty difficulty, int totalQuestions, int timeLimitPerQuestion) {

        if (gameSessionRepository.findByConversationIdAndStatus(conversationId, GameStatus.WAITING).isPresent() ||
                gameSessionRepository.findByConversationIdAndStatus(conversationId, GameStatus.IN_PROGRESS).isPresent()) {
            throw new IllegalStateException("A game is already active in this conversation.");
        }

        GameSession game = new GameSession();
        game.setConversationId(conversationId);
        game.setCreatedBy(createdBy);
        game.setCategory(category);
        game.setDifficulty(difficulty);
        game.setTotalQuestions(totalQuestions);
        game.setTimeLimitPerQuestion(timeLimitPerQuestion);
        game.setStatus(GameStatus.WAITING);
        game.setPlayers(new ArrayList<>());
        game.getPlayers().add(createdBy);

        List<GameSession.Question> questions = groqAiService.generateQuestions(category, difficulty, totalQuestions);
        for (int i = 0; i < questions.size(); i++) {
            questions.get(i).setIndex(i);
        }
        game.setQuestions(questions);

        GameSession saved = gameSessionRepository.save(game);

        Map<String, Object> payload = new HashMap<>();
        payload.put("type", "GAME_CREATED");
        payload.put("gameId", saved.getId());
        payload.put("category", category);
        payload.put("difficulty", difficulty.name());
        payload.put("totalQuestions", totalQuestions);
        payload.put("timeLimitPerQuestion", timeLimitPerQuestion);
        payload.put("createdBy", createdBy);
        broadcast(conversationId, payload);

        return saved;
    }

    // ==================== JOIN ====================

    public GameSession joinGame(String gameSessionId, String userId) {
        GameSession game = gameSessionRepository.findById(gameSessionId)
                .orElseThrow(() -> new IllegalArgumentException("Game not found: " + gameSessionId));

        if (game.getStatus() == GameStatus.FINISHED) {
            throw new IllegalStateException("Cannot join - game has already finished.");
        }
        if (game.getStatus() == GameStatus.IN_PROGRESS) {
            throw new IllegalStateException("Cannot join - game has already started.");
        }

        if (!game.getPlayers().contains(userId)) {
            game.getPlayers().add(userId);
            gameSessionRepository.save(game);

            Map<String, Object> payload = new HashMap<>();
            payload.put("type", "PLAYER_JOINED");
            payload.put("gameId", gameSessionId);
            payload.put("userId", userId);
            payload.put("playerCount", game.getPlayers().size());
            broadcast(game.getConversationId(), payload);
        }

        return game;
    }

    // ==================== START ====================

    public GameSession startGame(String gameSessionId, String adminUserId) {
        GameSession game = gameSessionRepository.findById(gameSessionId)
                .orElseThrow(() -> new IllegalArgumentException("Game not found"));

        if (!game.getCreatedBy().equals(adminUserId)) {
            throw new IllegalStateException("Only the admin who created the game can start it.");
        }
        if (game.getStatus() != GameStatus.WAITING) {
            throw new IllegalStateException("Game is not in WAITING state.");
        }

        game.setStatus(GameStatus.IN_PROGRESS);
        game.setStartedAt(Instant.now());
        game.setCurrentQuestionIndex(0);
        GameSession saved = gameSessionRepository.save(game);

        Map<String, Object> payload = new HashMap<>();
        payload.put("type", "GAME_STARTED");
        payload.put("gameId", saved.getId());
        payload.put("totalQuestions", saved.getTotalQuestions());
        payload.put("timeLimitPerQuestion", saved.getTimeLimitPerQuestion());
        payload.put("category", saved.getCategory());
        broadcast(saved.getConversationId(), payload);

        // 2 second delay then broadcast first question
        scheduler.schedule(() -> broadcastQuestion(saved, 0), 2, TimeUnit.SECONDS);
        // Timer fires after timeLimit seconds to auto-reveal
        scheduleQuestionTimer(saved, 0);

        return saved;
    }

    // ==================== ANSWER SUBMISSION ====================

    public void submitAnswer(String gameSessionId, int questionIndex, String userId,
                             String selectedAnswer, long responseTimeMs) {

        GameSession game = gameSessionRepository.findById(gameSessionId)
                .orElseThrow(() -> new IllegalArgumentException("Game not found"));

        if (game.getStatus() != GameStatus.IN_PROGRESS) {
            throw new IllegalStateException("Game is not active.");
        }
        if (game.getCurrentQuestionIndex() != questionIndex) {
            throw new IllegalStateException("Question is no longer active.");
        }

        boolean alreadyAnswered = gameAnswerRepository
                .existsByGameSessionIdAndQuestionIndexAndUserId(gameSessionId, questionIndex, userId);
        if (alreadyAnswered) {
            throw new IllegalStateException("You already answered this question.");
        }

        GameSession.Question q = game.getQuestions().get(questionIndex);
        boolean isCorrect = q.getCorrectAnswer().equalsIgnoreCase(selectedAnswer.trim());

        int pointsEarned = 0;
        if (isCorrect) {
            long timeLimitMs = game.getTimeLimitPerQuestion() * 1000L;
            double bonus = ((double)(timeLimitMs - responseTimeMs) / timeLimitMs) * 500;
            pointsEarned = 1000 + (int) Math.max(0, bonus);
        }

        GameAnswer answer = new GameAnswer();
        answer.setGameSessionId(gameSessionId);
        answer.setQuestionIndex(questionIndex);
        answer.setUserId(userId);
        answer.setSelectedAnswer(selectedAnswer);
        answer.setCorrect(isCorrect);
        answer.setResponseTimeMs(responseTimeMs);
        answer.setPointsEarned(pointsEarned);
        gameAnswerRepository.save(answer);

        long answeredCount = gameAnswerRepository
                .countByGameSessionIdAndQuestionIndex(gameSessionId, questionIndex);

        Map<String, Object> answeredPayload = new HashMap<>();
        answeredPayload.put("type", "PLAYER_ANSWERED");
        answeredPayload.put("gameId", gameSessionId);
        answeredPayload.put("questionIndex", questionIndex);
        answeredPayload.put("answeredCount", answeredCount);
        answeredPayload.put("totalPlayers", game.getPlayers().size());
        broadcast(game.getConversationId(), answeredPayload);

        if (answeredCount >= game.getPlayers().size()) {
            cancelQuestionTimer(gameSessionId);
            revealAnswer(gameSessionId, questionIndex);
        }
    }

    // ==================== QUESTION BROADCASTING ====================

    private void broadcastQuestion(GameSession game, int index) {
        GameSession.Question q = game.getQuestions().get(index);

        // ⚠️ Field names MUST match frontend QuestionEvent interface exactly
        Map<String, Object> payload = new HashMap<>();
        payload.put("type", "QUESTION");
        payload.put("gameId", game.getId());
        payload.put("index", index);                          // frontend: event.index
        payload.put("text", q.getQuestionText());             // frontend: event.text
        payload.put("options", q.getOptions());               // frontend: event.options
        payload.put("timeLimit", game.getTimeLimitPerQuestion()); // frontend: event.timeLimit
        payload.put("total", game.getTotalQuestions());       // frontend: event.total
        broadcast(game.getConversationId(), payload);
    }

    // ==================== TIMER ====================

    private void scheduleQuestionTimer(GameSession game, int questionIndex) {
        cancelQuestionTimer(game.getId());
        ScheduledFuture<?> timer = scheduler.schedule(
                () -> revealAnswer(game.getId(), questionIndex),
                game.getTimeLimitPerQuestion(), TimeUnit.SECONDS
        );
        questionTimers.put(game.getId(), timer);
    }

    private void cancelQuestionTimer(String gameSessionId) {
        ScheduledFuture<?> timer = questionTimers.remove(gameSessionId);
        if (timer != null && !timer.isDone()) {
            timer.cancel(false);
        }
    }

    // ==================== REVEAL ====================

    private void revealAnswer(String gameSessionId, int questionIndex) {
        GameSession game = gameSessionRepository.findById(gameSessionId).orElseThrow();
        if (game.getStatus() != GameStatus.IN_PROGRESS) return;

        GameSession.Question question = game.getQuestions().get(questionIndex);
        if (question.isRevealed()) return;

        question.setRevealed(true);
        question.setRevealedAt(Instant.now());
        gameSessionRepository.save(game);

        List<Map<String, Object>> currentScores = buildPartialScores(gameSessionId, game.getPlayers());

        Map<String, Object> payload = new HashMap<>();
        payload.put("type", "ANSWER_REVEAL");
        payload.put("gameId", gameSessionId);
        payload.put("questionIndex", questionIndex);
        payload.put("correctAnswer", question.getCorrectAnswer());
        payload.put("aiFunFact", question.getAiFunFact() != null ? question.getAiFunFact() : "");
        payload.put("scores", currentScores);
        broadcast(game.getConversationId(), payload);

        scheduler.schedule(() -> advanceToNextQuestion(gameSessionId), 4, TimeUnit.SECONDS);
    }

    private void advanceToNextQuestion(String gameSessionId) {
        GameSession game = gameSessionRepository.findById(gameSessionId).orElseThrow();
        if (game.getStatus() != GameStatus.IN_PROGRESS) return;

        int next = game.getCurrentQuestionIndex() + 1;

        if (next >= game.getTotalQuestions()) {
            finishGame(game);
        } else {
            game.setCurrentQuestionIndex(next);
            GameSession saved = gameSessionRepository.save(game);
            broadcastQuestion(saved, next);
            scheduleQuestionTimer(saved, next);
        }
    }

    // ==================== FINISH ====================

    private void finishGame(GameSession game) {
        game.setStatus(GameStatus.FINISHED);
        game.setFinishedAt(Instant.now());
        gameSessionRepository.save(game);

        List<GameLeaderboard.LeaderboardEntry> entries = buildLeaderboard(game.getId(), game.getPlayers());
        String summary = groqAiService.generateGameSummary(entries, game.getCategory());

        GameLeaderboard lb = new GameLeaderboard();
        lb.setGameSessionId(game.getId());
        lb.setConversationId(game.getConversationId());
        lb.setEntries(entries);
        lb.setAiGameSummary(summary);
        gameLeaderboardRepository.save(lb);

        Map<String, Object> payload = new HashMap<>();
        payload.put("type", "GAME_OVER");
        payload.put("gameId", game.getId());
        payload.put("leaderboard", entries);
        payload.put("aiSummary", summary != null ? summary : "");
        broadcast(game.getConversationId(), payload);
    }

    // ==================== LEADERBOARD ====================

    private List<GameLeaderboard.LeaderboardEntry> buildLeaderboard(String gameSessionId,
                                                                    List<String> players) {
        List<GameAnswer> allAnswers = gameAnswerRepository.findByGameSessionId(gameSessionId);
        Map<String, List<GameAnswer>> byUser = allAnswers.stream()
                .collect(Collectors.groupingBy(GameAnswer::getUserId));

        List<GameLeaderboard.LeaderboardEntry> entries = new ArrayList<>();

        for (String userId : players) {
            List<GameAnswer> userAnswers = byUser.getOrDefault(userId, List.of());

            int totalPoints = userAnswers.stream().mapToInt(GameAnswer::getPointsEarned).sum();
            int correct = (int) userAnswers.stream().filter(GameAnswer::isCorrect).count();
            int wrong = userAnswers.size() - correct;
            long avgTime = userAnswers.isEmpty() ? 0L :
                    (long) userAnswers.stream().mapToLong(GameAnswer::getResponseTimeMs).average().orElse(0);

            GameLeaderboard.LeaderboardEntry entry = new GameLeaderboard.LeaderboardEntry();
            entry.setUserId(userId);
            entry.setUsername(userId);
            entry.setTotalPoints(totalPoints);
            entry.setCorrectAnswers(correct);
            entry.setWrongAnswers(wrong);
            entry.setAvgResponseTimeMs(avgTime);
            entry.setAiTitle(assignTitle(totalPoints, correct, avgTime));
            entries.add(entry);
        }

        entries.sort(Comparator.comparingInt(GameLeaderboard.LeaderboardEntry::getTotalPoints).reversed()
                .thenComparingLong(GameLeaderboard.LeaderboardEntry::getAvgResponseTimeMs));

        for (int i = 0; i < entries.size(); i++) {
            entries.get(i).setRank(i + 1);
        }

        return entries;
    }

    private List<Map<String, Object>> buildPartialScores(String gameSessionId, List<String> players) {
        List<GameAnswer> allAnswers = gameAnswerRepository.findByGameSessionId(gameSessionId);

        Map<String, Integer> pointsMap = new HashMap<>();
        for (String p : players) pointsMap.put(p, 0);
        for (GameAnswer a : allAnswers) {
            pointsMap.merge(a.getUserId(), a.getPointsEarned(), Integer::sum);
        }

        return pointsMap.entrySet().stream()
                .sorted(Map.Entry.<String, Integer>comparingByValue().reversed())
                .map(e -> {
                    Map<String, Object> m = new HashMap<>();
                    m.put("userId", e.getKey());
                    m.put("points", e.getValue());
                    return m;
                })
                .collect(Collectors.toList());
    }

    // ==================== AI TITLES ====================

    private String assignTitle(int points, int correct, long avgTimeMs) {
        if (correct == 0)                       return "Still Learning 📚";
        if (avgTimeMs < 3000 && correct >= 4)   return "Speed Demon ⚡";
        if (points > 8000)                      return "Quiz Overlord 🏆";
        if (points > 5000)                      return "Brain Power 🧠";
        if (correct >= 3)                       return "Rising Star ⭐";
        return "Good Try 💪";
    }

    // ==================== HELPERS ====================

    private void broadcast(String conversationId, Map<String, Object> payload) {
        messagingTemplate.convertAndSend("/topic/game/" + conversationId, payload);
    }

    public Optional<GameSession> getActiveGameForConversation(String conversationId) {
        return gameSessionRepository.findByConversationIdAndStatus(conversationId, GameStatus.IN_PROGRESS)
                .or(() -> gameSessionRepository.findByConversationIdAndStatus(conversationId, GameStatus.WAITING));
    }
}