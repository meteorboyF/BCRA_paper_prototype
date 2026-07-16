# Consolidated evidence table (Exp 1-14)

| Exp | Metric | n | Statistic | Value | 95% CI | Unit | Notes |
|---|---|---|---|---|---|---|---|
| Exp 1 | Fabric gateway TPS @conc 50 (duration60s, 2s batch) | 5 | mean | 66.3 | [63.69, 68.91] | TPS | [a] |
| Exp 1 | PostgreSQL-only gateway TPS @conc 100 (peak) | 5 | mean | 279.3 | [256.6, 302.0] | TPS | [a][b] |
| Exp 1 | PG:Fabric matched-tool throughput ratio @conc 50 | 11 | ratio | 4.0 | — | x | [a] |
| Exp 2 | CheckAccess P50, Fabric evaluate (warmed) | 100 | median | 6.51 | [6.33, 7.22] | ms |  |
| Exp 2 | CheckAccess P50, PostgreSQL ACL (warmed) | 100 | median | 7.16 | [6.6, 7.81] | ms |  |
| Exp 2 | RegisterDocument P50 (endorse+order+commit) | 100 | median | 2083.93 | [2083.2, 2084.71] | ms |  |
| Exp 3 | Fabric commit constant (size-independent) | 5 | median | 2131.73 | [2128.63, 2136.9] | ms |  |
| Exp 3 | IPFS add P50, 1 MB | 10 | median | 10.14 | [9.6, 12.53] | ms |  |
| Exp 3 | IPFS add P50, 50 MB | 10 | median | 94.7 | [88.97, 102.12] | ms |  |
| Exp 4 | Audit query P50, PostgreSQL (1000 events) | 10 | median | 3.85 | [2.53, 4.28] | ms |  |
| Exp 4 | Audit verify P50, CSV+SHA256 chain (1000 events) | 10 | median | 86.31 | [81.47, 94.55] | ms |  |
| Exp 5 | Gateway TPS, bridge @ 0 ms RTT | 5 | mean | 68.24 | [65.98, 70.5] | TPS |  |
| Exp 5 | Gateway TPS, bridge @ 150 ms RTT | 5 | mean | 60.76 | [56.86, 64.66] | TPS |  |
| Exp 5 | Gateway TPS, bridge_veth @ 150 ms RTT | 5 | mean | 38.32 | [35.94, 40.7] | TPS |  |
| Exp 6 | PBKDF2-SHA256 600k iterations P50 | 10 | median | 100.59 | [100.15, 103.93] | ms | [c] |
| Exp 6 | AES-256-GCM encrypt 50 MB P50 | 10 | median | 44.44 | [40.58, 46.23] | ms | [c] |
| Exp 7 | GetHistoryForKey P50 @ depth 107 | 10 | median | 135.5 | [128.0, 137.5] | ms |  |
| Exp 8 | Sustained TPS @ BatchTimeout 2000 ms | 10 | mean | 67.68 | [66.32, 69.04] | TPS |  |
| Exp 8 | Sustained TPS @ BatchTimeout 500 ms | 10 | mean | 193.0 | [182.76, 203.24] | TPS |  |
| Exp 8 | Sustained TPS @ BatchTimeout 250 ms | 10 | mean | 179.79 | [164.99, 194.59] | TPS |  |
| Exp 9 | Protected bytes released during Fabric outage | 3458 | count | 0 | — | bytes | [d] |
| Exp 9 | Fail-closed 503 denials during 45 s outage | 3458 | count | 1340 | — | requests | [d] |
| Exp 10 | IPFS retrieval P50, 50 MB remote, conc 1 | 24 | median | 867.45 | [855.6, 911.0] | ms |  |
| Exp 10 | IPFS retrieval P50, 50 MB remote, conc 24 | 24 | median | 6959.8 | [6921.2, 6980.1] | ms |  |
| Exp 10 | IPFS DAG storage overhead (all sizes) | 4 | constant | 0.024 | — | % |  |
| Exp 10 | Served with 1 of 2 IPFS replicas down | 10 | count | 10/10 | — | requests |  |
| Exp 11 | Caliper CheckAccess throughput @ load 600 | 6000 | single-run | 874.9 | — | TPS | [e] |
| Exp 11 | Caliper RegisterDocument throughput @ load 600 | 4381 | single-run | 172.0 | — | TPS | [e] |
| Exp 12 | CheckAccess P50 @ 10^3 docs | 100 | median | 7.94 | [7.65, 8.46] | ms |  |
| Exp 12 | CheckAccess P50 @ 10^6 docs | 100 | median | 8.54 | [8.08, 8.98] | ms |  |
| Exp 12 | Disk growth per document per peer | 1000000 | slope | 7099 | — | bytes/doc |  |
| Exp 13 | Write TPS, 2 orgs, majority | 2000 | single-run | 42.9 | — | TPS | [f] |
| Exp 13 | Write TPS, 7 orgs, majority | 2000 | single-run | 35.7 | — | TPS | [f] |
| Exp 13 | CheckAccess P50, 7 orgs majority (verified rerun) | 100 | median | 5.41 | [4.96, 5.78] | ms | [f] |
| Exp 14 | Release latency P50, on-path enforcement, conc 10 | 2000 | median | 21.62 | [21.39, 21.84] | ms | [g] |
| Exp 14 | Release latency P50, audit-log-only baseline, conc 10 | 2000 | median | 15.09 | [14.84, 15.36] | ms | [g] |
| Exp 14 | End-to-end on-path enforcement premium, conc 10 | 4000 | difference | 6.52 | — | ms | [g] |

## Footnotes

- **[a]** Exp 1 raw CSV mixes measurement regimes; canonical filter per results/DELTAS.md: tool=duration60s, BatchTimeout=2 s. The published 50-600 sweep shape uses the fixedcount tool.
- **[b]** PostgreSQL-mode rows at conc >= 150 are self-flagged harness-invalid (closed-loop client socket saturation) and excluded, per DELTAS.md.
- **[c]** Exp 6 ran on the Node.js WebCrypto fallback (recorded in the raw CSV), not an in-browser runtime.
- **[d]** Categorical outcome (zero-leak / denial counts); confidence intervals not applicable.
- **[e]** Caliper reports a single run per round with avg/min/max latency (community convention); no replicate CI available.
- **[f]** One matrix run per topology point (TPS is single-run; latency CIs from per-sample data). o7p1-majority is the verified rerun; the first measurement was a documented host artifact.
- **[g]** Measured after the async-executor defect fix (AsyncConfig); not comparable to Exp 1 absolute numbers (different endpoint and backend build).

Sources: `results/` (Exp 1-8 raw bundle, see DELTAS.md) and `experiments/<exp>/results/<run>/` evidence runs (Exp 9-14).
