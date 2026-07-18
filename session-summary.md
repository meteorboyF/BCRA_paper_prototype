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
4. ~~fig1–fig8 composition-matched swap~~ — DONE post-wrap-up
   (prototype-fixes 0770a8b: upgraded regen script; bra-submission
   406f306: all eight swapped, captions rewritten with CI methods,
   fig7 switched to measured-only strip plot with projection moved to
   prose). Every manuscript figure is now regenerated from released
   raw data.
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

## Post-campaign: coherence audit F1–F10 resolved (2026-07-17)

- Full-manuscript audit findings recorded in `AUDIT_FINDINGS.md`
  (bra-submission d5fbf37); author selected: apply F1–F8, skip F9,
  verify-then-fix F10.
- Applied on bra-submission @ cd37581 (pushed): F1 median-convention
  footnote in `sec:exp_consolidated` (author chose footnote over fig6
  regen); F2 fig1 caption `\hyperref` (was rendering "Experiment 6.8");
  F3–F5 redundancy trims (author-reviewed diffs before commit); F6
  LawFirmA/B naming; F7 `legal-channel` (matches backend
  application.yml + Exp 13 topologies); F8 en dash.
- **F10 was an audit false positive**: `results/exp1_throughput.csv`
  at canonical 2000 ms rows shows errors=0 through 400 clients, then
  3@500 / 22@600 — the audit claimed errors=0 through 600. Existing
  manuscript claim ("zero errors up to 400 clients") verified correct,
  no edit. Rule going forward: recompute flagged numeric claims from
  raw CSVs (DELTAS.md filters) before editing; outcome recorded in
  AUDIT_FINDINGS.md.
- Compile checkpoint: 108 pages, zero errors; **overfull baseline is
  now 26** (F4 trim removed one), was 27 — future checkpoints should
  expect 26.

## Polish pass: revision-history language stripped (2026-07-17)

- bra-submission @ 759ee40 (pushed): swept all reader-facing prose for
  edit-history language (R1–R8, author-approved list). fig7 caption
  rewritten standalone (was describing "earlier versions" and omitted
  projections); fig5 caption's "supersedes the pre-tuning regime"
  sentence deleted; the word "regenerated" removed from 8 figure
  captions + the median-convention footnote; editorial "now" removed in
  the threat-model table (null-MSP row), Exp 5 WAN prose, Exp 14
  discussion, and the consolidated section. Judged fine and kept:
  "formerly authorized user" (S1 semantics), the Exp 14 @Async defect
  disclosure, Phase-4 "replaced by" (roadmap).
- Compile: 108 pages, zero errors, overfull 26 (holds at the post-F4
  baseline).

## Reviewer-lens critique pass (2026-07-17)

- bra-submission @ 0caac55 (pushed): `REVIEWER_LENS_FINDINGS.md` (repo
  root) holds a full reviewer-simulation audit — wording (W1–W8),
  coherency (C1–C3), density (D1–D3), redundancy with counts (R1–R8),
  cut candidates with what-is-lost (N1–N6), hedging load-bearing-vs-
  defensive analysis (H1–H7), ranked reviewer synthesis. Applied so
  far: V1 stale "nine-experiment" → "fifteen-experiment" (conclusion);
  V2 deleted "resolving the baseline inconsistency cited in prior
  review" (draft-history leak the R-sweep missed); V3 `16.7,TPS` typo.
  All other IDs await author selection under the standing
  review-then-fix gate. Compile: 108 pages, overfull 26 (baseline).

## Reviewer-lens pass RESOLVED (2026-07-17, bra-submission 34fca0c)

- All ruled findings applied in one commit: cuts (workflow-demo
  subsection, security-claims table, role-hierarchy figure, SmartBFT
  migration ¶), dedup (custodial identity 13→7, SmartBFT 11→6,
  outage-scope caveat 6→2, proof disclaimers 5→2), clarity rewrites
  (topology CA ¶ fact-first, consensus split, RQ1 aligned, tautology
  sentences, GDPR merge), two reviewer-preemption sentences (generator
  co-location; gateway-vs-Caliper reconciliation).
- `REVIEWER_LENS_CHANGES.md` (repo root) = full per-ID change record;
  `REVIEWER_LENS_FINDINGS.md` header marks resolution. Still open:
  N3 (UI compress), N5 (key-lifecycle figure merge), optional abstract
  "cross-organization" qualifier.
- NEW COMPILE BASELINES: 103 pages (was 108), overfull 23 (was 26).
  Surviving large overfulls (72.5/67.2/67.0pt) are pre-existing texttt
  lines. Dropped cite: fabricSdkNode_wallet (bbl changed).

- Addendum (2026-07-17): N1 REVERTED at author request — role-hierarchy
  figure (Hierarchy.pdf) + intro reference restored (bra-submission
  2fc2c01). Baselines unchanged: 103 pages, overfull 23.

- HANDOFF.md added (bra-submission 2cfc938): one-page co-author map of
  all four editing passes with pointers; also closes the R1-R8
  documentation gap (previously commit-message-only).

## Two-host validation (2026-07-18, linux-validation branch + manuscript)

- Cross-host generator campaign complete (branch linux-validation @
  6857eef): Config A 228.0 [222.7,233.3] vs co-located 193.0
  [182.8,203.2]; Config B 70.5 [67.8,73.2] vs 66.3 [63.7,68.9] — both
  ABOVE committed CIs; co-location depressed published numbers
  (conservative). Campus Wi-Fi caveat recorded; aborted first Config B
  attempt preserved labeled. Full report:
  experiments/twohost_validation/RESULTS.md (linux-validation).
- Manuscript updated (bra-submission 52aa4a5): validation paragraph in
  evaluation setup + data-availability pointer to linux-validation.
  Compile 103pp/overfull 23 (baselines hold).
- Same branch also carries: fig1-9 title-free regen
  (annotation-identical), key-lifecycle composites, Exp10 n=20 rerun
  (50MB crossover gone), codename-clean deliverables_for_manuscript/.

## Owner-org fallback precision pass (2026-07-18, bra-submission cb35ce5)

- Code-verified (DocumentService.getWrappedKey requires requester's own
  per-recipient grant row; RegisterDocument seeds ACL[ownerID]; k_enc
  never wrapped for ungranted principals; listings scoped to grants):
  the OwnerOrg fallback authorizes CIPHERTEXT release only, never keys
  or plaintext. Seven manuscript sites tightened accordingly; severity
  recalibrated (least-privilege + harvest-now-decrypt-later, not
  plaintext disclosure). ECDSA section adds reasoned timestamp deferral
  (client clock = claimed time; trusted time = tx timestamp, same
  circular dependency as CID). Decision on record: chaincode changes
  (close fallback, bind metadata into signature) DEFERRED to revision
  round to preserve measurement provenance — no experiment ever
  exercised the fallback branch (bench user is doc owner via Branch 1).
- NEW PAGE BASELINE: 104 (was 103; two-host paragraph + this pass).
  Overfull stays 23.

## T1 remediation verified + new drift finding (2026-07-19)

- T1 (fail-closed default) VERIFIED RESOLVED: fc50593 (2026-07-18,
  pushed before this check) already flipped
  `DOCUMENT_MATERIAL_DB_FALLBACK` / `documents.material-db-fallback-
  enabled` to default **false** in application.yml + DocumentService.
  Independent re-verification: flag consumed ONLY by the download/
  wrapped-key path (allowDbAclFallback); grant/revoke/upload never
  reference it (their FabricException-swallowing is separate — T2
  remains open); Exp 14's audit-log-only profile branch precedes the
  flag check. Behavioral recheck on released defaults: 3-peer outage →
  owner WITH active DB ACL row got HTTP 503 on ciphertext AND
  wrapped-key, audit shows FABRIC_OUTAGE_ACCESS_DENIED only (zero
  ACL_FABRIC_FALLBACK), recovery to 200 after restart + breaker window.
- Step-4 determination: Exp 9 (run 2026-06-08T12:57Z, commit d66f54b,
  pre-rewrite and unreachable) was measured on a build that PREDATES
  the fallback entirely — earliest commit containing the flag is
  b26f64d (2026-06-09 13:11 UTC, ~24h after the run); no committed
  runner sets the env var. NOT an "explicitly disabled" case.
  Flag-note added to experiments/fail_closed_outage/README.md.
- NEW FINDING (text-vs-code drift bucket, alongside diagram-audit
  T3/T5/T6): manuscript §7 integration point (a) and the retrieval
  figures cite `GET /documents/{id}/download`; the implemented route is
  `GET /documents/{id}/ciphertext` (DocumentController). Found during
  the UI-retake session (seed script hit 500 on the documented path).
  Logged here because REVIEWER_LENS_FINDINGS.md lives on bra-submission,
  which is out of scope this pass — fold into that file on the next
  manuscript-side pass.
- Note: fc50593 carries a Co-Authored-By trailer, violating the repo's
  no-trailer rule; left as-is (pushed; no amending).

## UI-retake manuscript swap (2026-07-19, bra-submission d59c7b6)

- Copied the codename-free UI retakes (`ui_ledger_explorer.png`,
  `ui_audit_log.png`, from `deliverables_for_manuscript_ui/` on
  `ui-retake` in the FCDH_linux_validation clone) into
  `bra_submission/figures/` — same filenames, so no `\includegraphics`
  edits; §UI prose already matched the block-grouped explorer.
- First push was rejected: remote `bra-submission` had advanced
  4be6101 → e490714 (authors' hardening-pass merge: overlay of their
  newer local copy, CRediT filled, seoBlockchain2024 removed,
  readability pass, T1–T6 alignment, regenerated figures). Remote still
  had the OLD UI captures, so the swap remained needed; discarded the
  local pre-merge commit, redid the swap on e490714.
- Rebuilt via docker texlive (stale untracked `main.fdb_latexmk` from
  the pre-merge tree made latexmk report "up-to-date" — deleted it and
  forced with `-g`). NEW BASELINES after authors' merge: 103 pages,
  overfull 16 (fdb/fls now committed artifacts on this branch).
  Rendered p.54 to confirm the retakes are in the PDF.
- Committed + pushed as d59c7b6. Supplementary UI screenshots
  (registration/dashboard/case/details/download) are still the old
  captures — retake only covered the two main-text audit views.
- Follow-up (bra-submission 52e1602): UI prose precision after
  screenshot review — "channels" → "the channel" (explorer shows one
  channel in the header), and added the per-event anchoring clause
  ("each event linked to its anchoring Fabric transaction identifier")
  to the audit-log sentence; "expanded" → "expandable" to match the
  caption. Rebuild unchanged: 103 pages, overfull 16.
