package com.pangochain.backend.auth;

import com.pangochain.backend.crypto.Pbkdf2Service;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Issues and validates single-use TOTP recovery codes. Codes are high-entropy
 * (10 chars of Crockford base32 → ~50 bits) and stored only as PBKDF2-SHA256 hashes.
 */
@Service
@RequiredArgsConstructor
public class RecoveryCodeService {

    public static final int CODE_COUNT = 10;
    private static final int GROUP = 5; // formatted as XXXXX-XXXXX
    private static final char[] ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ".toCharArray(); // Crockford base32

    private final UserRecoveryCodeRepository repository;
    private final Pbkdf2Service pbkdf2Service;
    private final SecureRandom random = new SecureRandom();

    /** Regenerate a fresh set of codes, invalidating any previous ones. Returns plaintext (shown once). */
    @Transactional
    public List<String> regenerate(UUID userId) {
        repository.deleteAllForUser(userId);
        List<String> plaintext = new ArrayList<>(CODE_COUNT);
        for (int i = 0; i < CODE_COUNT; i++) {
            String code = randomCode();
            plaintext.add(code);
            String salt = pbkdf2Service.generateSalt();
            repository.save(UserRecoveryCode.builder()
                    .userId(userId)
                    .salt(salt)
                    .codeHash(pbkdf2Service.hash(normalize(code), salt))
                    .build());
        }
        return plaintext;
    }

    /** How many unused codes remain for the user. */
    public long remaining(UUID userId) {
        return repository.countByUserIdAndUsedFalse(userId);
    }

    /**
     * Validate a submitted recovery code against the user's unused codes. On a match the code
     * is consumed (marked used) and {@code true} is returned. Comparison is constant-time per code.
     */
    @Transactional
    public boolean consume(UUID userId, String submitted) {
        if (submitted == null || submitted.isBlank()) return false;
        String candidate = normalize(submitted);
        for (UserRecoveryCode code : repository.findByUserIdAndUsedFalse(userId)) {
            if (pbkdf2Service.verify(candidate, code.getSalt(), code.getCodeHash())) {
                code.setUsed(true);
                code.setUsedAt(Instant.now());
                repository.save(code);
                return true;
            }
        }
        return false;
    }

    private String randomCode() {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < GROUP * 2; i++) {
            if (i == GROUP) sb.append('-');
            sb.append(ALPHABET[random.nextInt(ALPHABET.length)]);
        }
        return sb.toString();
    }

    /** Case-insensitive, dash/space-insensitive so users can type codes loosely. */
    private static String normalize(String code) {
        return code.toUpperCase().replaceAll("[^0-9A-Z]", "");
    }
}
