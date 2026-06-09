package com.pangochain.backend.chat;

import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;

/**
 * Encryption-at-rest for channel chat bodies. AES-256-GCM with a server-held key; a
 * fresh 12-byte IV is generated per message and prepended to the ciphertext, then the
 * whole thing is base64-encoded for the {@code body_ciphertext} column.
 *
 * This is deliberately NOT end-to-end: channel chat is server-readable (per design
 * decision) so it can fan out in real time to many members. Document encryption remains
 * fully client-side/E2E and is untouched.
 */
@Service
public class ChatCryptoService {

    private static final int IV_LEN = 12;
    private static final int TAG_BITS = 128;

    private final SecureRandom random = new SecureRandom();
    private SecretKeySpec key;

    @Value("${chat.at-rest-key:pangochain-chat-at-rest-key-change-in-production}")
    private String configuredKey;

    @PostConstruct
    void init() throws Exception {
        // Normalize any configured string into a 256-bit key.
        byte[] digest = MessageDigest.getInstance("SHA-256")
                .digest(configuredKey.getBytes(StandardCharsets.UTF_8));
        this.key = new SecretKeySpec(digest, "AES");
    }

    public String encrypt(String plaintext) {
        try {
            byte[] iv = new byte[IV_LEN];
            random.nextBytes(iv);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(TAG_BITS, iv));
            byte[] ct = cipher.doFinal(plaintext.getBytes(StandardCharsets.UTF_8));
            byte[] out = new byte[iv.length + ct.length];
            System.arraycopy(iv, 0, out, 0, iv.length);
            System.arraycopy(ct, 0, out, iv.length, ct.length);
            return Base64.getEncoder().encodeToString(out);
        } catch (Exception e) {
            throw new IllegalStateException("Chat encryption failed", e);
        }
    }

    public String decrypt(String stored) {
        try {
            byte[] all = Base64.getDecoder().decode(stored);
            byte[] iv = new byte[IV_LEN];
            System.arraycopy(all, 0, iv, 0, IV_LEN);
            byte[] ct = new byte[all.length - IV_LEN];
            System.arraycopy(all, IV_LEN, ct, 0, ct.length);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(TAG_BITS, iv));
            return new String(cipher.doFinal(ct), StandardCharsets.UTF_8);
        } catch (Exception e) {
            return "[unable to decrypt message]";
        }
    }
}
