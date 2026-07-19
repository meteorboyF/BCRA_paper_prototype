# Experiment 16 — Orderer-Only Outage Divergence on the Revoke/Release Paths

**Evidence run:** `results/20260719_061017/` (Linux x86_64, Fabric 2.4, 3-org
`legal-channel`, majority endorsement).
**Runner:** `run.sh` (orchestration) + `setup.mjs` (fresh fixture).

## Why this experiment exists

Experiment 9 (`fail_closed_outage/`) stops all **peers**, so both reads and
writes fail and the download path correctly denies (fail-closed). That geometry
cannot exercise the asymmetric failure the architecture is actually exposed to:
an **orderer-only outage**. `CheckAccess` is a Fabric *evaluate* (a query
answered by a peer), while `RevokeAccess` is a *submit* (ordered through the
orderer). If the orderers are down but the peers are up:

- reads (`CheckAccess`, and therefore ciphertext release) keep succeeding
  against last-committed world state, and
- writes (`RevokeAccess`) cannot commit.

The prototype's write paths are availability-first: `AccessControlService.revoke()`
writes the PostgreSQL `revoked_at`, then calls Fabric `revokeAccess`, **catches**
the resulting `FabricException`, logs a warning, and completes normally. So a
revoke issued during an orderer outage updates the database but never reaches the
ledger, and the release path keeps authorizing the "revoked" user from the stale
on-chain grant. This experiment prices that behaviour with raw evidence.

## Method

`setup.mjs` builds a fresh, self-contained fixture through the real REST flows
and the frontend's client-side crypto (`src/lib/crypto.ts` mirror): a new case
owned by LawFirmA, a freshly uploaded browser-encrypted document, and an active
cross-firm read grant to a LawFirmB user (document key ECIES-wrapped under the
grantee's public key). The grant is therefore genuine ledger + DB state, not
injected. `run.sh` then executes a deterministic sequence (no load, no warm-up):
stop the three orderers, drive the revoke/download sequence, capture ledger
(`peer chaincode query`) and DB (`psql`) state, restart the orderers, re-check,
and finally re-anchor the revoke manually. Demo users come from
`ui_retake_seed/seed_state.json`.

## Results

| Step | Action | Result |
|---|---|---|
| 0 | Baseline grantee download, everything healthy | **HTTP 200** |
| 1 | Stop `orderer1/2/3` (peers stay up) | orderers down |
| 2 | Grantee download during outage (evaluate → peer) | **HTTP 200** |
| 3 | Owner revoke during outage (submit → orderer) | **HTTP 204 "success"** |
| 4 | Grantee download **after** the revoke | **HTTP 200, 669 bytes served** |
| 5 | Grantee wrapped-key after the revoke | **HTTP 403** |
| 6 | Ledger `CheckAccess` vs DB row, during outage | **ledger `true` / DB `revoked=t`** |
| 7 | Restart orderers, wait 25 s, re-check ledger (no manual action) | **ledger still `true`** |
| 8 | Manual re-revoke via CLI (majority endorsement), Fabric reachable | commit `VALID` → **ledger `false`** |

Ledger ACL captured during the outage (`ledger_acl_during_outage.json`) shows
both the owner grant and the grantee grant as `ACTIVE` — the revocation never
touched the chain.

## Findings

1. **The divergence is real and observable end to end.** A revoke that returns
   HTTP 204 to the caller leaves the ledger grant `ACTIVE`; the release path
   (`CheckAccess` evaluate → live peer) keeps returning the ciphertext to the
   revoked user (step 4, 669 real bytes).

2. **The exposure under this geometry is bounded to ciphertext, not the
   document key.** The wrapped-key endpoint is gated by the PostgreSQL access
   row, and the DB side of the revoke *did* land, so step 5 is 403. This matches
   the manuscript's ciphertext-vs-key distinction (owner-org fallback releases
   ciphertext only). The residual risk is nonetheless real: a prior grantee
   already holds the wrapped key from legitimate access, so continued ciphertext
   release defeats the revocation for exactly the party revocation targets.

3. **The divergence is permanent, not window-bounded.** After the orderers
   recover, nothing re-anchors the revoke: step 7 shows the ledger still
   authorizes the revoked user with no manual action. The prototype has no
   queued/retried re-anchoring. The divergence persists **until a manual
   re-revoke succeeds while Fabric is reachable** (step 8), which is the only
   thing that clears it.

4. **Experiment 9 structurally cannot catch this** — peers-up is the
   distinguishing condition, and Experiment 9 stops the peers.

## Side observations (not the finding)

- The deployed channel enforces a **majority** endorsement policy: a
  single-peer `RevokeAccess` invoke returns `ENDORSEMENT_POLICY_FAILURE`;
  step 8 succeeds only with all three peers endorsing. Consistent with the
  Experiment 13 majority-policy runs.
- The evaluated `CheckAccess` decision consults a **single peer** in this
  deployment (`FabricConfig` binds one peer endpoint), and its grant-expiry
  timestamp is taken from the client/gateway proposal (`GetTxTimestamp()` on an
  evaluate). These are the code facts behind reviewer findings M4 and M3
  respectively; they are noted here for provenance and addressed in the
  manuscript, not measured by this run.

## Reproduce

```bash
# prerequisites: 3-org network + backend up; demo users seeded
#   (ui_retake_seed/seed_demo.mjs register|flows)
bash experiments/orderer_outage_divergence/run.sh
# raw evidence: experiments/orderer_outage_divergence/results/<stamp>/
```

Each run creates its own throwaway document, so it is safe to repeat; step 8
reconciles that document's ledger state before exiting.
