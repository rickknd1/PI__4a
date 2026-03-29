package com.clubhub.treasury.exception;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(TreasuryException.class)
    public ResponseEntity<Map<String, Object>> handleTreasuryException(TreasuryException ex) {
        return ResponseEntity.status(ex.getStatus()).body(errorBody(ex.getMessage(), ex.getStatus()));
    }

    @ExceptionHandler(jakarta.persistence.EntityNotFoundException.class)
    public ResponseEntity<Map<String, Object>> handleNotFound(Exception ex) {
        return ResponseEntity.status(404).body(errorBody(ex.getMessage(), 404));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleValidation(MethodArgumentNotValidException ex) {
        Map<String, String> errors = new HashMap<>();
        ex.getBindingResult().getFieldErrors().forEach(e -> errors.put(e.getField(), e.getDefaultMessage()));
        Map<String, Object> body = errorBody("Validation failed", 400);
        body.put("errors", errors);
        return ResponseEntity.badRequest().body(body);
    }

    private Map<String, Object> errorBody(String message, int status) {
        Map<String, Object> body = new HashMap<>();
        body.put("timestamp", LocalDateTime.now().toString());
        body.put("status", status);
        body.put("message", message);
        return body;
    }
}
