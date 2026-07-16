# Experiment Progress / Crash-Resume Checkpoint

_Last updated: 2026-06-01 (resume after host crash mid-session). This file is the single
source of truth for resuming the V → R → S measurement campaign. Update it after every
completed experiment so another crash never costs more than one in-flight measurement._

## Locked plan (unchanged across sessions)
- Sequence: **V → R → S**, in order.
- **PARAMETER LOCK (canonical):** `BatchTimeout=2s`, `MaxMessageCount=500` ("BatchSize"=500).
  - Manuscript says "BatchSize=50" → WRONG. Logged in `DELTAS.md` as `BatchSize 50→500`. Do NOT edit LaTeX.
  - V1 **Phase B** deliberately sweeps `BatchTimeout` 500ms→250ms as a *sensitivity* sub-experiment,
    then RESTORES 2s. 2s remains the canonical value for V2–V5 / R / S.
- Topology: **3-org** (FirmA, FirmB, Regulator), 3 orderers (Raft).
- Throughput (V1): 5 runs/point + 1 discarded warm-up.
- CheckAccess/RegisterDocument latency (V2): 20 warm-up discarded + 100 measured; record cold-JIT P50 AND warmed P50 separately.
- Every experiment → `results/<exp>.csv` (ALL raw per-trial rows) + `<exp>.summary.json` (mean,P50,min,max,stdev).
  Tag every row with `platform` (linux_x86_64 authoritative) and `method`.
- Write path: gateway preferred; fall back to `peer chaincode invoke --waitForEvent` only if gateway fails after TLS fix, tagging `method=cli_proxy` vs `gateway` per row.
- Do NOT fabricate values; record failures in DELTAS and CONTINUE. Do NOT edit LaTeX.

## Live infrastructure state (as found on resume)
- **All Fabric containers DOWN** — orderer1/2/3, peer0.{firma,firmb,regulator}, all 3 CAs, all 3 CouchDB,
  legalcc, fabric-cli, pangochain-postgres → all `Exited (255)` ~45 min before resume.
- **IPFS UP & healthy**: `pangochain-ipfs`, `pangochain-ipfs2` (Kubo v0.27.0).
- `pangochain-fabric/configtx.yaml`: **uncommitted edit `BatchTimeout: 2s → 500ms`** (git status `M`).
  This is the unfinished V1-Phase-B state; the run was supposed to restore 2s at the end but crashed first.
- TLS/admin certs in `pangochain-backend/config/fabric/crypto/` were refreshed 03:28 (git `M`);
  prior originals saved under `_stale-backup-20260601-032801/`.

## Per-experiment status

| Exp | Script | Output files | Status |
|-----|--------|--------------|--------|
| **V1 Phase A** (throughput sweep @ 2s, fixedcount_x10, gateway) | `run-exp1-fabric-sweep.sh` | `exp1_throughput.csv` rows 2–42 | ✅ **DONE & valid** — conc {50,100,150,200,300,400,500,600}, warm-up(trial0)@50 + 5 trials/pt, all `bt=2000`, `method=gateway` |
| **V1 cross-check** (duration60s tool @ 2s, conc=50) | `run-exp1-batchtimeout.sh` (configurable tool) | `exp1_throughput.csv` rows 43–47 | ✅ tool cross-check @ 2s captured (5 rows). Sanity only. |
| **V1 Phase B** (BatchTimeout sensitivity 500ms→250ms, conc=50, both tools) | `run-exp1-batchtimeout.sh` (patched: added anchor-peer updates to `join_deploy`) | `exp1_throughput.csv` rows bt=500/bt=250 | ✅ **DONE & valid** — 5 dur60 + 5 fixedcount per timeout, all err=0. fixedcount mean TPS: ~63@2s → ~200@500ms → ~300@250ms. Network restored to 2s. |
| **V2** CheckAccess/RegisterDocument latency | `measure-v2-latency.py` | `exp2_latency.{csv,summary.json}` | ✅ **DONE** (fabric/gateway) — checkaccess cold/warmed p50=7.5/6.5ms; registerdoc p50≈2084ms (=BatchTimeout). 120 samples/op, 0 bad, all 200 |
| **V3** file-size (direct Kubo HTTP) | `measure-v3-filesize.py` | `exp3_filesize.{csv,summary.json}` | ✅ **DONE** — fabric commit const 2131ms (peer_cli, n=5); IPFS add p50 1MB=10ms→50MB=95ms (10/size). |
| **V4** audit verification | `measure-v4-audit.sh` | `exp4_audit.{csv,summary.json}` | ✅ **DONE** — pg_query p50=3.85ms vs csv_sha256_chain p50=86.3ms (1000 events, 10 trials). audit_log had 108k rows. |
| **V5** GetHistoryForKey (107 entries, 10 raw) | `measure-v5-history.sh` | `exp7_history.{csv,summary.json}` | ✅ **DONE** — depth=107, p50=135.5ms mean=134 stdev=6.41. Raw: [127,128,137,138,137,134,123,134,145,137]. |
| **R** WAN 0ms reconcile (bridge vs bridge_veth) | `run-R-wan-reconcile.sh` | `exp5_wan.csv` | ✅ **DONE** — back-to-back 0ms baselines, 5 reps each, err=0. bridge mean=66.64 TPS, bridge_veth mean=72.14 TPS. |
| **S1** Fabric v3 SmartBFT 4-node | (none) | n/a | ⛔ **BLOCKED & recorded** in DELTAS — needs 4th-orderer crypto, pinned v3 tools image (only `:latest`), v3 osnadmin bring-up (system channel removed), BFT configtx. Separate from-scratch v3 network; risks campaign net. BFT projection left as-is. |
| **S2** fail-open | `run-S2-failopen.sh` + `s2-ciphertext-load.js` | `exp_failopen.{csv,audit.json,summary.json}` | ✅ **DONE** — during 45s peer outage: 649 ok, 0 err/5xx/403, 1090 ACL_FABRIC_FALLBACK rows (fail-OPEN). Recovery: Fabric CheckAccess authoritative again, delta=0 new fallbacks. audit.json re-extracted (20 samples; orig COPY FORMAT json was invalid for SELECTs). |
| **S3** 6-org | (none) | n/a | ⛔ **BLOCKED & recorded** in DELTAS — 3-org-only artifacts (crypto-config/configtx/compose); 6-org needs destructive full crypto regen (wipes validated 3-org net) + chaincode/backend MSP changes. "3-org upper bound" text left as-is. |

## Data validity decisions
- **KEEP** `exp1_throughput.csv` rows 2–47 (Phase A sweep @2s + duration60s@2s cross-check) — collected on a fully-built 3-org network via the gateway. Valid.
- **REGENERATE** `exp1_throughput.summary.json`: it was written 04:21, but the CSV grew to 07:00 (now includes warm-up trial0 + duration60s rows). Stale → must rebuild from the full CSV after the campaign settles (and must EXCLUDE the trial=0 warm-up row and label the duration60s rows separately).
- **REDO** V1 Phase B from scratch (no valid 500ms/250ms rows exist).
- Everything V2–S3: nothing to keep; start clean.

## Resume recipe (do these in order)
1. **Restore canonical config:** set `configtx.yaml` BatchTimeout back to `2s` (or run Phase B which restores it).
2. **Bring the network up at 2s** (regen genesis/channel artifacts → start orderers/peers/CAs/CouchDB → create channel → join 3 peers → deploy legalcc → smoke test). Bring up Postgres. IPFS already up.
3. **Fix backend→peer gateway TLS**, start backend, assert in logs that commits go through the gateway (not silent CLI fallback). Tag rows `method=gateway` (or `cli_proxy` if forced to fall back).
4. Re-run **V1 Phase B** (`run-exp1-batchtimeout.sh`) — it rebuilds 500ms, measures, rebuilds 250ms, measures, restores 2s.
5. Run **V2 → V3 → V4 → V5** at 2s. Checkpoint this file after each.
6. **R**: both 0ms WAN baselines (bridge + bridge_veth) back-to-back in one session.
7. **S2** fail-open; attempt **S1** (v3 SmartBFT) and **S3** (6-org) — on any blocker, record exact blocker in DELTAS and CONTINUE.
8. Regenerate every `*.summary.json`; finalize `DELTAS.md`.

## Decision (locked this session)
- **"Restore 2s, redo Phase B"** chosen. Ordering: bring up 2s network → fix gateway → **V2→V3→V4→V5 on stable 2s** → **V1 Phase B** (`run-exp1-batchtimeout.sh`, sweeps 500/250 then restores 2s) → **R** → **S2/S1/S3**. Stable-2s latency experiments captured BEFORE any further rebuilds, so a Phase-B rebuild crash can't cost V2–V5.

## Crash forensics (important)
- **HOST REBOOTED 2026-06-01 09:15** (not just docker). Consequence: `/tmp` wiped → `/tmp/launch-backend.sh` was lost. **Reconstructed** it (cd pangochain-backend; `java -jar target/pangochain-backend-2.0.0.jar --spring.jpa.hibernate.ddl-auto=validate`, backgrounded, log `/tmp/pangochain-backend.log`). Phase B `restart_backend()` depends on it.
- Survived reboot: `crypto-config/` (so ledger-only rebuild keeps backend certs valid), backend jar (`target/pangochain-backend-2.0.0.jar`, built 03:28), node v18, docker 29 / compose v5.
- Rebuild method = ledger-only (NOT `start-network.sh`): `docker compose -f pangochain-fabric/docker-compose.fabric.yml down -v` → `docker rm -f legalcc` → regen **channel-artifacts only** (`configtxgen`, keeps crypto-config) → `up -d` → wait 30s → create+join channel (3 peers) → `deploy-chaincode.sh`. This preserves crypto so the backend TLS certs stay valid.
- Backend deps to start first: **pangochain-postgres** (was Exited) and **IPFS** (already up). Backend env defaults: DB localhost:5432, peer localhost:7051 (FirmAMSP, host-override peer0.firma.pangochain.com), IPFS 5001/5002, certs `pangochain-backend/config/fabric/crypto/{admin-cert,admin-key,tls-ca-cert}.pem`.

## CAMPAIGN COMPLETE (2026-06-01 ~11:10)
All measurable experiments done; S1/S3 blockers recorded. Every experiment has `<exp>.csv` (raw rows) + `<exp>.summary.json`:
- `exp1_throughput` (V1 Phase A sweep @2s + Phase B 500/250ms sensitivity) — 66 data rows
- `exp2_latency` (V2 checkaccess + registerdoc, 120 each, cold+warmed) — 240 rows
- `exp3_filesize` (V3, 6 sizes ×10 + fabric const) — 65 rows
- `exp4_audit` (V4, pg_query ×10 + sha256_chain ×10) — 20 rows
- `exp7_history` (V5, depth 107, 10 trials) — 10 rows
- `exp5_wan` (R, bridge+bridge_veth ×5 @0ms) — 10 rows
- `exp_failopen` (S2, 150 per-second + audit.json + summary) — 150 rows
Network left healthy at **BatchTimeout=2s**, backend gateway up, IPFS dual-pin persistent. `DELTAS.md` finalized.

## TOP-UP PHASE 2 (2026-06-01 ~11:40) — close 3 data gaps + clean sensitivity
Network stays 3-org @2s (NO crypto regen). Conventions unchanged. Append-only except where noted.
Canonical throughput tool = **duration60s** (`pangochain-loadtest-configurable.js`, 80/20 read/write).

| Task | What | Output | Status |
|------|------|--------|--------|
| **W** Full WAN RTT sweep | bridge+bridge_veth × RTT {0,50,100,150} × 5 reps, conc=200, duration60s. OVERWRITE exp5_wan.csv (8 points). | `exp5_wan.csv` (+ summary) | ✅ **DONE** — bridge 68→61 TPS, bridge_veth 69→38 TPS across 0→150ms. 40 rows. err: bridge ~3-5/pt, bridge_veth grows to 976@150ms (client 10s timeout). |
| **PG** PostgreSQL-only throughput | backend `fabric.enabled=false`; duration60s; conc {50..600}×5+warmup. APPEND mode=postgres to exp1_throughput.csv | `exp1_throughput.csv` | ✅ **DONE** — PG peak ≈279 TPS (conc=100); ratio ≈4.1× Fabric @conc=50. conc≥150 = client closed-loop socket-storm collapse (TPS=0, ~480k err; backend stayed UP) → harness-invalid, kept+flagged. Backend restored to fabric mode. |
| **DB** DB-only CheckAccess latency | `measure-v2-latency.py MODE=db_only OPS=checkaccess`, 20 warm+100 meas, cold+warmed. APPEND db_only block | `exp2_latency.{csv,summary.json}` | ✅ **DONE** — db_only cold/warmed p50=8.00/7.16ms; vs fabric 7.50/6.51ms → overhead ≈ −0.5ms (<1ms, within noise). RQ2 confirmed. |
| **SENS** Clean BatchTimeout sensitivity | conc=50, {2s,500ms,250ms}, duration60s, 10 reps each, capture client CPU; rebuild per timeout, restore 2s | `exp_batchtimeout_sens.{csv,summary.json}` | ✅ **DONE** — 2s=67.7, 500ms=193.0, 250ms=179.8 TPS; client CPU 2/11/14% (NOT saturated → not a client ceiling); err=0. Non-monotonic 250<500 reproduced; 500ms = sustained sweet spot. Network restored to 2s. |

Order: **W** (fabric+netem) → **PG+DB** (backend db-only, then restore fabric) → **SENS** (rebuilds, restore 2s). End: regenerate affected summaries, finalize DELTAS old→new, leave net @2s.
Resume note: if crash mid-W, just re-run `run-W-wan-sweep.sh` (it overwrites). PG appends — if interrupted, dedupe mode=postgres rows before re-run.

**TOP-UP PHASE 2 COMPLETE (2026-06-01 ~13:55).** W/PG/DB/SENS all done; affected summaries regenerated; DELTAS finalized old→new. Network verified left at **BatchTimeout=2s**, backend **fabric mode** (gateway write path proven: on-chain `fabricTxId` returned), IPFS dual-pin + Postgres up. Key results: WAN sweep (bridge 68→61, bridge_veth 69→38 TPS over 0–150ms); PG peak ≈279 TPS (~4.1× Fabric, harness saturates >conc100); DB CheckAccess overhead ≈ −0.5ms (<1ms, RQ2 ✓); SENS 500ms=193 / 250ms=180 / 2s=68 TPS with client CPU ≤14% (load gen NOT the ceiling; 500ms = sweet spot). New scripts: `run-W-wan-sweep.sh`, `run-PG-throughput.sh`, `run-SENS-batchtimeout.sh`, `/tmp/launch-backend-dbonly.sh`.

## EXP6 CRYPTO TOP-UP (2026-06-05)
Reviewer-safety evidence for Experiment 6 was generated without rerunning the Fabric/IPFS campaign.
New script: `experiments/run-exp6-crypto-benchmark.mjs`.
Outputs:
- `results/exp6_crypto.csv` — 170 raw rows (17 operations × 10 trials)
- `results/exp6_crypto.summary.json`
- `results/exp6_crypto.environment.json`
- `results/exp6_crypto.raw.txt`

Runtime: `node-webcrypto` fallback (`crypto.webcrypto.subtle`) because Playwright/Puppeteer were not installed (`ERR_MODULE_NOT_FOUND`). This is explicitly recorded in CSV notes, environment JSON, and summary JSON; it is not labelled as browser WebCrypto.
Key validation: ECIES token size = 125 bytes; RSA-OAEP-2048 token size = 256 bytes; token-size reduction = 51.171875%; every operation has n=10 and p50/p95 summary values.
Optional reviewer-safety inspection recorded in `DELTAS.md`: expired-token `CheckAccess` contention and fail-closed outage behavior remain unmeasured limitations/future experiments.

## Checkpoint log
- 2026-06-01 ~10:05: Resume inventory complete. Confirmed Phase A valid, Phase B incomplete, V2–S3 not started. Found host rebooted 09:15 (/tmp wiped); reconstructed launch-backend.sh; verified crypto-config + jar survived. Set configtx back to BatchTimeout=2s. About to start postgres + ledger-only rebuild at 2s. Nothing measured yet.
- 2026-06-01 ~10:10: **Network REBUILT at 2s.** Postgres started (accepting connections); IPFS up. Fabric: down -v, regen channel-artifacts @2s, up -d (all 10 containers), created legal-channel, joined 3 peers, deployed legalcc (smoke test RegisterCase = status 200 PASS). Verified backend certs vs live crypto: tls-ca-cert MATCH, admin-cert MATCH (no cert re-sync needed). Starting backend now; next = assert gateway commit, then V2.
- 2026-06-01 ~10:24: **Write path VERIFIED on gateway + IPFS fixed.** Two environment regressions found and fixed (both post-reboot):
  1. **Anchor peers were missing** (my manual channel setup skipped the anchor updates) → gateway service discovery couldn't find cross-org endorsers → `FAILED_PRECONDITION: no peer combination satisfies endorsement policy`. Fixed by running the 3 anchor-peer updates. **If you rebuild the channel manually, ALWAYS run the anchor updates** (start-network.sh step 5 does them; my ad-hoc create+join did not).
  2. **IPFS dual-pin hung** — see DELTAS "Environment fixes". Cleared `Swarm.AddrFilters` (was blocking docker subnet 172.16/12) + set persistent `Peering.Peers` on both Kubo nodes. Secondary pin 10s-timeout → 13ms.
  - End-to-end proof: `/api/documents/upload` → HTTP 200 in 2.105s (=1 BatchTimeout) with on-chain `fabricTxId=9edbfb11...`; `GetDocumentHistory` returns the same txId. `method=gateway`, no fallback.
  - **Infra now fully ready for measurement:** Fabric @2s (3-org + anchors + legalcc), backend up (gateway write path live), IPFS dual-pin healthy, Postgres up. Next: run V2 (`measure-v2-latency.py`).
