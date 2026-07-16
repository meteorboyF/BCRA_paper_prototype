# Item 3.5b — Numbers-Level Comparison vs Closest Published Systems (SKELETON)

Status: **DRAFT — every ⟨VERIFY: …⟩ cell must be filled from the cited PDF
before this goes anywhere near the manuscript.** Do not cite this table
until each placeholder is resolved or the row is dropped. Our rows are
final and sourced from the consolidated evidence table
(`experiments/consolidated/results/20260716_131526/`).

## Ground rules (carry into the manuscript's table caption)

1. Cross-paper numbers are **not** hardware-normalized; the table reports
   each system's own published figures with its own testbed. State every
   testbed in the Hardware column; the point of the table is order-of-
   magnitude positioning and *what was measured at all*, not a race.
2. Distinguish read-path (query/evaluate) vs write-path (consensus commit)
   numbers — papers often headline whichever is larger.
3. Record the measurement instrument (Caliper vs custom) — our Exp 11
   exists precisely so at least one row-pair is instrument-comparable.
4. If a paper reports no performance numbers, say "not reported" — that is
   itself a comparison result (cf. IMPROVEMENTS.md item 1's capability table).

## The table

| System (venue, year) | Platform | Instrument | Read/query TPS | Read latency | Write TPS | Write latency | Testbed hardware | Workload notes |
|---|---|---|---|---|---|---|---|---|
| **This work** — gateway path (Exp 1/2/8) | Fabric 2.4 + IPFS, 3 orgs, CouchDB, 2s batch | custom REST loadgen | 66–69 sustained (mixed 20/80 W/R) | CheckAccess P50 6.51 ms [6.33, 7.22] | 193.0 TPS @500 ms batch [182.8, 203.2] | RegisterDoc P50 2.08 s (=2 s batch) | 18-core x86-64, 7 GiB, single host, Docker | app-level HTTP incl. auth/IPFS; n=100 latency cells |
| **This work** — chaincode direct (Exp 11) | same network | **Caliper 0.6, fabric-gateway** | 874.9 TPS @load 600, 20 ms avg | 20 ms avg | 172.0 TPS @load 600 | ~2.0 s avg | same | single-function rounds; peer-gateway limit at load ≥500 documented |
| Liu & Zheng 2024 (judicial evidence) `liu2024blockchain` | ⟨VERIFY: chain + storage⟩ | ⟨VERIFY⟩ | ⟨VERIFY: TPS or "not reported"⟩ | ⟨VERIFY⟩ | ⟨VERIFY⟩ | ⟨VERIFY⟩ | ⟨VERIFY⟩ | ⟨VERIFY: workload + n⟩ |
| N. Liu, S. Lu, W. Ren — Traceable Access Control for IPFS (BRA, in press 2026) | ⟨VERIFY: expected Fabric/IPFS?⟩ | ⟨VERIFY: Caliper?⟩ | ⟨VERIFY⟩ | ⟨VERIFY⟩ | ⟨VERIFY⟩ | ⟨VERIFY⟩ | ⟨VERIFY⟩ | ⟨VERIFY: is the ACL check measured on the retrieval path?⟩ |
| Mukta, Pal, et al. — Zero-trust AC delegation (BRA 7(1), 2026) | ⟨VERIFY⟩ | ⟨VERIFY⟩ | ⟨VERIFY⟩ | ⟨VERIFY: delegation-check latency?⟩ | ⟨VERIFY⟩ | ⟨VERIFY⟩ | ⟨VERIFY⟩ | ⟨VERIFY⟩ |
| Peelam et al. — NFT/fog evidence system (BRA 7(1), 2026) | ⟨VERIFY⟩ | ⟨VERIFY⟩ | ⟨VERIFY⟩ | ⟨VERIFY⟩ | ⟨VERIFY⟩ | ⟨VERIFY⟩ | ⟨VERIFY: fog nodes?⟩ | ⟨VERIFY⟩ |
| FileWallet (CMES 2022, Fabric+IPFS file manager) | Fabric + IPFS ⟨VERIFY version/topology⟩ | ⟨VERIFY⟩ | ⟨VERIFY⟩ | ⟨VERIFY⟩ | ⟨VERIFY⟩ | ⟨VERIFY⟩ | ⟨VERIFY⟩ | ⟨VERIFY⟩ |

## Per-paper extraction checklist (fill while reading each PDF)

For each row, capture with **page/figure/table number** so a reviewer can
audit the cell:

- [ ] Blockchain platform + version, org/peer/orderer counts, state DB,
      endorsement policy, batch parameters (if stated)
- [ ] Off-chain storage (IPFS? replication?) and whether retrieval is measured
- [ ] Instrument (Caliper version / custom generator / simulation)
- [ ] Read TPS + latency (statistic: mean? P50? — record which)
- [ ] Write TPS + latency (same)
- [ ] Load range (clients / send rate) and sample sizes
- [ ] Testbed hardware (CPU/RAM/nodes; cloud vs single host)
- [ ] Whether an access-control decision sits ON the data-release path,
      and whether its cost is measured (this is our delta — item 1's
      capability table crosses here)
- [ ] Any fail-closed / availability-under-outage measurement (none
      expected — cite Exp 9 as the differentiator)

## Notes for the write-up (once cells are filled)

- Pair each system's strongest number against our matching instrument row
  (Caliper vs Caliper where possible) and state statistic conventions
  (their means vs our medians) explicitly.
- Expected narrative (to be confirmed by the PDFs, not assumed): prior
  Fabric+IPFS systems report platform throughput but do not price the
  ACL decision on the release path, nor measure outage behavior — our
  6.51 ms [6.33, 7.22] on-path check cost (Exp 2), +6.5 ms end-to-end
  premium (Exp 14), and 0-byte outage leak (Exp 9) have no published
  counterpart to compare against. If any paper DOES report a comparable
  number, that strengthens the table — include it prominently.
- BRA reviewers may include these authors; do not round their numbers
  favorably to us. Quote exactly, cite page.
