# Experiment 20 — outbox forgery, tampering, and replay resistance (S2 + round-2)

Final-build runs: `results/20260914_*` (n=3, identical outcomes), legalcc
v1.33 seq 13, gateway with id-covered HMAC and configured signing secret.

| Case | Adversarial action (all via psql) | Outcome |
|---|---|---|
| A control | legitimate grant via API | ledger=true, row signed |
| B forge | insert GrantAccess row, junk signature | FAILED, OUTBOX_ANCHOR_REJECTED_FORGED audit row, ledger never grants |
| C tamper | copy a signed row, retarget the user | FAILED (signature covers target and row id) |
| D replay | after revoke, reset the committed signed grant row to PENDING unchanged | worker resubmits; chaincode refuses "command id already applied"; row marked COMMITTED without re-execution; revoked user stays unauthorized |

Mechanism: each row is HMAC-signed over (id, function, docId, targetUserId,
revokerId, payload) with a secret held only in gateway configuration; the row
id doubles as a one-time command id consumed in chaincode world state
(`CMD:<uuid>`), so unchanged-row replay fails at the ledger even though its
signature verifies. Scope: property of the configured-signing deployment; a
database writer with the gateway's config file defeats the signature; the
fine-grained delegation policy upstream of signing is gateway/DB-enforced.

Earlier 3-case runs (`results/20260907_*`) predate the command-id closure.
