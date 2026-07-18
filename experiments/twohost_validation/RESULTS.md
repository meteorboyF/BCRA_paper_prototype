# Two-Host Validation — Results Report (2026-07-18)

- **Purpose:** all published gateway throughput was measured with the
  load generator co-located on the evaluation host. This experiment
  reruns the two reference configurations with the generator on a
  separate physical machine, answering the reviewer objection that
  co-location distorted the numbers.
- **Evidence runs:**
  `results/20260718_093327_configA/` (client, 1 warm-up + 10 trials)
  and `results/20260718_101840_configB/` (client, 1 warm-up + 5
  trials); pushed from the client machine (commits 828c7f0, c103883).
- **Tool:** the campaign's canonical duration60s closed-loop harness
  (`client_bundle/loadtest.js`, byte-faithful except gateway-URL
  parameterization), conc 50, 20 % write / 80 % read, 10 s timeout.
  Statistics: Student-t 95 % CI over trial-level TPS, the campaign's
  method and t-constants.

## Topology and environments

| Role | Machine | Notes |
|---|---|---|
| Network host (Fabric 3-org + gateway + PostgreSQL + IPFS×2) | Intel Core Ultra 5 125H, 8 GB, Ubuntu 22.04, Docker 29, Java 21 — the original evaluation machine | backend on host (`mvnw spring-boot:run`), binds 0.0.0.0:8080 |
| Load generator (client) | Asus VivoBook X515JA, i5-1035G1 (8 threads), 14 Gi, kernel 7.0.0-27, Node v22.22.1 | separate physical machine; per-run `environment.json` committed |

**Network: Wi-Fi, UIU-Faculty-Staff campus network, BOTH HOSTS
WIRELESS — not the preferred wired LAN.** Recorded ping RTT
(100 samples per block, 0 % loss everywhere) shows heavy campus-Wi-Fi
jitter:

| Block | min / avg / max / mdev (ms) |
|---|---|
| Config A pre | 1.8 / 63.2 / 258.4 / 69.0 |
| Config A post | 1.8 / 30.2 / 209.5 / 47.6 |
| Config B pre | 2.0 / 52.1 / 203.8 / 60.2 |
| Config B post | 2.0 / 59.5 / 247.5 / 65.6 |

## Results vs committed co-located values

| Config | Setup | Two-host mean TPS [95 % CI] | Committed co-located [95 % CI] | Committed CI contains two-host mean? |
|---|---|---|---|---|
| A | BatchTimeout 500 ms, conc 50, n=10 | **228.0 [222.7, 233.3]** (sd 7.41) | 193.0 [182.8, 203.2] | **No — the two-host mean lies 12 % ABOVE the CI's upper bound** |
| B | BatchTimeout 2 s, conc 50, n=5 | **70.5 [67.8, 73.2]** (sd 2.18) | 66.3 [63.7, 68.9] | **No — the two-host mean lies just above the upper bound (70.5 vs 68.9)** |

Supporting client-side measurements: zero transaction errors in all 15
measured trials (and both warm-ups); client CPU 11–12 % (Config A) and
4 % (Config B), nowhere near generator saturation; request-latency
medians P50 36 ms / P95 787 ms (A) and P50 38 ms / P95 ≈2.13 s (B —
the 2 s batch window, as expected).

## Interpretation (honest, both directions)

Neither committed CI contains its two-host mean: **cross-host
throughput is HIGHER than the published co-located values in both
configurations** (+18 % at 500 ms, +6 % at 2 s). The consistent
direction, larger at the higher request rate, is what generator
contention predicts: co-locating the closed-loop client on the 8 GB
evaluation host depressed measured throughput, so the published
numbers are *conservative* — the co-location objection cuts against
the published claims' inflation, not for it. Two caveats bound this:
(i) the link was campus Wi-Fi with 30–63 ms average RTT and heavy
jitter, not wired LAN, so the two-host values carry their own
environment noise (visibly small: trial-level sd 2–7 TPS, zero loss);
(ii) this is one two-machine pairing measured on one day, offered as a
validation datapoint rather than a replacement for the published
numbers. The published co-located values remain the manuscript's
figures; this experiment bounds the direction and rough magnitude of
the co-location effect.

## Notes and deviations

- Config A's `trials.csv` has empty P50/P95 columns (parse bug, fixed
  in b96420e before Config B); latencies were recovered from the
  committed raw `trial_N.out` files. TPS/error/CPU columns unaffected.
- A first Config B attempt was aborted by a client-laptop shutdown
  after one trial; it is preserved, clearly labeled, at
  `results/20260718_095843_configB_ABORTED/` (its own README inventories
  what exists) and nothing from it is used here. The completed rerun
  `20260718_101840_configB/` is the analyzed block.
- The server ledger was rebuilt fresh for each config (BatchTimeout
  set in `configtx.yaml`, full network + chaincode redeploy, backend
  gateway crypto re-provisioned); bench case/document re-created per
  config; JWTs minted immediately before each block (15-min expiry).
- Cross-host reachability required moving both machines onto the same
  non-isolating network: a phone hotspot blocked client-to-client
  traffic; the campus Wi-Fi did not.
