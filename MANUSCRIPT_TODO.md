# Manuscript TODO — deferred items (running list)

Tracks every deferred edit so nothing falls through the cracks across
items 1 → 0 → 4 → 2 → 5. Remove entries when resolved; note the resolving
commit.

## Deferred during item 1 (novelty recut)

- [x] **"Direct numerical comparison is not possible" paragraph** —
  resolved in item 0: rewritten to scope the claim to REST-gateway
  workloads, extended citations, and forward-referenced Exp 11 +
  `tab:numbers_comparison`.

## Carried from earlier phases (fix during the noted item)

- [x] **Item 0**: "2-node IPFS swarm" wording — lit-table row and
  framework-vs-prototype row now reference Experiment 10's 3-node
  bench measurements; contribution-paragraph wording left accurate
  (app swarm is 2-node).
- [x] **Item 5**: abstract tightened to ~201 words with CI-backed numbers,
  ends on the delta sentence.
- [x] **Item 5**: keywords — "Digital forensics" swapped for "IPFS", 6 kept.
- [x] **Item 5**: reference repairs — `zanzibar2019` pages 33–46 +
  publisher/address added (warning gone); `macaroons2014` DOI
  10.14722/ndss.2014.23212 + publisher/address added (NDSS unpaginated —
  remaining warning documented as legitimate); `seoBlockchain2024`
  metadata verified correct against IEEE Xplore but the entry is
  **uncited in main.tex** — AUTHOR DECISION: cite it or delete the entry.
  New web refs all carry last-accessed dates.
- [x] **Item 5**: fig9 swapped to the regenerated version; caption and all
  three "15-second" prose claims corrected to the measured 20 s recovery
  lag with the circuit-breaker explanation (first success at t=95 per
  the evidence bundle).
- [ ] **DEFERRED — fig1–fig8 swap-in**: the published figures are richer
  compositions than the data-bundle regenerations (fig1 shaded
  client-saturation region referenced by prose; fig2 audit-query bars;
  fig5 latency panel; fig7 projection lines discussed in caption; fig8
  single-panel). Swapping now would break text–figure consistency.
  Requires composition upgrades to
  `experiments/legacy_figures/regen_figs.py` on prototype-fixes first,
  then per-caption CI-method updates (fig1 PG valid region, fig5
  superseded baselines). Not blocking submission — the published
  figures remain valid; CIs are reported numerically in
  `sec:exp_consolidated`.
- [ ] **Item 5 — AUTHOR-OWNED**: CRediT roles — skeleton untouched as
  agreed; user fills manually with co-author sign-off.
- [ ] **Item 5 — AUTHOR-OWNED**: data availability — BOTH variants drafted
  in main.tex (B1 GitHub-as-is currently active; B2 Zenodo-DOI commented
  with placeholder). Pick one before submission; if B2, deposit a release
  and fill the DOI.
- [ ] **Before camera-ready**: re-verify page citations for the three
  journal pre-proofs (RBAC-IPFS, Liu & Zheng, Notash) against versions of
  record — affects the comparison table and any page-cited claims.
- [ ] **Before camera-ready**: pre-proof caveat — RBAC-IPFS numbers
  (146–156 ms, 356–450 TPS) cited in main.tex come from an uncorrected
  proof; re-check against the version of record.
