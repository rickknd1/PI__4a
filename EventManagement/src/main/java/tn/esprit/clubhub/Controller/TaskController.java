package tn.esprit.clubhub.Controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import tn.esprit.clubhub.Repository.TaskRepository;
import tn.esprit.clubhub.Entity.Task;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

// Dans votre TaskController.java (backend Spring Boot)
@RestController
@RequestMapping("/api/tasks")
public class TaskController {

    @Autowired
    private TaskRepository taskRepository;

    // GET toutes les tâches
    @GetMapping
    public ResponseEntity<List<Task>> getAllTasks() {
        return ResponseEntity.ok(taskRepository.findAll());
    }

    // GET tâches par utilisateur
    @GetMapping("/user/{userId}")
    public ResponseEntity<List<Task>> getTasksByUser(@PathVariable String userId) {
        return ResponseEntity.ok(taskRepository.findByAssignedTo(userId));
    }

    // GET tâches par événement
    @GetMapping("/event/{eventId}")
    public ResponseEntity<List<Task>> getTasksByEvent(@PathVariable String eventId) {
        return ResponseEntity.ok(taskRepository.findByEventId(eventId));
    }

    // POST créer une tâche
    @PostMapping
    public ResponseEntity<Task> createTask(@RequestBody Task task) {
        task.setCreatedAt(LocalDateTime.now());
        task.setUpdatedAt(LocalDateTime.now());
        return ResponseEntity.ok(taskRepository.save(task));
    }

    // PUT mettre à jour une tâche
    @PutMapping("/{id}")
    public ResponseEntity<Task> updateTask(@PathVariable String id, @RequestBody Task task) {
        task.setId(id);
        task.setUpdatedAt(LocalDateTime.now());
        return ResponseEntity.ok(taskRepository.save(task));
    }

    // PATCH mettre à jour le statut
    @PatchMapping("/{id}/status")
    public ResponseEntity<Task> updateStatus(@PathVariable String id, @RequestBody Map<String, String> body) {
        Task task = taskRepository.findById(id).orElseThrow();
        String newStatus = body.get("status");
        task.setStatus(newStatus);
        task.setUpdatedAt(LocalDateTime.now());
        // Clear completion metadata if task is re-opened
        if (!"done".equalsIgnoreCase(newStatus)) {
            task.setCompletedAt(null);
            task.setCompletionNote(null);
            task.setCompletionOutcome(null);
            task.setCompletionReason(null);
        }
        return ResponseEntity.ok(taskRepository.save(task));
    }

    /**
     * PATCH /api/tasks/{id}/complete — mark a task as done with a structured
     * completion review (outcome, note, optional reason). Prevents "click end
     * and that's it" by forcing the caller to supply at least an outcome.
     */
    @PatchMapping("/{id}/complete")
    public ResponseEntity<?> completeTask(@PathVariable String id, @RequestBody Map<String, String> body) {
        Task task = taskRepository.findById(id).orElse(null);
        if (task == null) return ResponseEntity.notFound().build();

        String outcome = body.getOrDefault("outcome", "").trim().toLowerCase();
        String note    = body.getOrDefault("note", "").trim();
        String reason  = body.getOrDefault("reason", "").trim();

        if (outcome.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "Outcome is required (success | partial | skipped)"
            ));
        }
        if (!outcome.equals("success") && !outcome.equals("partial") && !outcome.equals("skipped")) {
            return ResponseEntity.badRequest().body(Map.of("error", "Invalid outcome value"));
        }
        if (!outcome.equals("success") && reason.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "A reason is required when outcome is not 'success'"
            ));
        }

        task.setStatus("done");
        task.setCompletionOutcome(outcome);
        task.setCompletionNote(note);
        task.setCompletionReason(reason.isEmpty() ? null : reason);
        task.setCompletedAt(LocalDateTime.now());
        task.setUpdatedAt(LocalDateTime.now());

        return ResponseEntity.ok(taskRepository.save(task));
    }

    // DELETE supprimer une tâche
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteTask(@PathVariable String id) {
        taskRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }
}