# Experiment 11 — Hyperledger Caliper Benchmark (direct Fabric): Results Report

- **IMPROVEMENTS.md item:** 3.1 (standard-tool benchmark alongside the gateway load generator)
- **Run:** `experiments/caliper/results/20260715_180121/` (branch `prototype-fixes`)
- **Figure:** `fig11_caliper.png` / `.pdf`; Caliper's own `report.html` also kept
- **Raw data:** `caliper_rounds.csv` (16 rounds), `run.log`, `environment.json`

## Setup

Caliper 0.6.0, **fabric-gateway binding** (peer-gateway API — the modern
Fabric 2.4 client path, same as the Spring backend). One gateway connection
to `peer0.firma` (`grpcs://localhost:7051`, TLS host override); the peer
gateway collects majority endorsements from FirmB/Regulator server-side.
Topology: the standard 3-org × 1-peer network, 3 Raft orderers, CouchDB,
default (majority) endorsement policy — identical to Exp 1–9.

Two single-function workloads, 10 workers, fixed-load 50–600 (mirroring
Exp 1's 50–600 client sweep; fixed-load = closed-loop clients):

- `CheckAccess` — evaluate (read path); the ledger ACL decision on the release path.
- `RegisterDocument` — submit (write path); full endorse→order→commit, unique docID per tx.

Note: the pre-existing `run-experiments.sh` + `pangochain-workload.js` drive
the **REST API** through Caliper (scheduler only). Kept for reference; this
experiment is the direct-SUT benchmark reviewers expect for cross-paper
comparability.

## Results (n per round = 10× load, e.g. 6000 tx at load 600)

| Load | CheckAccess TPS | CheckAccess avg lat | RegisterDocument TPS | RegisterDoc avg lat | RegisterDoc fails |
|---|---|---|---|---|---|
| 50 | 189.6 | 30 ms | 16.1 | 1.66 s | 0 |
| 100 | 336.4 | 20 ms | 28.0 | 2.05 s | 0 |
| 150 | 452.6 | 20 ms | 48.1 | 1.79 s | 0 |
| 200 | 547.2 | 20 ms | 55.5 | 1.66 s | 0 |
| 300 | 670.2 | 20 ms | 80.5 | 1.68 s | 0 |
| 400 | 770.7 | 20 ms | 98.9 | 1.73 s | 0 |
| 500 | 799.2 | 20 ms | 128.3 | 2.03 s | 187 (3.7%) |
| 600 | 874.9 | 20 ms | 172.0 | 1.98 s | 1619 (27%) |

### Key findings

1. **Read path (CheckAccess): 875 TPS at 20 ms avg latency** at load 600,
   still rising — queries never touch ordering. This is the operation on the
   document-release path, so ledger-side ACL evaluation is not the bottleneck.
2. **Write path: throughput climbs to 172 TPS** at load 600, approaching the
   ~193 TPS ordering ceiling from Exp 8 (BatchTimeout study). Write latency
   is flat at ~1.7–2.0 s across all loads — dominated by the 2 s BatchTimeout
   block-cutting, exactly as Exp 8 predicts. Caliper thus independently
   corroborates the custom gateway generator's saturation numbers.
3. **Failures at loads 500/600 are gateway admission control, not errors:**
   every failure in `run.log` is `too many requests for /gateway.Gateway,
   exceeding concurrency limit (500)` — Fabric's default
   `peer.limits.concurrency.gatewayService=500`. Above ~500 concurrent
   in-flight submissions the peer sheds load cleanly (rejects new requests,
   never corrupts committed state). Zero read-path failures at any load.

## Manuscript notes

- Caliper reports avg/min/max latency (no percentiles) — that is the metric
  other BRA papers publish; keep P50 discipline for our own generator and
  present both, clearly labeled.
- The write-TPS-vs-load slope (16→172 TPS) reflects closed-loop clients
  against fixed 2 s block cutting: bigger in-flight populations fill blocks
  faster. Cite Exp 8 when explaining it.
- If a reviewer asks for saturation without gateway load-shedding, either
  cap analysis at load 400 (0 failures) or note the peer limit is a
  documented, tunable default (`peer.limits.concurrency.gatewayService`).
  We deliberately did not tune the SUT away from the Exp 1–9 configuration.
- `results/smoke/` is a connectivity check with toy parameters — not evidence.

## Reproduce

```bash
bash experiments/caliper/run-fabric-benchmark.sh          # full 16-round sweep (~9 min)
PANGOCHAIN_CALIPER_BENCHCONFIG=smoke-benchmark.yaml \
bash experiments/caliper/run-fabric-benchmark.sh          # <1 min connectivity check
```

Requires the 3-org network (`cd pangochain-fabric && make up && make chaincode`
— the script starts it if absent). First run does `npm install` + SUT binding.
