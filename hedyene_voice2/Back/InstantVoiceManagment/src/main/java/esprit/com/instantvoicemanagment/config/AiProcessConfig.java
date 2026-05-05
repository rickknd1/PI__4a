package esprit.com.instantvoicemanagment.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.DisposableBean;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.concurrent.TimeUnit;

@Component
public class AiProcessConfig implements DisposableBean {

    private static final Logger log = LoggerFactory.getLogger("AI-Moderation");

    @Value("${ai.service.script:../AudioModerationService/main.py}")
    private String scriptPath;

    @Value("${ai.service.python:}")
    private String pythonPath;

    @Value("${ai.moderation.base-url:http://localhost:8001}")
    private String moderationBaseUrl;

    private Process process;

    @EventListener(ApplicationReadyEvent.class)
    public void start() {
        new Thread(this::launchPython, "ai-launcher").start();
    }

    private void launchPython() {
        try {
            Path script = resolveScriptPath();
            if (script == null) {
                log.warn("[AI] Script not found (checked configured path and common fallbacks) — moderation service will not start");
                return;
            }

            String python = resolvePython(script.getParent());
            log.info("[AI] ──────────────────────────────────────────");
            log.info("[AI] Starting Python moderation service");
            log.info("[AI] Script : {}", script);
            log.info("[AI] Python : {}", python);
            log.info("[AI] ──────────────────────────────────────────");

            ProcessBuilder pb = new ProcessBuilder(python, script.toString());
            pb.directory(script.getParent().toFile());
            pb.redirectErrorStream(true); // merge stderr into stdout so we see everything
            // Force UTF-8 so Arabic/French transcripts don't blow up on Windows cp1252 stdout
            pb.environment().put("PYTHONIOENCODING", "utf-8");
            pb.environment().put("PYTHONUTF8", "1");
            String moderationPort = "8001";
            try {
                java.net.URI uri = java.net.URI.create(moderationBaseUrl);
                if (uri.getPort() > 0) {
                    moderationPort = String.valueOf(uri.getPort());
                }
            } catch (Exception ignored) {}
            pb.environment().put("MODERATION_PORT", moderationPort);

            process = pb.start();

            // Pipe all Python output into the IntelliJ console via SLF4J
            new Thread(() -> {
                try (BufferedReader reader = new BufferedReader(
                        new InputStreamReader(process.getInputStream(), java.nio.charset.StandardCharsets.UTF_8))) {
                    String line;
                    while ((line = reader.readLine()) != null) {
                        log.info("[AI] {}", line);
                    }
                } catch (IOException e) {
                    if (process.isAlive()) {
                        log.error("[AI] Log stream error: {}", e.getMessage());
                    }
                }
                if (process.exitValue() != 0) {
                    log.error("[AI] Python process exited with code {}", process.exitValue());
                } else {
                    log.info("[AI] Python process stopped cleanly.");
                }
            }, "ai-log-reader").start();

        } catch (Exception e) {
            log.error("[AI] Failed to start Python service: {}", e.getMessage());
        }
    }

    private Path resolveScriptPath() {
        Path configured = Path.of(scriptPath).toAbsolutePath().normalize();
        if (Files.exists(configured)) {
            return configured;
        }

        Path userDir = Path.of(System.getProperty("user.dir")).toAbsolutePath().normalize();
        Path[] fallbacks = new Path[] {
                userDir.resolve("Back/AudioModerationService/main.py").normalize(),
                userDir.resolve("../Back/AudioModerationService/main.py").normalize(),
                userDir.resolve("../AudioModerationService/main.py").normalize(),
                userDir.resolve("hedyene_voice2/Back/AudioModerationService/main.py").normalize()
        };
        for (Path p : fallbacks) {
            if (Files.exists(p)) {
                log.info("[AI] Resolved moderation script fallback: {}", p);
                return p;
            }
        }
        return null;
    }

    private String resolvePython(Path scriptDir) {
        if (pythonPath != null && !pythonPath.isBlank()) {
            return pythonPath;
        }
        Path localVenv = scriptDir.resolve(".venv").resolve("Scripts").resolve("python.exe").normalize();
        if (Files.exists(localVenv)) {
            return localVenv.toString();
        }
        for (String candidate : new String[]{"py", "python", "python3"}) {
            try {
                Process probe = new ProcessBuilder(candidate, "--version")
                        .redirectErrorStream(true)
                        .start();
                if (probe.waitFor(3, TimeUnit.SECONDS) && probe.exitValue() == 0) {
                    return candidate;
                }
            } catch (Exception ignored) {}
        }
        log.warn("[AI] Could not auto-detect Python — falling back to 'python'");
        return "python";
    }

    @Override
    public void destroy() {
        if (process != null && process.isAlive()) {
            log.info("[AI] Shutting down Python moderation service...");
            process.destroy();
            try {
                if (!process.waitFor(10, TimeUnit.SECONDS)) {
                    process.destroyForcibly();
                }
            } catch (InterruptedException ignored) {
                Thread.currentThread().interrupt();
            }
        }
    }
}
