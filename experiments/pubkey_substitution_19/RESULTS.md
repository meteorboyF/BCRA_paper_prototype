# Experiment 19 — Public-Key Substitution (Scenario S3), Closed and Measured

**Status:** measured. 3 protocol-identical runs, all agree. Raw output under
`results/`. Build: branch `write-path-hardening`, chaincode `legalcc v1.1 seq 2`
(RegisterUserKey + GrantAccess binding check), backend anchoring at enrollment.

## Why this experiment exists

S3 was the sharpest residual risk in the prior manuscript: an adversary with
write access to the operational identity table replaces a user's public wrapping
key before a grant is formed, so the grant wraps the document key under the
attacker's key while the ledger commits a cryptographically valid transaction.
The prior paper could only *analyze* this and state that closing it "requires a
ledger-witnessed user-to-key binding, which is not implemented."

It is now implemented and adversarially tested: the enrollment path anchors
`SHA-256(stored public-key JWK)` on the ledger via `RegisterUserKey` (immutable,
first-write-wins), and `GrantAccess` requires the granter to attest the recipient
key hash, refusing the grant when it does not match the anchor.

## Cases (mutations applied directly with psql, reverted between cases)

| # | Case | Result (all 3 runs) |
|---|---|---|
| A | control: grant to a ledger-bound recipient, key unmodified | **HTTP 200, committed** |
| B | attack: substitute recipient public key in the DB, then grant | **HTTP 403 refused** |
| B2 | the refusal is anchored to the audit trail | `ACCESS_GRANT_REJECTED_KEY_MISMATCH` row present |
| C | immutability: attacker re-anchors the substitute key | **REFUSED** ("already anchored; bindings are immutable") |
| D | migration: a genuinely unbound legacy user is still grantable | **HTTP 200**, audited `keyBinding=absent` |

Case D uses `s.chowdhury`, a user enrolled *before* key-anchoring was wired into
registration, so it has no on-chain binding — an authentic pre-feature user, not
a contrived one.

## What this establishes

The forged/substituted key is now **inert on the grant path**: the ledger
decides against a binding the adversary cannot re-anchor, exactly as the forged
*grant row* is inert on the release path (Experiment "db mutation"). The refusal
is deterministic (an endorsement rejection, not a queued retry — the gateway now
distinguishes the two so a policy refusal is never masked as a transient outage)
and is itself anchored, so "denied and audited" holds for substitution as it does
for revoked-credential replay.

## Scope and limits

Migration posture: while any user remains unbound the guarantee is advisory for
that user (the grant proceeds, audited `absent`); closing it fully requires
back-anchoring every enrolled user's key, after which absent-binding grants can
be rejected by configuration. Key rotation is deliberately not supported (the
binding is immutable); consortium-governed re-registration is framework design,
not implemented. The attacker holds the substitute private key by construction;
what is tested is that possession does not help, because the grant never wraps
under the substitute.

## Companion crypto hardening (same branch)

The wrapping construction now interposes HKDF-SHA256 over the ECDH shared secret
(`src/lib/crypto.ts` `deriveWrappingKey`, mirrored in the Experiment 6 harness)
rather than using the raw x-coordinate directly, per NIST SP 800-56C / RFC 9180.
The token format is unchanged (125 bytes), the wrap/unwrap round-trip is verified,
and Experiment 6 re-measured the cost as negligible (wrap P50 0.72 ms, unchanged
within noise). This removes the "not a standardized scheme, no KDF" limitation
and is what makes the "formal analysis is now possible" framing defensible.
