# Session Summary — BRA Evaluation-Depth Campaign

Living log of the experiment campaign for the BRA resubmission
(IMPROVEMENTS.md Section 3). Updated as work continues.
Branch: `prototype-fixes` (experiments + code); one correction commit on
`bra-submission` (work-plan doc only; manuscript LaTeX untouched).

## Status at a glance

| IMPROVEMENTS.md item | Experiment | Status | Report |
|---|---|---|---|
| 3.4 IPFS storage/retrieval cost | Exp 10 | ✅ done | `experiments/ipfs_cost/RESULTS.md` |
| 3.1 Caliper standard-tool benchmark | Exp 11 | ✅ done | `experiments/caliper/RESULTS.md` |
| 3.3 Ledger growth 10³–10⁶ docs | Exp 12 | ✅ done | `experiments/ledger_growth/RESULTS.md` |
| 3.2 Network-size scaling 2–7 orgs | Exp 13 | ✅ done | `experiments/network_scaling/RESULTS.md` |
| 3.5a Passive-audit-log baseline | Exp 14 | ✅ done | `experiments/baseline_auditlog/RESULTS.md` |
| 3.6 Consolidated table + 95% CIs | Exp 15 | ✅ done | `experiments/consolidated/RESULTS.md` |
| 3.5b Comparison vs published systems | — | ✅ filled, pending author spot-check | `experiments/comparison/COMPARISON_TABLE.md` |

Index of everything: `experiments/README.md`.

## Timeline (2026-07-15 → 2026-07-16)

### Phase 1–2: recon and planning
- Read IMPROVEMENTS.md on `bra-submission`; mapped items 3.1–3.6.
- Found NO experiment code in the repo initially; user then added the
  original Exp 1–9 scripts (landed in the wrong subdir with broken path
  assumptions — moved to repo-root `experiments/`).
- Environment constraints identified: 7 GiB RAM box, no docker-group
  access at first, no system pip (bootstrapped `experiments/.venv` via
  get-pip.py).

### Exp 10 — IPFS cost (item 3.4)
- 3-node Kubo topology (added bench-only `ipfs3` via compose overlay).
- Pitfall: kubo `server` profile AddrFilters block docker-bridge dialing —
  nodes silently fall back to PUBLIC RELAYS, corrupting latency numbers.
  `run.sh` snapshots/clears filters; `--teardown` restores.
- Results: retrieval linear in size (50 MB remote P50 875 ms conc 1);
  replication ≈ linear per replica; DAG overhead flat 0.024%; 1-of-2
  replicas down → zero penalty; all replicas down → clean timeouts.

### Exp 11 — Caliper direct-Fabric (item 3.1)
- Existing "caliper" setup drove the REST API (kept for reference); built
  the direct-SUT benchmark: Caliper 0.6 + fabric-gateway binding.
- CheckAccess 875 TPS @ 20 ms avg (load 600); RegisterDocument 172 TPS
  approaching Exp 8's ~193 ceiling; write latency flat ≈2 s (BatchTimeout).
- Failures at load 500/600 = peer gateway's default concurrency limit
  (clean load-shedding, deliberately untuned; documented).

### Exp 12 — Ledger growth (item 3.3)
- Resumable fabric-gateway preload (`LG-<seq>`), 1M docs, ZERO failures,
  70–76 TPS sustained (10⁶ continuation ran 3.6 h detached + monitored).
- Query latency effectively flat over 1000× state growth (CheckAccess
  7.96 → 8.60 ms P50); disk linear ~7 KB/doc/peer, 10⁶ ≈ 5.6 GB block
  store + 1.4 GB CouchDB per peer.

### Exp 13 — Network-size scaling (item 3.2)
- `gen-topology.py` emits complete N-org × P-peer networks (no CAs,
  internal DNS) — 7 orgs FIT in 7 GiB after all (the feared RAM ceiling
  never materialized).
- 9-point matrix (2/3/5/7 orgs × single/majority + 3×2-peer), 20k writes,
  zero failures. Throughput ordering-dominated (−5.5% from 2→7 orgs);
  majority endorsement −0.9% → −12.7%; reads size-independent.
- Integrity note: first o7p1-majority measurement (15.9 TPS, 35 ms reads)
  was a host artifact — re-ran in isolation (35.7 TPS, 5.5 ms), both runs
  preserved, `matrix_final.csv` carries the verified value with provenance.

### Exp 14 — Passive-audit-log baseline (item 3.5a)
- Only prototype-code changes of the campaign:
  1. `DocumentService`: guarded Spring profile `audit-log-only`
     (default OFF) — DB-ACL decision + async LogAuditEvent anchor.
  2. `AsyncConfig`: PREREQUISITE BUG FIX — `@Async` had silently fallen
     back to SimpleAsyncTaskExecutor (thread-per-task; WebSocket broker
     beans block unique TaskExecutor resolution). Thousands of threads
     parked 2 s in commitStatus capped the gateway at ~14 req/s. Bounded
     pool → 721–768 req/s. Exp 1's published numbers assessed UNAFFECTED
     (its workload never fires a null-txid audit event) — footnote, no rerun.
- Result: on-path enforcement premium ≈ +6.5–9 ms P50, ≤10% TPS;
  baseline anchored only 144/~24k audit events during the window
  (drain 3–8/s vs 700+/s generated) — the passive design's hidden cost.
- Harness took 6 attempts; root causes fixed and logged in RESULTS.md
  (set -e function-return footgun ×2, missing .env for bare mvnw,
  machine-specific firm UUID, loadgen data-loss on crash).

### Exp 1–9 raw data recovery + verification
- User supplied original CSVs (`results/` at repo root) + DELTAS.md
  (measured-vs-manuscript reconciliation log).
- Verified authentic: Exp 2 warmed P50s 6.51/7.16 ms EXACT at n=100;
  Exp 8 193.0 TPS exact; Exp 5 bridge sweep exact to 2 dp; Exp 7
  depth-107 135.5 ms exact.
- Canonical filters recorded: Exp 1 = duration60s @2 s; PG conc≥150 rows
  harness-invalid; Exp 6 = Node WebCrypto fallback (not browser).
- Sensitivity-scanned (clean) and committed.

### Exp 15 — Consolidated evidence table + CIs (item 3.6)
- 37 headline metrics across Exp 1–14; bootstrap CIs for medians,
  t-CIs for trial means; caveat footnotes [a]–[g].
- fig15: Exp 2 CIs OVERLAP (6.51 vs 7.16 — "no significant added delay"
  now interval-supported); Exp 14 premium significant but small.
- Fixed before commit: initial build pulled Exp 13's o7 latencies from
  the outlier run — corrected to the verified rerun.

### Item 3.5b — comparison table vs published systems
- Extracted page-cited numbers from 7 PDFs (`lit-papers/`, gitignored).
- Key finding: **published RBAC-IPFS DOES measure on-path authorization**
  (146–156 ms e2e under 50 ms emulated WAN; Caliper 356–450 TPS) —
  corrected IMPROVEMENTS.md item 1's capability table (P→Y, N→Y with a
  dated note) on `bra-submission` (commit c8a7243; rebased over a stale
  local ref before pushing).
- Surviving gap statement: no prior system measures fail-closed outage
  behavior or quantifies the enforcement premium vs an architectural
  baseline; CI-grade statistics also unique.
- TODO at top of COMPARISON_TABLE.md: re-verify pre-proof page cites
  (RBAC-IPFS, Liu & Zheng, Notash) against versions of record.

### Legacy figure regeneration (completing item 3.6)
- fig1–fig9 regenerated from committed raw CSVs in the unified house
  style with 95% CIs (`experiments/legacy_figures/`, run 20260716_145930).
- Deltas vs published versions documented in its RESULTS.md: fig1 PG
  series truncated to the valid region; fig5 uses the full superseded-
  baseline RTT sweep; fig6 flags the Node WebCrypto runtime in-figure;
  fig9 re-render makes the circuit-breaker recovery lag visible.
- Swapping into `bra_submission/figures/` + caption updates = manuscript
  work, deliberately not done here.

### Manuscript campaign (bra-submission branch, 2026-07-16)
All IMPROVEMENTS.md writing items executed in order 1 -> 0 -> 4 -> 2 -> 5
with per-item sign-off checkpoints, docker TeX Live compile verification
(zero errors, overfull-vs-baseline discipline), and MANUSCRIPT_TODO.md as
the deferral ledger:
- **Item 1** (dfc7e79): novelty recut — 5 page-verified lit-table rows,
  new access-control-centric related-work subsection conceding RBAC-IPFS's
  measured on-path auth, gaps rewritten naming systems, delta sentences.
- **Item 0** (ddb4066): Exp 10-15 integrated — six evaluation subsections,
  numbers-positioning table, executor-defect footnote, fifteen-experiment
  intro, fig10-fig14 added.
- **Item 4** (ee0aaae): threat model restructured four-part — assumptions
  A1-A6, properties P1-P4 with experiment anchors, scenarios S1-S4
  (key-substitution promoted), explicit out-of-scope.
- **Item 2** (3738c87): legal grounding — cross-firm e-discovery scenario
  (FRCP clawback = RevokeAccess mapping), 7-row legal requirement ->
  mechanism -> evidence table, 5 verified web refs (FRE 902, ABA 477R/483,
  EDRM 2.0, EU 2023/1543) with last-accessed dates.
- **Item 5** (2661361): abstract ~201 words ending on delta sentence,
  keywords swap, fig9 swapped + THREE '15-second' claims corrected to the
  measured 20 s (circuit-breaker open-state, config-verified), zanzibar
  pages fixed, macaroons DOI'd (NDSS unpaginated — documented),
  seoBlockchain2024 verified-but-uncited flagged, data-availability B1/B2
  variants drafted. fig1-fig8 swap deferred (composition mismatch).
Remaining: author-owned decisions only (CRediT, data-availability choice,
seo cite-or-delete, optional fig1-8 composition-matched swap) + camera-
ready pre-proof re-checks. See MANUSCRIPT_TODO.md on bra-submission.

## Repo/process decisions
- One RESULTS.md per experiment beside the code; timestamped evidence
  runs under `<exp>/results/`; smoke runs gitignored, never evidence.
- Root .gitignore (user preference — no per-dir ignore files); no
  Co-Authored-By trailers (history rewritten once to strip them;
  environment.json git_commit fields remapped to surviving hashes with
  provenance notes).
- Figures: Exp 1–9 house style, CVD-validated palette
  (#b45309/#2563eb/#16a34a, ink #111111).

## Known open items
- 3.5b: author spot-check of extracted numbers; camera-ready page-cite
  re-verification (three pre-proofs).
- Manuscript-side work (IMPROVEMENTS.md items 1, 2, 4, 5) not started —
  outside this campaign's code-only scope.
- Optional: rerun Exp 1 sweep on the fixed executor if reviewers ask
  (assessed unnecessary; analysis in `baseline_auditlog/RESULTS.md`).
- Bench IPFS config still active (cleared AddrFilters, ipfs3 up) —
  `bash experiments/ipfs_cost/run.sh --teardown` restores when done.

## Final wrap-up (2026-07-16, end of campaign)

**Everything in IMPROVEMENTS.md is now either done or author-owned.**

### Branch/commit inventory
- `prototype-fixes` @ 118acca (pushed): Exp 1–15 code + verified raw data
  + evidence runs + consolidated CI table + comparison table + regenerated
  figure set + AsyncConfig fix + audit-log-only profile + this log.
- `bra-submission` @ 2661361 (pushed): manuscript with all five writing
  items landed (108 pages, zero compile errors, 1 documented bibtex
  warning); `MANUSCRIPT_TODO.md` = remaining-work ledger;
  `IMPROVEMENTS.md` carries the dated RBAC-IPFS capability correction.
- Compile toolchain: docker `texlive/texlive:latest` (no local LaTeX);
  build artifacts (aux/bbl/pdf) are committed on bra-submission.

### Corrections the experiments forced into the manuscript (evidence-backed)
1. RBAC-IPFS DOES measure on-path authorization (capability table P→Y).
2. Exp 9 recovery lag is 20 s (first success t=95; circuit-breaker 30 s
   open state), not the published ~15 s — fixed in 3 places + fig9 caption.
3. Async-executor defect disclosed in an Exp 14 footnote; Exp 1–9 assessed
   unaffected (workload never fires a null-txid audit event).

### Open items — ALL author-owned (see MANUSCRIPT_TODO.md)
1. CRediT roles (skeleton untouched, needs co-author sign-off).
2. Data availability: pick variant B1 (GitHub, active) or B2 (Zenodo DOI,
   commented placeholder) — if B2, deposit a release and fill the DOI.
3. `seoBlockchain2024`: verified correct but uncited — cite or delete.
4. Optional: fig1–fig8 composition-matched swap (upgrade
   `experiments/legacy_figures/regen_figs.py` first).
5. Camera-ready: re-verify pre-proof page cites (RBAC-IPFS, Liu & Zheng,
   Notash) against versions of record; RBAC-IPFS numbers cited in main.tex
   also come from the pre-proof.
6. `lit-papers/` + `lit-papers.zip` are local-only (copyright, gitignored).

### Machine state at wrap-up
- Running containers: full 3-org Fabric network + legalcc + fabric-cli,
  postgres, 3 IPFS nodes (bench node ipfs3 + cleared AddrFilters still
  active — run `bash experiments/ipfs_cost/run.sh --teardown` to restore
  the app IPFS config and stop ipfs3 when benching is finished).
- Backend not running. Ledger contains benchmark residue (1M LG-* docs
  from Exp 12 were destroyed by Exp 13's teardown; current network is the
  Exp 14-era 3-org deployment) — `make up && make chaincode` in
  pangochain-fabric for a fresh network if needed.
- TeX Live docker image (~5 GB) retained for future manuscript compiles.
