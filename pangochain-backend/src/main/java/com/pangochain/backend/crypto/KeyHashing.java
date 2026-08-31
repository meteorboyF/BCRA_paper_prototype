package com.pangochain.backend.crypto;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;

/**
 * Canonical hashing of stored public-key material for the ledger-anchored
 * user-key binding (threat-model S3). The hash is taken over the exact JWK
 * string as stored at registration — the same bytes the API later serves to a
 * granter's browser — so registration-time anchor and grant-time attestation
 * are computed over identical input by construction.
 */
public final class KeyHashing {

    private KeyHashing() {}

    public static String sha256Hex(String storedJwk) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(md.digest(storedJwk.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 unavailable", e);
        }
    }
}
