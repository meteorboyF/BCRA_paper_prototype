# DELTAS — numbers/claims in the manuscript that differ from measured reality

_Running log. Do NOT edit the LaTeX; record every divergence here for a later editing pass.
Finalized at the end of the V → R → S campaign._

## Parameter corrections
- **BatchSize 50 → 500.** Manuscript text says "BatchSize=50". The live ordering service uses
  `MaxMessageCount=500` (configtx.yaml `BatchSize.MaxMessageCount: 500`). Correct value is **500**.
- **BatchTimeout = 2s (canonical).** All V2–V5 / R / S measurements use BatchTimeout=2s.
  V1 Phase B additionally reports a sensitivity sweep at 500ms and 250ms (not the canonical value).

## Measured-vs-manuscript number deltas
_(to be filled in as each experiment completes)_

| Section | Manuscript value | Measured value | Notes |
|---------|------------------|----------------|-------|
| §VI.B   | BatchSize=50     | MaxMessageCount=500 | parameter correction (above) |
| Exp5 WAN **full RTT sweep** (Task W, supersedes 0ms-only) | old baselines 21.9 / 24.4 TPS (old ~22 TPS regime) | **bridge:** 0→68.24, 50→64.94, 100→62.28, 150→60.76 TPS; **bridge_veth:** 0→69.48, 50→50.94, 100→47.04, 150→38.32 TPS | duration60s tool, conc=200, 5 reps/point. The prior 21.9/24.4 baselines were from the old ~22 TPS regime and are **superseded** by the current ~66–69 TPS regime. At 0ms the two configs match (~68 vs ~69.5); they diverge with RTT — `bridge` (delay on the docker bridge only) degrades gently, `bridge_veth` (delay also on each orderer veth → compounded inter-orderer Raft latency) collapses. **err:** bridge 3–5/point (p95<10s); bridge_veth grows with RTT (13→76→64→976 at 0/50/100/150ms) as p95 approaches the load tool's 10s client timeout — TPS reflects successful-commit throughput. Raw in `exp5_wan.csv` (full 8-point). |
| Exp1 BatchTimeout sensitivity (conc=50, fixedcount) | — | 2s≈62 TPS, 500ms≈214 TPS, 250ms≈301 TPS | V1 Phase B, 5 reps/timeout, err=0. (dur60 tool: 66/174/153 TPS resp.) Clean 10-rep re-run in Task SENS. |
| Exp1 **PostgreSQL-only throughput** (Task PG, replaces stale 481.4 TPS / 18×) | PG peak 481.4 TPS, ~18× Fabric (old ~22-TPS regime, different write path) | **PG peak ≈ 279 TPS (conc=100, 0 err); ratio ≈ 4.0–4.1× Fabric** | duration60s tool, mode=postgres (fabric.enabled=false). Matched-tool @conc=50: PG 272.1 / Fabric 66.3 = **4.1×**; peak/peak 279/~70 ≈ 4.0×. Lower than the old 481 because this PG write path still does IPFS add + dual-pin on 20% of requests (IPFS-bound). **Caveat:** the duration60s *closed-loop client* saturates its socket pool at conc≥150 in the fast db-only regime (no 2s batch to throttle it) → TPS collapses to 0 with ~480k spin-errors/trial; backend stayed UP and kept committing, so this is a load-generator limit, not a PG-server limit. conc≥150 rows kept in CSV but are harness-invalid (err column self-flags them); peak/ratio taken from the stable conc≤100 region. In *fabric* mode the same tool ran fine at conc=200 (Task W) because the 2s commit throttles the client. |
| Exp2 RegisterDocument latency @2s | — | cold/warmed p50 ≈ 2084 ms (=BatchTimeout) | gateway write path |
| Exp2 CheckAccess latency (fabric) | — | cold p50=7.50ms / warmed p50=6.51ms | Fabric CheckAccess read |
| Exp2 CheckAccess latency (db_only, Task DB) | — | cold p50=8.00ms / warmed p50=7.16ms | PostgreSQL-ACL path, Fabric bypassed (fabric.enabled=false), 20 warm+100 meas, 0 bad |
| RQ2 Fabric CheckAccess **overhead** vs DB | "<1 ms overhead" (claim) | **≈ −0.5 ms (cold), −0.65 ms (warmed)** → \|overhead\| < 1 ms, within noise | Confirms RQ2. CheckAccess is a Fabric *evaluate* (query, no ordering/commit), so it adds negligible time over the PG-ACL lookup; both dominated by ~7ms HTTP/app round-trip. |
| Exp3 fabric commit constant | — | 2131.7 ms (peer_cli, n=5) | IPFS add p50 1MB=10ms→50MB=95ms |
| Exp4 audit verification | — | PG query p50=3.85ms vs CSV+SHA256 chain p50=86.3ms (1000 events) | |
| Exp6 browser/WebCrypto crypto benchmark | no raw CSV/JSON evidence in repo | **Node WebCrypto fallback measured:** PBKDF2-600k p50=100.44ms; ECDH P-256 keygen p50=0.255ms; ECDSA P-256 keygen p50=0.095ms; ECIES wrap/unwrap p50=0.403/0.603ms; RSA-OAEP-2048 wrap p50=0.037ms; AES-GCM 1/10/50MB encrypt p50=0.596/4.270/44.418ms; decrypt p50=0.887/7.577/61.939ms; SHA-256 1/10/50MB p50=0.704/5.795/44.427ms; ECDSA sign/verify p50=0.183/0.097ms; ECIES token=125B, RSA token=256B, reduction=51.171875% | Raw evidence in `results/exp6_crypto.csv`, `results/exp6_crypto.summary.json`, `results/exp6_crypto.environment.json`, `results/exp6_crypto.raw.txt`. Playwright/Puppeteer were unavailable, so runtime is explicitly recorded as `node-webcrypto`, not browser WebCrypto. |
| Exp7 GetHistoryForKey (depth 107) | — | p50=135.5ms (10 trials, raw recorded) | |
| **SENS** clean BatchTimeout sensitivity (conc=50, duration60s, 10 reps) | (tool disagreement: Phase B fixedcount said 250ms>500ms; duration60s said 250ms<500ms) | **2s=67.7, 500ms=193.0, 250ms=179.8 TPS** (mean); client CPU 2.0 / 11.2 / 14.1%; err=0 | `exp_batchtimeout_sens.{csv,summary.json}`. **Resolved:** non-monotonicity (250ms < 500ms) is **reproducible**, and **NOT a load-generator artifact** — client CPU is only ~14% (nowhere near saturation). 500ms is the sustained-throughput sweet spot; pushing to 250ms cuts ~2× as many small blocks → higher per-block commit/validation overhead + noisier latency (250ms block ranged 137–206 TPS, p50 62–227ms) → slightly lower net throughput. The fixedcount tool ranked 250ms higher because it times fixed-batch completion (latency-favoring), not sustained throughput; the canonical sustained **duration60s** tool is the representative throughput metric. |

## Methodology notes for the manuscript
- §VI.B `commitStatusOptions` / CLI-proxy caveat: **RESOLVED — write path confirmed on the Fabric
  gateway.** A backend `/api/documents/upload` (RegisterDocument) returned a real on-chain
  `fabricTxId=9edbfb11...` in HTTP 200 at 2.105 s (= one BatchTimeout=2s), and `GetDocumentHistory`
  on the ledger returned the same txId. No CLI proxy, no DB fallback. The §VI.B caveat about the
  write path using the CLI proxy can be updated to say commits go through the gateway
  (`method=gateway` on all V1/V2 write rows).

## Environment fixes applied this session (reproducibility, not manuscript numbers)
- **IPFS dual-pin was hanging** post-reboot: `IpfsService.pinOnSecondary` does a blocking `pin/add`
  (no timeout) on node 2, which must fetch the CID from node 1 via bitswap. The two Kubo nodes
  could not dial each other because the default `Swarm.AddrFilters` blocks `172.16.0.0/12` (the
  docker subnet). Fix: cleared `Swarm.AddrFilters` on both nodes and set persistent `Peering.Peers`
  (by container DNS name) so they auto-reconnect across restarts. Secondary `cat` went from
  >10 s timeout → 13 ms. This restores the pre-reboot steady state; it does not change any
  measured system property.

## Potential future experiments / limitations
- **Expired-token CheckAccess contention not measured.** `pangochain-chaincode/legalcc/chaincode.go`
  attempts to mark an expired user-level grant as `EXPIRED` inside `CheckAccess` by calling
  `putAsset(ctx, docKey(docID), doc)`, while the backend calls this path via Fabric
  `evaluateTransaction("CheckAccess", ...)`. No benchmark in this campaign isolates concurrent
  access checks against already-expired grants, so expired-token MVCC/contention behavior should be
  treated as unmeasured unless a dedicated benchmark is added.
- **Fail-closed outage behavior not measured.** The backend supports `fabric.enabled=false`, but
  `DocumentService.downloadCiphertext` uses the DB ACL fallback both when Fabric is disabled and
  when `FabricException` is thrown. No separate configuration flag was found to disable ACL fallback
  and force fail-closed behavior during Fabric outage. The completed S2 experiment is fail-open only.

## Blockers recorded (campaign continues regardless)

### S1 — Fabric v3.0 SmartBFT, 4-node ordering — BLOCKED (manuscript BFT projection left as-is)
Attempted on an isolated config copy (live v2.4 network untouched). Concrete blockers:
1. **No ≥4-orderer crypto.** SmartBFT tolerates f=1 only with 3f+1=4 nodes; `crypto-config/` has just orderer1/2/3. A 4th orderer's MSP+TLS must be generated.
2. **Pinned v3 tools image missing.** `hyperledger/fabric-orderer:3.0.0` pulls fine, but `fabric-tools:3.0.0 / 3.0 / 3.1.0` are **not found** on Docker Hub (only `:latest`, which is unpinnable for a reproducible paper). `configtxgen` for a BFT genesis needs the matching pinned tools image.
3. **v3 removed the system channel.** The repo bootstraps via a `LegalOrdererGenesis` *system-channel* genesis + `peer channel create` (start-network.sh, configtx.yaml). Fabric v3 BFT requires the channel-participation API (`osnadmin channel join`, per-channel genesis) — a different bring-up the repo does not contain.
4. configtx is `OrdererType: etcdraft`; BFT needs `OrdererType: BFT` + `SmartBFTOptions` + 4 consenter mappings + the v3 channel capability.
**Net:** S1 = a separate v3 SmartBFT network from scratch (new crypto, configtx, osnadmin bring-up scripts, v3 peer/tools images, separate ports). It cannot reuse the validated v2.4 tooling and would risk the campaign network. Not attempted to completion; BFT numbers in the manuscript remain a projection.

### S3 — 6-org topology — BLOCKED (manuscript "3-org upper bound" text left as-is)
Concrete blockers:
1. **Topology artifacts are 3-org only.** `crypto-config.yaml`, `configtx.yaml`, and `docker-compose.fabric.yml` define exactly FirmA/FirmB/Regulator. A 6-org run needs 3 more orgs authored across all three files (+3 peers, +3 CAs, +3 CouchDB, port map).
2. **Full crypto regen is destructive.** Adding orgs regenerates `crypto-config/`, which invalidates the backend admin/TLS certs and **wipes the validated 3-org network** currently holding all V/R/S2 results.
3. **Chaincode + backend are 3-org-aware.** legalcc endorsement = MAJORITY of the 3 defined orgs; the backend is pinned to `FirmAMSP`. 6-org would need endorsement-policy + MSP-config changes.
**Net:** a non-destructive bounded attempt is not possible — it requires rebuilding the network at 6 orgs, destroying the validated 3-org state. The "3-org upper bound" claim remains as-is.
