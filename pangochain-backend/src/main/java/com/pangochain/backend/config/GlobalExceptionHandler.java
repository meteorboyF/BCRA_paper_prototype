package com.pangochain.backend.config;

import com.pangochain.backend.auth.InvalidMfaCodeException;
import com.pangochain.backend.auth.MfaChallengeRequiredException;
import com.pangochain.backend.auth.MfaSetupRequiredException;
import com.pangochain.backend.blockchain.FabricException;
import com.pangochain.backend.document.DocumentService;
import com.pangochain.backend.ipfs.IpfsException;
import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

import java.net.URI;
import java.time.Instant;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.stream.Collectors;

@RestControllerAdvice
@Slf4j
public class GlobalExceptionHandler {

    /**
     * Enriches every ProblemDetail with a machine-readable {@code error} code, an ISO-8601
     * {@code timestamp}, and the request {@code path} — without changing the standard
     * {@code detail}/{@code status} fields the frontend already consumes.
     */
    private ProblemDetail enrich(ProblemDetail detail, String errorCode, HttpServletRequest req) {
        detail.setType(URI.create("about:blank"));
        detail.setProperty("error", errorCode);
        detail.setProperty("timestamp", Instant.now().toString());
        if (req != null) detail.setProperty("path", req.getRequestURI());
        return detail;
    }

    @ExceptionHandler(MfaSetupRequiredException.class)
    public org.springframework.http.ResponseEntity<Map<String, Object>> handleMfaSetupRequired(MfaSetupRequiredException ex) {
        return org.springframework.http.ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(Map.of(
                        "requiresMfaSetup", true,
                        "setupToken", ex.getSetupToken(),
                        "message", ex.getMessage()
                ));
    }

    @ExceptionHandler(MfaChallengeRequiredException.class)
    public org.springframework.http.ResponseEntity<Map<String, Object>> handleMfaChallenge(MfaChallengeRequiredException ex) {
        return org.springframework.http.ResponseEntity.status(HttpStatus.ACCEPTED)
                .body(Map.of(
                        "requiresMfaCode", true,
                        "challengeToken", ex.getChallengeToken(),
                        "message", ex.getMessage()
                ));
    }

    @ExceptionHandler(InvalidMfaCodeException.class)
    public org.springframework.http.ResponseEntity<Map<String, String>> handleInvalidMfa(InvalidMfaCodeException ex) {
        return org.springframework.http.ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(Map.of("error", ex.getMessage()));
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<Map<String, String>> handleAccessDenied(AccessDeniedException ex) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(Map.of("error", "FORBIDDEN", "message", "You do not have permission to perform this action"));
    }

    @ExceptionHandler(DocumentService.AccessDeniedException.class)
    public ResponseEntity<Map<String, String>> handleDocumentAccessDenied(DocumentService.AccessDeniedException ex) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(Map.of("error", "DOCUMENT_ACCESS_DENIED", "message", ex.getMessage()));
    }

    @ExceptionHandler(AuthenticationException.class)
    public ResponseEntity<Map<String, String>> handleAuthentication(AuthenticationException ex) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(Map.of("error", "UNAUTHORIZED", "message", ex.getMessage()));
    }

    @ExceptionHandler({NoSuchElementException.class, IllegalArgumentException.class})
    public ProblemDetail handleNotFound(RuntimeException ex, HttpServletRequest req) {
        return enrich(ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, ex.getMessage()),
                "NOT_FOUND", req);
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ProblemDetail handleResponseStatus(ResponseStatusException ex, HttpServletRequest req) {
        ProblemDetail detail = ProblemDetail.forStatusAndDetail(ex.getStatusCode(), ex.getReason());
        return enrich(detail, "REQUEST_FAILED", req);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ProblemDetail handleValidation(MethodArgumentNotValidException ex, HttpServletRequest req) {
        Map<String, String> errors = ex.getBindingResult().getFieldErrors().stream()
                .collect(Collectors.toMap(FieldError::getField, fe ->
                        fe.getDefaultMessage() != null ? fe.getDefaultMessage() : "Invalid value",
                        (a, b) -> a));
        ProblemDetail detail = ProblemDetail.forStatusAndDetail(
                HttpStatus.BAD_REQUEST, "Validation failed");
        detail.setProperty("errors", errors);
        return enrich(detail, "VALIDATION_ERROR", req);
    }

    /**
     * Blockchain layer unavailable. Protected document-material endpoints fail closed before
     * reading IPFS ciphertext or wrapped-key rows, and emit FABRIC_OUTAGE_ACCESS_DENIED.
     * 503 signals "retry later"; the frontend shows the amber Fabric banner.
     */
    @ExceptionHandler(FabricException.class)
    public ProblemDetail handleFabric(FabricException ex, HttpServletRequest req) {
        log.warn("Fabric unavailable for {}: {}", req != null ? req.getRequestURI() : "?", ex.getMessage());
        return enrich(ProblemDetail.forStatusAndDetail(HttpStatus.SERVICE_UNAVAILABLE,
                "Blockchain network temporarily unavailable. Your request was not lost."),
                "FABRIC_UNAVAILABLE", req);
    }

    @ExceptionHandler(IpfsException.class)
    public ProblemDetail handleIpfs(IpfsException ex, HttpServletRequest req) {
        log.warn("IPFS unavailable for {}: {}", req != null ? req.getRequestURI() : "?", ex.getMessage());
        return enrich(ProblemDetail.forStatusAndDetail(HttpStatus.SERVICE_UNAVAILABLE,
                "Document storage temporarily unavailable. Please retry shortly."),
                "STORAGE_UNAVAILABLE", req);
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ProblemDetail handleDataIntegrity(DataIntegrityViolationException ex, HttpServletRequest req) {
        log.warn("Data integrity violation for {}: {}", req != null ? req.getRequestURI() : "?", ex.getMessage());
        return enrich(ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT,
                "The request conflicts with existing data."),
                "CONFLICT", req);
    }

    @ExceptionHandler(Exception.class)
    public ProblemDetail handleGeneral(Exception ex, HttpServletRequest req) {
        log.error("Unhandled exception", ex);
        // Never leak the raw exception message — it can reveal internal class names / paths.
        return enrich(ProblemDetail.forStatusAndDetail(
                HttpStatus.INTERNAL_SERVER_ERROR, "An unexpected error occurred"),
                "INTERNAL_ERROR", req);
    }
}
