package com.pangochain.backend.esignature;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;

import java.math.BigInteger;
import java.security.*;
import java.security.spec.*;
import java.util.Base64;
import java.util.Map;

/**
 * Verifies ECDSA P-256 signatures produced by the browser's WebCrypto API.
 *
 * WebCrypto ECDSA emits IEEE P1363 format (raw r||s, 64 bytes for P-256).
 * Java's SunEC provider exposes SHA256withECDSAinP1363Format which consumes this directly.
 */
@Slf4j
public final class EcdsaVerifier {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private EcdsaVerifier() {}

    /**
     * Verifies an ECDSA P-256 signature.
     *
     * @param documentHashB64  SHA-256 of the plaintext document, base64-encoded (the data that was signed)
     * @param signatureB64     IEEE P1363 ECDSA signature, base64-encoded
     * @param publicKeyJwkJson JWK JSON string of the signer's P-256 public key (crv=P-256)
     * @return true if the signature is valid for the given data and key
     */
    public static boolean verify(String documentHashB64, String signatureB64, String publicKeyJwkJson) {
        try {
            byte[] docHashBytes = Base64.getDecoder().decode(documentHashB64);
            byte[] sigBytes     = Base64.getDecoder().decode(signatureB64);
            PublicKey ecPublicKey = parseJwkPublicKey(publicKeyJwkJson);

            // SHA256withECDSAinP1363Format: hashes input with SHA-256 then verifies P1363 raw r||s signature
            Signature sig = Signature.getInstance("SHA256withECDSAinP1363Format");
            sig.initVerify(ecPublicKey);
            sig.update(docHashBytes);
            return sig.verify(sigBytes);
        } catch (Exception e) {
            log.warn("ECDSA verification error: {}", e.getMessage());
            return false;
        }
    }

    private static PublicKey parseJwkPublicKey(String jwkJson) throws Exception {
        Map<String, String> jwk = MAPPER.readValue(jwkJson, new TypeReference<>() {});
        byte[] xBytes = decodeBase64Url(jwk.get("x"));
        byte[] yBytes = decodeBase64Url(jwk.get("y"));

        ECPoint point = new ECPoint(new BigInteger(1, xBytes), new BigInteger(1, yBytes));

        AlgorithmParameters params = AlgorithmParameters.getInstance("EC");
        params.init(new ECGenParameterSpec("secp256r1"));
        ECParameterSpec ecSpec = params.getParameterSpec(ECParameterSpec.class);

        ECPublicKeySpec keySpec = new ECPublicKeySpec(point, ecSpec);
        return KeyFactory.getInstance("EC").generatePublic(keySpec);
    }

    private static byte[] decodeBase64Url(String input) {
        // Add padding if missing (WebCrypto JWK omits '=' padding)
        int pad = input.length() % 4;
        if (pad == 2) input = input + "==";
        else if (pad == 3) input = input + "=";
        return Base64.getUrlDecoder().decode(input);
    }
}
