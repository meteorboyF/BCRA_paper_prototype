# Write-Path Divergence: Taxonomy and Exposure Bound

Working notes feeding the paper's rewritten Section on write-path behavior.
Everything here is grounded in a measurement (16, 16b, 18) or in the retry
schedule's constants; nothing is asserted beyond them.

## 1. The taxonomy

Every availability-first write can diverge during an ordering outage: the
operational store advances, the ledger does not. What the divergence *costs*
depends on which store the affected decision reads, and that is what the
taxonomy classifies. On-path enforcement reads authorization from the ledger,
so divergence of an access-control write converts into precisely the failure
that write was meant to prevent.

| Write | Decision that reads it | Divergence exposure | Class | Bounded by | Response contract |
|---|---|---|---|---|---|
| `RevokeAccess` | release-path `CheckAccess` | revoked user still authorized (Exp. 16: permanent, silent, 204) | **confidentiality** | outbox (16b): median 15.9 s after recovery | 202 + `pending` |
| `GrantAccess` | release-path `CheckAccess` | authorized user still denied (Exp. 18) | **availability** | outbox (18): median 14.4 s after recovery | 202 + `pending` |
| `RegisterDocument` | none on the release path — registration also writes the owner grant, whose absence *denies* | document exists off-ledger only; owner denied until anchored | **availability + provenance** | not bounded (fire-and-forget); measured only as upload failure logging | 200 regardless |
| `LogAuditEvent` | audit verification, off the release path | event unverifiable on-chain until anchored | **evidentiary** | optional batched pipeline (14b), ships disabled | n/a (async) |

Two structural observations the paper can now state affirmatively:

1. **The exposure class is determined by the read side, not the write side.**
   Grant and revoke traverse identical machinery in opposite semantic
   directions, and their exposures are mirror images: confidentiality vs
   availability. Nothing about the outbox distinguishes them; the release
   path's fail-closed read is what converts "stale grant state" into one harm
   or the other.
2. **Safety-motivated fail-closed reads convert grant divergence into denial.**
   A design that fell back to the operational ACL would serve the new grantee
   during the outage — and also serve the revoked user. Fail-closed reads and
   availability-first writes jointly imply: divergence hurts availability for
   grants and confidentiality for revocations, never the reverse.

## 2. The exposure-window bound

Notation: outage duration T (ordering unreachable), worker poll interval
δ = 5 s, backoff schedule min(b·2^k, c) with b = 5 s, c = 60 s, commit time
t_commit (endorse+order+commit of the replayed anchor), Raft re-election lag
t_elect after orderer restart.

The divergence window decomposes (Eq. divergence_window in the paper) as
W = T + T_rec, and the mechanism controls only T_rec. The retry schedule gives
a *worst-case* reconciliation lag:

    T_rec  <=  min(b·2^(k*), c) + t_elect + t_commit
           <=  c + t_elect + t_commit                         (schedule cap)

where k* is the attempt count reached during the outage — the retry that was
scheduled just before recovery may have been pushed up to the cap into the
future. For outages long enough that the schedule saturates (T >~ 65 s of
consecutive failures), the bound is the constant c + t_elect + t_commit ≈
60 + ~10 + ~2 s; for near-zero outages the floor is t_elect + δ + t_commit.

Validation against measurement (near-zero outage, orderers restarted within
seconds): predicted floor ≈ t_elect (8–10 s observed for 3-node Raft) + poll
(≤ 5 s) + commit (~2 s) = 10–17 s. Measured: revocation median 15.9 s
[14.86, 16.51] (n=5), grant median 14.4 s [13.01, 15.78] (n=6). Both sit
inside the predicted floor band, and their agreement across two different
chaincode functions is itself evidence that the window is a property of the
reconciliation machinery, not of the function replayed.

Not validated: the saturated regime (nothing here drives the schedule to its
cap — same limitation as 16b, stated in RESULTS.md).

## 3. What changed in the paper's claims

Before: "the outbox covers revocation only — grant() retains the original
fire-and-forget pattern... the write path is only partly repaired."
After (all measured): both access-control mutations are outbox-bounded with
honest 202/pending contracts; mixed queues drain in intent order; the two
exposure directions are characterized and mirror each other; the window is
explained by a bound whose floor the measurements match. RegisterDocument
remains availability-first by design, and the paper should say why (its
divergence denies rather than discloses: the safe direction) instead of
listing it as an open defect.
