# ACCEPTANCE_NOTES — prioritized plan to raise acceptance odds at BRA

Written 2026-07-17, after the hardening pass (`CHANGELOG_review.md`,
`RISKS.md`). Distinct from the in-place fixes: this is the forward plan.
It builds on `IMPROVEMENTS.md` (2026-07-13) — most of whose big items the
authors have since **completed** (comparison recut vs. 2026 BRA papers,
legal scenario + mapping table, Experiments 10–15 incl. Caliper,
network-size, ledger-growth, IPFS-cost, architectural baseline, consolidated
CIs, four-part threat model). What remains is deliberately smaller.

## Research basis (updated 2026-07-17)

- The BRA landscape scan in `IMPROVEMENTS.md` (Vol 5 2024 – Vol 7 2026)
  still holds: BRA publishes applied system papers with a concrete domain,
  Caliper-or-equivalent load curves, at least one baseline, an explicit
  threat/trust analysis, and novelty framed as a capability delta over named
  systems with a comparison table. The manuscript now matches that genre
  point by point.
- New since that scan: "A blockchain-based digital evidence management
  system: integrating forensic procedures and multi-party authorization"
  (Information Processing & Management, 2026, ScienceDirect
  S0306457326000464) — adjacent evidence-lifecycle work worth a one-line
  related-work mention if it survives the authors' verification (do not cite
  unverified).
- Pattern worth copying from accepted BRA system papers: a short
  "Deployment considerations" paragraph that converts limitations into an
  adoption story (consortium governance, cost, migration). The paper's
  four-phase migration path already does this — it is an asset; keep it.

## Ordered recommendations

### 1. Curate the public artifact under a neutral name — effort: 0.5–1 day; impact: HIGH
The single highest leverage-per-hour item, and it gates the Data-availability
statement (RISKS R3). Mirror `results/`, `experiments/`, the load/topology
generators, and analysis scripts into a neutral-named repo (or straight to a
Zenodo deposit = Variant B2, which BRA's data policy prefers), excluding the
GPT-4o demo layer and hackathon docs; strip "pangochain" from directory
names and READMEs. Every figure/table being reproducible from a clean,
DOI-citable artifact is exactly the "evaluation depth" narrative a reviewer
can verify in five minutes. The repo evidence fully supports this — it is
packaging, not new work.

### 2. Fill CRediT; make the submission mechanically complete — effort: hours; impact: HIGH (it is a gate, not a bonus)
CRediT roles (co-author sign-off), final Data-availability variant, flatten
`figures/` for Editorial Manager, per-figure 1/1.5/2-column sizing note,
cover letter. The cover letter should state the IEEE-rejection-and-rebuild
arc in one sentence and the delta list (15 experiments, CIs, baseline,
outage) — editors read this as "the hard revision already happened".

### 3. One two-host validation run — effort: 1–2 days; impact: MEDIUM-HIGH
The only evaluation objection the current campaign cannot answer from
existing data (RISKS R4.1). Rerun Exp 8's sweet-spot point (BatchTimeout
500 ms, conc 50) and one Exp 1 point with the load generator on a second
machine. If ratios hold within CI, add one sentence + one footnote; the
"single-host co-location" objection dies. The runners
(`run.sh`, `bench.js`, topology generator) are already machine-independent
per `experiments/network_scaling/RESULTS.md`, so this is mostly wall-clock.

### 4. Regenerate the flagged figures — effort: 0.5 day on the original Linux box; impact: MEDIUM
Three birds with one script run (`experiments/legacy_figures/regen_figs.py`):
(a) drop the in-figure "Exp N — …" titles (em dashes; titles are redundant
with journal captions), (b) fix FirmA→LawFirmA / lawchain.com labels in the
topology diagram (that one is a draw-tool artifact, separate source),
(c) re-check smallest-text diagrams (`access_and_decryption`, key-lifecycle
set) at print size. Do it on the original environment so bootstrap-CI
annotations stay in sync with prose. Pair with the still-open reviewer-lens
item **N5** (merge key-lifecycle Phases 1–4 into one figure): it recovers a
page and fixes the one remaining float cluster.

### 5. Two sentences of preemption in the text — effort: 1 hour; impact: MEDIUM
(a) Custodial-identity cost bound: per-user X.509 would add client-side
signing (sub-ms, Exp 6) but no additional ordering round-trip — one sentence
in Prototype Scope or Discussion (RISKS R4.2).
(b) Erasure visibility: half a sentence in the Introduction pointing to the
hash-anchor/erasable-ciphertext decomposition in §7 (RISKS R2). Both are
supported by existing evidence; neither adds claims.

### 6. Optional, only if a revision asks for it (do NOT pre-invest)
- **ProVerif/Tamarin model** of wrap+grant (≈1 week): the fixed property set
  P1–P4 is already the right submission-level answer; build the model only
  on reviewer request.
- **Anonymized real-workload replay** to replace the 16.7 TPS synthetic
  baseline: high cost (data acquisition), and the paper's hedging already
  contains the objection.
- **Graphical abstract** (2 h): BRA "encouraged"; a single-panel version of
  the two-layer enforcement pipeline is the natural candidate.
- **Highlights polish** after any abstract change (currently compliant).

## What NOT to do

- Do not add new capability claims (e.g., BFT, per-user X.509, PDC storage)
  ahead of implementation — the framework-vs-prototype table is the paper's
  credibility anchor; keep every row honest.
- Do not hardware-normalize `tab:numbers_comparison` — the "own testbed, no
  normalization" caveat is the defensible position.
- Do not reintroduce the removed hedging duplicates when editing; the
  consolidation (R1–R3/H1–H3) is what makes the paper read confident.

## Expected review outcome

With items 1–2 done, this manuscript is a solid fit for BRA's applied-systems
genre with an unusually deep evaluation; the realistic outcome is major-or-
minor revision hinging on (a) novelty-framing taste and (b) single-host
testbed questions — item 3 converts (b) into a footnote. Nothing in the
artifact base contradicts any claim in the paper (verified claim-by-claim in
`CHANGELOG_review.md` §8).
