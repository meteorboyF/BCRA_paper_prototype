# Peer Review Remediation Log

Tracks work done against `bra_submission/bcra_peer_review.md` (Part II's numbered
remediation list), one item at a time. Updated as each item is addressed —
this is a living log, not a single-session snapshot.

Two clones are in play, same as `SESSION_CHANGES_2026-07-19.md`:

- **manuscript clone** — `~/Projects/Blockchain/Fardeen_Codex_Dhaka_Meetup_Hackathon`
  (`bra_submission/main.tex`, on branch `bra-submission`)
- **code clone** — `~/Projects/Blockchain/FCDH_linux_validation/Fardeen_Codex_Dhaka_Meetup_Hackathon`
  (full source tree + experiments + live Docker network, branch `prototype-fixes`)

## Status

| # | Peer review item | Status |
|---|---|---|
| 1 | M1 — Silent revocation failure under orderer outage | **Done — code fixed, validated live (Exp 16b, n=5), manuscript updated and rebuilt.** |
| 2–23 | Everything else in Part II | Not started |

---

## Item 1 — M1: Silent revocation failure (Tier 1 Blocker #1)

**Peer review claim (`bcra_peer_review.md` §8, §Tier 1 item 1):** `RevokeAccess`
returned HTTP 204 while the Fabric submit silently failed and was only logged.
The on-chain grant stayed `ACTIVE` forever after an orderer outage, with no
reconciliation — contradicting Table 1's `Rev = Y`, the FRCP 26(b)(5)(B)
clawback claim in Sec. 3.1, and the abstract (which describes fail-closed
reads and says nothing about fail-open writes).

### Code changes (code clone, `prototype-fixes`)

All under `pangochain-backend/src/main/java/com/pangochain/backend/access/`
unless noted.

1. **New `PendingAnchor` entity + `pending_anchor` table**
   (`PendingAnchor.java`, `PendingAnchorRepository.java`,
   `db/changelog/changes/027-pending-anchor.sql`). Durable outbox row:
   chaincode function, doc/target/revoker ids, status
   (`PENDING`/`COMMITTED`/`FAILED`), attempt count, next-attempt time,
   fabric tx id, last error.

2. **`AccessControlService.revoke()` rewritten** to write the DB revoke and a
   `PendingAnchor` row in the *same* `@Transactional` method. The inline
   Fabric call is still attempted first (fast path — most revokes still
   commit immediately); on `FabricException` the anchor is left `PENDING`
   instead of the failure being merely logged. Returns a new
   `RevokeResult(ledgerCommitted, fabricTxId, pendingAnchorId)` instead of
   `void`.

3. **New `AnchorReconciliationWorker`** (`@Scheduled(fixedDelay=5000)`)
   drains `PENDING` anchors and retries with capped exponential backoff
   (5 s base, **60 s cap**, both configurable via `access.anchor-retry.*`).
   The cap was deliberately lowered from an initial 300 s: it bounds how long
   a revoked user stays ledger-authorized *after Fabric is already healthy*,
   which is the only part of the divergence window the system controls, and
   retries are cheap because the resilience4j breaker fast-fails them while
   open. The Exp 16b measurements are unaffected — every run reconciled on its
   first retry (10 s backoff), so the cap never engaged. On success, writes a new audit event
   `ACCESS_REVOKED_LEDGER_SYNCED` with the measured divergence window
   (`committed_at - created_at`). Live-tested: a stuck anchor from this
   session correctly climbed through 8 retries with the backoff capping at
   300s and `status` staying `PENDING` (durable, not dropped) — see
   Validation below.

4. **API contract changed**
   (`AccessControlController.revoke`, new `RevokeResponseDto`): `DELETE
   /api/access/{docId}/user/{userId}` now returns **204** only once the
   ledger anchor has actually committed, and **202 Accepted** with
   `{"ledgerSyncStatus":"pending","pendingAnchorId":...}` when it's queued.
   Previously always 204 regardless of ledger outcome.

5. **Audit trail surfaces sync status**: the `ACCESS_REVOKED` audit entry's
   `metadataJson` now includes `ledgerSyncStatus` (`committed`/`pending`)
   and `pendingAnchorId`, visible via `GET /api/audit`. A later
   `ACCESS_REVOKED_LEDGER_SYNCED` entry appears once the outbox drains,
   giving a queryable two-entry trail instead of one static row.

Compiles clean (`./mvnw -q -o compile`, exit 0). No test suite exists in this
project to extend (`pangochain-backend/src/test` doesn't exist), consistent
with how correctness here is otherwise established — via the `experiments/`
scripts against the live network.

**Frontend note (not changed):** `pangochain-frontend/src/components/TeamAccessPanel.tsx`
calls `api.delete(...)` and only checks for success; axios treats both 204
and 202 as success, so nothing breaks, but the UI doesn't yet surface
`ledgerSyncStatus: pending` to the user. Flagged as a follow-up, not done
here — out of scope for the backend correctness fix.

**Known gap not covered by this fix:** `AccessControlService.grant()` has the
identical fire-and-forget pattern (`catch (FabricException e) { log.warn(...) }`,
no outbox) — the peer review didn't flag grants specifically (M1 is about
revocation), but it's the same class of bug on the other write path. Not
touched in this pass; worth its own item if you want it addressed.

### Experiment 16b (code clone, `experiments/orderer_outage_reconciliation_16b/`)

New script `run.sh`, re-running the exact Experiment 16 scenario (orderer-only
outage, peers up) against the fixed code. Differences from Exp 16: expects
202 (not 204) during the outage, and instead of one manual re-revoke, polls
after orderer recovery for automatic reconciliation (ledger flips to `false`
*and* `pending_anchor.status = COMMITTED`) with no manual action, reporting
the wall-clock divergence window.

### Validation status: complete (n = 5)

Ran live against the full local stack (3-org Fabric network, Postgres,
backend). All five runs behaved identically; full write-up and raw evidence in
`experiments/orderer_outage_reconciliation_16b/RESULTS.md`.

**Headline result — the M1 defect is gone:**

| | Exp 16 (pre-fix) | Exp 16b (post-fix) |
|---|---|---|
| Revoke response during outage | HTTP **204 "success"** (silent lie) | HTTP **202** + `ledgerSyncStatus: pending` |
| After orderers recover, no manual action | ledger **still authorizes** revoked user | ledger **`false`**, anchor `COMMITTED` |
| Download after recovery | **200 permanently** | **403** |
| Divergence | **permanent** until manual re-revoke | **median 15.9 s** (mean 15.85, SD 0.69, range 14.86–16.51, n=5) |

Every run reconciled on the first retry. The window is dominated by Raft
leader re-election, not by the outbox — see RESULTS.md finding 3.

**Unchanged by the fix, and stated as such in RESULTS.md:** ciphertext is still
released to the revoked user *during* the outage (steps 4–5 are identical to
Exp 16). The fix bounds how long the divergence lasts; it does not make reads
fail-closed under an orderer-only outage.

#### Correction to an earlier claim in this log

An earlier revision of this file said the backend's `evaluate` (read) calls
were succeeding while only `submit` failed. **That was wrong.** Both were
failing. Reads only appeared to work because `scripts/dev.sh` starts the
backend with `DOCUMENT_MATERIAL_DB_FALLBACK=true`, so `CheckAccess` failures
fell back to the PostgreSQL ACL (visible as `ACL_FABRIC_FALLBACK` audit
events). Anyone running these experiments under the `dev.sh` default is not
measuring the shipped fail-closed behaviour — commit `fc50593` set the
shipped default to `false`. Exp 16b was run with it explicitly set to `false`.

#### Root cause of the earlier "Gateway client" failure — resolved

Not a gRPC/channel-lifecycle bug as I first guessed. The backend's Fabric
credentials under `pangochain-backend/config/fabric/crypto/` (gitignored) were
**stale copies** of crypto material that `pangochain-fabric` had since
regenerated:

- backend's `tls-ca-cert.pem`: `65:2B:75:BB:…` (dated Jul 19)
- live network's tlsca cert: `F7:7A:2A:2F:…` (regenerated Jul 30 17:42)

The admin signcert was stale too. Every Fabric call failed at the TLS
handshake with `UNAVAILABLE: io exception`, which reads exactly like a network
outage. The Fabric CLI was unaffected because it uses the container's current
material. Fixed by copying the current tlsca cert, Admin signcert, and Admin
`keystore/priv_sk` into the backend's crypto dir (old ones backed up first;
verified the key matches the cert). This is a **recurring trap** whenever the
network is regenerated — now documented in RESULTS.md's Reproduce section.

### Manuscript / figures that need updating

Exp 16b's numbers now exist (median **15.9 s**, mean 15.85, SD 0.69, range
14.86–16.51, n=5, all reconciling on the first retry), so these edits are
ready to make. **None have been made yet** — this is the edit map, in
`bra_submission/main.tex` (branch `bra-submission`, manuscript clone):

| Location | Current text | Needed change |
|---|---|---|
| Abstract, line 160 | "...outage experiments confirm zero successful downloads during Fabric unavailability with automatic recovery." — reads only, no write-path mention | Add a clause on the write path: revocation during an outage now queues durably and auto-reconciles within a measured window (was: silently lost). |
| Table 1, line 519–523 (`tab:literature_review`) | Row "Proposed framework and prototype": `Rev` column = **Y**, limitation clause doesn't mention the (pre-fix) revocation gap at all | `Rev = Y` becomes actually supportable post-fix (was unsupportable pre-fix per M1). Update the limitation clause to note the bounded, measured divergence window instead of omitting it. |
| Sec. 3.1, lines 856–857 | "...the revocation is committed as a ledger transaction both parties can see" (unqualified, mapped to FRCP 26(b)(5)(B) clawback) | Now true after the anchor commits (possibly asynchronously); add a clause on the bounded sync window during an outage. |
| Sec. 7.1, line 3513 | Full paragraph describing the pre-fix defect in detail (fire-and-forget writes, no re-anchoring, permanent divergence) — this paragraph is now **stale**, it describes the bug this fix removes | Rewrite to describe the outbox/backoff fix and cite Experiment 16b's measured divergence window in place of "does not self-heal." |
| Sec. 6 / `sec:exp_orderer_outage`, line 3323 (Experiment 16) | Documents the pre-fix permanent-divergence finding | Add Experiment 16b as a follow-up subsection, per **remediation item 1**: "stop orderers → revoke → show the anchor queues → restart → show it drains → show CheckAccess now denies. Report the divergence window duration." Source: `experiments/orderer_outage_reconciliation_16b/RESULTS.md`. |
| Line 3233 | "Experiments~1--15; Experiment~16 is behavioral and…" | Update the experiment enumeration to account for 16b. |
| Fig. at line 1529 (`fig:failclosed`, two-layer access control pipeline) | Depicts only the read path's fail-closed behavior | No change strictly required (it's accurate for reads), but **a new figure is now warranted**: no diagram depicts the write path, and the outbox → worker → re-anchor flow with the measured window is the paper's most novel post-fix result. Consider a write-path companion to `fig:failclosed`. |

#### Manuscript edits — DONE

All six edits above were made in `bra_submission/main.tex` on `bra-submission`
and the PDF was rebuilt. **105 pages committed → 108 pages now; overfull boxes
unchanged at 16; zero undefined references or citations.** (Of the 3-page
growth, 1 page is a co-author's in-flight figure-caption work that was already
uncommitted in the tree when this pass started — see note below.)

1. **Abstract** — added a write-path clause. The abstract previously described
   fail-closed reads only, which the review called a material overstatement of
   the security posture.
2. **Table 1** (`tab:literature_review`, "Proposed framework and prototype"
   row) — `Rev = Y` retained, now supportable, with the limitation clause
   rewritten to state that an outage delays rather than loses a revocation
   while the release path still authorizes from last-committed state.
3. **Sec. 3.1 clawback** — rewritten. This was the mandatory one: the FRCP
   26(b)(5)(B) mapping now says clawback is *eventually* ledger-verifiable, and
   states plainly that during the outage a recipient already holding the
   wrapped key can still retrieve ciphertext — i.e. revocation is delayed
   against exactly the party it targets.
4. **Sec. 7.1** — the stale paragraph asserting "the prototype performs *no*
   automatic re-anchoring" was replaced with three paragraphs: what the outbox
   does, what Exp 16b measured, and the two remaining limitations (grant path
   still best-effort; read-side staleness bound deferred to the M2 mechanism).
5. **New Sec. 6 subsection** — "Experiment 16b: Bounded Reconciliation After
   Durable Re-Anchoring" (`\label{sec:exp_orderer_reconcile}`), placed directly
   after Experiment 16, with a forward-pointing sentence added to Exp 16.
6. **Experiment enumeration** — "Experiments 1–15; Experiment 16 is
   behavioral" → "Experiments 16 and 16b are behavioral."

**Watch item — abstract length.** The write-path clause was first drafted at
three sentences, pushing the abstract 228 → 300 words. It is now compressed to
one sentence, landing at **260 words**. Elsevier/KeAi commonly cap abstracts
near 250, and the author had deliberately held it at 228, so **verify against
BCRA's current guide for authors**; if 250 is enforced, ~10 words need trimming
somewhere in the abstract.

**Note on concurrent work.** When this pass began, `main.tex` already had
uncommitted co-author edits — figure-caption rewrites dropping the "predate the
final design" caveats, with matching redrawn figure PDFs (that is review item
30). Those edits are in different regions and did not collide, but the working
tree now contains **both** their changes and mine, unseparated. Worth splitting
into two commits.

**Framing opportunity (peer review M4 / remediation item 15).** The review
argued the novelty delta was thin and suggested leading with "measured
asymmetric failure behavior: fail-closed reads vs. availability-first writes,
with the divergence window quantified" as contribution #2. That claim is now
*measurable and defensible* rather than aspirational — reads fail closed
(Exp 9), writes are availability-first but bounded at a measured median
15.9 s (Exp 16b). Worth restructuring the contributions list around this when
item 15 is taken up.

**Honesty constraint for whoever writes this up:** Exp 16b does **not** show
the outage exposure is eliminated — ciphertext still reaches the revoked user
during the outage window. Claim "bounded and self-healing divergence," not
"revocation is now safe under outage." The n=5 single-geometry limitation and
the unfixed `grant()` path (see above) should be stated, not omitted.

---

## Environment notes for next session

- The full local stack (Postgres, 2× IPFS, 3-org Fabric network + chaincode,
  backend, frontend) was brought up via `bash scripts/dev.sh start` and was
  left running at the end of this session for possible continued debugging.
- Added a **local `/etc/hosts` entry** (not committed, host-only) resolving
  `orderer{1,2,3}.pangochain.com`, `peer0.{firma,firmb,regulator}.pangochain.com`,
  and `ca.{firma,firmb,regulator}.pangochain.com` to `127.0.0.1`. This turned
  out **not** to be the fix for the connection failure (the backend only ever
  dials `localhost:7051`, per `fabric.peer-endpoint` in `application.yml` — it
  never resolves those hostnames directly; the real cause was the stale certs
  above). Harmless, and generically useful for host-side Fabric CLI tooling.
  Safe to leave or remove.
- **Refreshed the backend's Fabric crypto material** (see root-cause section
  above). Old certs backed up to the session scratchpad. This directory is
  gitignored, so nothing is committed — but it means **a fresh clone or a
  regenerated network needs this step again**, and there is currently no
  script that does it. Worth adding one to `scripts/` if the experiments get
  re-run often.
- Backend was run manually (not via `dev.sh`) for the final runs, specifically
  to set `DOCUMENT_MATERIAL_DB_FALLBACK=false`:
  ```
  set -a; source .env; set +a
  cd pangochain-backend
  FABRIC_ENABLED=true DOCUMENT_MATERIAL_DB_FALLBACK=false ./mvnw -q spring-boot:run
  ```
  Note `dev.sh` does not source `.env` into the manual path — sourcing it is
  required or Liquibase fails on the DB password.
