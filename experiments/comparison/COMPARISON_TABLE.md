# Item 3.5b — Numbers-Level Comparison vs Closest Published Systems

Status: **FILLED from the source PDFs (lit-papers/, 2026-07-16); pending
author spot-check.** Every published-system cell carries a page citation
into its PDF. Our rows are sourced from the consolidated evidence table
(`experiments/consolidated/results/20260716_131526/`). Page numbers refer
to the PDF files as paginated in `lit-papers/` (journal pre-proofs where
noted), which may shift slightly in the versions of record — re-verify
page cites against the final published PDFs before camera-ready.

## Ground rules (carry into the manuscript's table caption)

1. Cross-paper numbers are **not** hardware-normalized; each row reports
   the system's own published figures on its own testbed. The point is
   order-of-magnitude positioning and *what was measured at all*.
2. Read-path (query/evaluate) vs write-path (consensus commit) numbers
   are distinguished; statistic conventions (mean vs P50) are recorded.
3. Instrument is recorded — our Exp 11 (Caliper) pairs against the two
   Caliper-using papers; our gateway rows pair against custom-loadgen rows.

## The table

| System (venue, year) | Platform | Instrument | Read/query performance | Write performance | Testbed | On-path ACL cost measured? |
|---|---|---|---|---|---|---|
| **This work** — gateway path (Exp 1/2/8/14) | Fabric 2.4 + IPFS, 3 orgs × 1 peer, CouchDB, Raft, 2 s batch | custom REST loadgen | CheckAccess P50 **6.51 ms** [6.33, 7.22] (n=100); 875 ms P50 50 MB IPFS retrieval | 66–69 TPS sustained @2 s batch; **193.0 TPS** [182.8, 203.2] @500 ms; RegisterDoc P50 2.08 s | 18-core x86-64, 7 GiB, Docker, single host | **Yes — headline result** (+6.5 ms end-to-end premium, Exp 14; fail-closed outage measured, Exp 9) |
| **This work** — chaincode direct (Exp 11) | same network | **Caliper 0.6** (fabric-gateway) | CheckAccess **874.9 TPS** @load 600, 20 ms avg | RegisterDocument **172.0 TPS** @load 600, ~2.0 s avg | same | (same system) |
| **RBAC-IPFS** — Liu, Lu, Guan, Ren (BRA, in press 2026, pre-proof) | IPFS 0.14.0-dev + Fabric 2.4.9, 10 peers, 1 orderer; 50 ms-RTT WAN emulated (tc/netem) | **Caliper** (fixed-load) + custom prototype "PaperSharing" | queryCid mean 159.75 ms client / 25.54 ms chaincode (WAN); Merkle proof verify sub-ms to 8 MB (p.10, Tab. 4–5) | write fns saturate **≈356–378 TPS**, mixed workload peak **≈450 TPS** (p.10, Fig. 5); checkPerm mean 490.32 ms client (WAN, Tab. 4) | Xeon Gold 2.80 GHz, 128 GB, Docker, Ubuntu 22.04 (p.9) | **Yes** — root-CID authorization on retrieval path: contract exec 1–2 ms, e2e 146–156 ms under 50 ms WAN (abstract, p.2); *no outage/fail-closed test* |
| **Liu & Zheng 2024** — judicial evidence (BRA 2024, `liu2024blockchain`) | **FISCO BCOS** + IPFS | java-sdk-demo, 10,000 tx/test, conc 10–600 (p.11) | send/confirm times tabulated (Tab. 6–9); no ms-scale query latency | peak **247 TPS** on 2-core/4 GB; "theoretical ≥400 TPS" projected for 4-core/8 GB (p.13) | 2-core CPU, 4 GB server (p.11) | No — contracts gate download but decision cost not isolated; no outage test |
| **Mukta et al.** — zero-trust AC delegation (BRA 7(1), 2026) | Fabric, 4 endorsing peers + 1 orderer, single channel | **Caliper** (p.11) | verifyDC peak **29.4 TPS** @75 users (p.12); latency seconds-scale (Fig. 10, figure only) | createDC **25.0 TPS**, delegateDC **24.2 TPS** peaks @75 users (p.12) | single Linux machine, 4 cores, 8 GB (p.11) | Partial — verifyDC throughput/latency measured, but as a chaincode op, not on a data-release path (no storage tier); no outage test |
| **Peelam et al.** — NFT/fog evidence (BRA 7(1), 2026) | private **Ethereum (PoS)** + Polygon simulation + IPFS; 3-layer fog | custom simulation (GitHub); LoadRunner-style metrics with CI margins | — (no query TPS/latency) | transaction delays **avg 24.5 s** (10-tx resolution), margins ±3.6–52.7 s at 95% (p.14, Tab. 5–7); gas ≈1.05M ±536k | Node A: i5/8 GB; Node B: i9/32 GB/8 GB GPU (p.14) | No — evidence minting/verification delays only; no ACL-decision latency; no outage test |
| **FileWallet** (CMES 130(2), 2022) | Fabric + IPFS P2P file manager | manual timing of uploads (Sec. 5.3, p.15) | — (functional ACL tests only, Sec. 5.1–5.2) | Fabric transaction time **≈2.1 s** constant across file counts/sizes (Tab. 6–7, pp.15–16); CID gen scales with size | "several peers"; hardware not stated | No — chaincode privilege checks verified functionally, never timed; no outage test |
| **Notash et al.** — adaptive e-health AC (BRA, in press 2026, pre-proof) | Fabric + IPFS + broadcast encryption, 4 orgs, 8 peers, 1 orderer, Raft (p.23) | custom; injected load 100–850 TPS, 10–100 users (p.23) | — (metrics are workflow-level) | avg **66.3 TPS**, avg latency **130 s**, comm overhead 2,300 KB over user range (p.28, Tab. 9); +23% TPS / −48% latency vs HealthRec-Chain | i7-11700K, 32 GB DDR4, 1 TB NVMe (p.23) | No — access-control enforcement asserted (Hoare-logic analysis), not latency-measured; no outage test |
| **Hernando-Corrochano et al.** — trusted wills (BRA 6, 2025) | **Alastria T-network (Quorum/PoA, ~120 nodes)** + IPFS (p.6) | LoadRunner, 2,000 users ramped 13 min, 31 m42 s run (p.9–10) | web-tier: 8.04 M HTTP 200 @ ≈4,224 responses/s (p.10, Tab. 2); response times in Fig. 4 (figure only) | platform-level claim ">1,500 tx/s, <1.5 s block" (network spec, not their measurement, p.8) | on-premise LoadRunner; app infra unspecified | No — e2e web response times only; no ACL-decision or outage measurement |

## Reading of the table (for the manuscript's gap statement)

- **Instrument-matched comparison (Caliper):** our chaincode direct rows
  (875 TPS read / 172 TPS write @2 s batch, 3 orgs) sit in the same band
  as RBAC-IPFS (356–450 TPS on 10 peers, 1 orderer, WAN-emulated) and
  well above Mukta et al. (25–29 TPS on a 4-core laptop-class host) —
  differences are dominated by topology/hardware, reinforcing ground
  rule 1.
- **The delta that survives the numbers:** RBAC-IPFS is the only prior
  system that *prices an authorization on the retrieval path*
  (146–156 ms e2e under 50 ms emulated WAN; contract 1–2 ms). Our
  measurement is complementary and finer-grained: 6.51 ms P50 for the
  ledger decision itself (LAN, n=100, CI-bounded) and +6.5 ms end-to-end
  premium vs a passive-audit-log baseline (Exp 14). **No prior system,
  including RBAC-IPFS, measures fail-closed behavior under ledger outage
  (Exp 9) or quantifies the enforcement premium against an architectural
  baseline (Exp 14)** — that pairing remains this work's unique
  evaluation contribution.
- **Correction to IMPROVEMENTS.md item 1 capability table:** the
  Liu/Lu/Ren row's "on-path enforcement" cell should move from
  P(scheme-level, not measured) to **Y (measured, 146–156 ms WAN e2e)** —
  the published version does measure it. Our differentiators vs that row
  are the outage/fail-closed evidence, the baseline-quantified premium,
  and the CI-grade statistics — update the manuscript table accordingly.
- Liu & Zheng runs on FISCO BCOS, and Peelam on Ethereum/Polygon — flag
  platform differences prominently; TPS across consensus families is not
  comparable even qualitatively.

## Verification log

Filled 2026-07-16 from `lit-papers/` PDFs (gitignored, copyright).
RBAC-IPFS, Liu & Zheng, and Notash et al. are journal pre-proofs
("uncorrected proof") — re-check numbers and pagination against the
versions of record before camera-ready. All cells trace to page-cited
tables/prose; values stated only in vector figures (Mukta Fig. 10
latencies, Wills Fig. 4 response times, Notash Fig. 6 curves) are marked
"figure only" rather than estimated by eye.
