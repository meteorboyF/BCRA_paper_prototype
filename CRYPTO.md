# PangoChain Cryptographic Design

## Principle: Zero-Knowledge Server

The server stores **only ciphertext**. Plaintext never leaves the browser. All encryption, decryption, key generation, and key derivation occur exclusively in the browser via the **WebCrypto API** (`window.crypto.subtle`).

---

## Algorithms

| Purpose | Algorithm | Parameters |
|---|---|---|
| Document encryption | AES-256-GCM | 256-bit key, 12-byte random IV, 128-bit authentication tag |
| Key wrapping (ECIES) | ECDH P-256 + AES-256-GCM | Ephemeral keypair per wrap operation |
| Key pair type (encryption) | ECDH P-256 | `namedCurve: 'P-256'`, extractable for PKCS8 export |
| Key pair type (signing) | ECDSA P-256 | `namedCurve: 'P-256'`, `hash: SHA-256` |
| Password key derivation | PBKDF2-SHA256 | 600,000 iterations (NIST SP 800-132, 2023), 256-bit random salt, 256-bit output key |
| Document integrity | SHA-256 | Hash of plaintext computed before encryption; stored on Fabric ledger |
| Server-side signing verification | ECDSA P-256 | Java `SHA256withECDSAinP1363Format` (SunEC, Java 17+) |
| JWT signing | HMAC-SHA256 | 256-bit secret key |

---

## Key Hierarchy

```
Password (user enters in browser)
  └─ PBKDF2-SHA256 (600k iterations, per-user salt)
       ├─ AES-256-GCM wrapping key
       │    ├─ Wraps ECIES private key (skU) → stored in localStorage
       │    └─ Wraps ECDSA private key (skS) → stored in localStorage
       └─ (key is NOT persisted — rederived from password on each login)

Document AES-256-GCM key (fresh per document)
  └─ ECIES-wrapped per recipient
       └─ Recipient's ECIES public key (pkU) → fetched from server
```

---

## ECIES Key Wrapping Protocol

Used when encrypting a document key for a recipient (upload, or access grant).

```
Sender:
  1. Generate ephemeral ECDH P-256 keypair (ephPk, ephSk)
  2. ECDH(ephSk, recipientPk) → sharedSecret
  3. sharedSecret → AES-256-GCM wrapping key (via SubtleCrypto deriveKey)
  4. Generate random IV (12 bytes)
  5. AES-GCM-Encrypt(wrappingKey, docKeyBytes, IV) → ciphertext
  6. Pack: [ephPkRaw(65 bytes) || IV(12 bytes) || ciphertext(48 bytes)] → base64

Recipient (download):
  1. Parse [ephPkRaw(65) || IV(12) || ciphertext(48)] from base64 blob
  2. ECDH(recipientSk, ephPk) → sharedSecret
  3. sharedSecret → AES-256-GCM wrapping key
  4. AES-GCM-Decrypt(wrappingKey, ciphertext, IV) → docKeyBytes
```

The ephemeral public key is always exported in uncompressed raw format (0x04 prefix, 65 bytes total).

---

## Document Upload Pipeline

```
Browser:
  1. User selects file → ArrayBuffer
  2. SHA-256(plaintext) → hashB64         [for on-chain anchoring + integrity check]
  3. Generate fresh AES-256-GCM key
  4. Generate random IV (12 bytes)
  5. AES-GCM-Encrypt(key, plaintext, IV) → ciphertext
  6. ECIES-wrap(uploaderPublicKey, docKeyBytes) → wrappedKeyToken
  7. POST /api/documents/upload { ipfsCid, wrappedKeyToken, hashB64, metadata }
     (ciphertext uploaded to IPFS separately by backend)

Server:
  8. Store {ciphertext CID, wrappedKeyToken, hashB64} in PostgreSQL
  9. Call RegisterDocument chaincode: {docId, caseId, hashB64, ipfsCid, ownerOrg}
 10. Write audit entry to PostgreSQL + Fabric
```

---

## Document Download Pipeline

```
Browser:
  1. POST request to /api/documents/{id}/ciphertext   → Two-layer ACL
  2. POST request to /api/documents/{id}/wrapped-key  → Two-layer ACL
  3. Load ECIES private key from localStorage:
       a. Retrieve {encryptedB64, saltB64, ivB64}
       b. PBKDF2-SHA256(password, salt) → wrapping key
       c. AES-GCM-Decrypt(wrappingKey, encryptedPrivKey, iv) → raw PKCS8
       d. importKey(pkcs8) → CryptoKey (ECDH, non-extractable)
  4. ECIES-unwrap(privateKey, wrappedKeyToken) → docKeyB64
  5. importKey(docKeyB64) → AES-256-GCM CryptoKey
  6. AES-GCM-Decrypt(docKey, ciphertext, IV[0:12]) → plaintext ArrayBuffer
  7. SHA-256(plaintext) == expectedHashB64 ?
       → PASS: trigger browser file download
       → FAIL: show integrity error; do NOT save file
```

---

## Private Key Storage (localStorage)

Both the ECIES and ECDSA private keys are stored encrypted in `localStorage` under keys `pangochain_key_<userId>` and `pangochain_signing_key_<userId>`.

Each stored object has the structure:
```json
{
  "encryptedB64": "<AES-256-GCM ciphertext of PKCS8-encoded private key>",
  "saltB64":      "<32-byte random PBKDF2 salt>",
  "ivB64":        "<12-byte random AES-GCM IV>"
}
```

The private keys are **never** stored unencrypted. The wrapping key is derived from the user's password via PBKDF2 each time the private key is needed — it is never cached in memory beyond a single operation.

---

## Digital Signature Flow

```
Signing (browser):
  1. Load ECDSA private key from localStorage (PBKDF2 unwrap)
  2. SHA-256(plaintext) → hashBytes
  3. ECDSA-Sign(hashBytes, ecdsaPrivateKey, SHA-256) → signatureBytes (IEEE P1363 format)
  4. POST /api/signatures/{docId}/sign { hashB64, signatureB64, signerPublicKeyJwk }

Verification (server):
  5. Fetch signer's registered ECDSA public key (JWK) from DB
  6. Import JWK → Java ECPublicKey
  7. Signature.getInstance("SHA256withECDSAinP1363Format").verify(signatureBytes, hashBytes)
  8. If valid: store with verification_status=VERIFIED; anchor to Fabric via LogAuditEvent
  9. If invalid: 400 Bad Request
```

---

## Two-Layer Access Control

Every document download goes through two independent access checks:

```
Layer 1 — Spring Security (JWT)
  • JWT role claim checked against @PreAuthorize annotation
  • User must be ACTIVE in the database

Layer 2 — Fabric CheckAccess chaincode
  • CheckAccess(docId, callerId, callerOrg, capability) evaluated on-chain
  • Returns the Grant record if authorised
  • If Fabric unreachable: fallback to PostgreSQL document_access table
    → both audit stores record event type ACL_FABRIC_FALLBACK
```

---

## Audit Integrity

The PostgreSQL `audit_log` table has an INSERT-only trigger. `UPDATE` and `DELETE` operations on this table are rejected at the database level, making the log tamper-evident from the application layer. Fabric's immutable ledger provides a second, cryptographically-linked audit record.

---

## Security Parameters (Summary)

| Parameter | Value | Rationale |
|---|---|---|
| AES key size | 256 bits | Maximum GCM key size; 128-bit security margin |
| AES-GCM IV | 12 bytes (random) | NIST SP 800-38D recommended size for GCM |
| ECDH/ECDSA curve | P-256 | NIST/FIPS 186-4; hardware-accelerated on most platforms |
| PBKDF2 iterations | 600,000 | NIST SP 800-132 (2023) minimum for PBKDF2-SHA-256 |
| PBKDF2 salt | 32 bytes (random) | 256-bit entropy; per-key, never reused |
| JWT signing | HMAC-SHA-256 | Symmetric; secret ≥ 256 bits required |
| ECIES pack size | 65 + 12 + 48 = 125 bytes | ephPub(65) + IV(12) + wrapped(32+16 GCM tag) |
