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
- [ ] **Item 5**: abstract grammar bug "Fabric-based access checks add no
  statistically significant delay" — sentence is now grammatical after
  item 1's edit, but the abstract still exceeds BRA's ≤200-word target;
  tighten in item 5.
- [ ] **Item 5**: keywords — journal cap 6; consider swapping "Digital
  forensics" for "IPFS" (IMPROVEMENTS.md item 5).
- [ ] **Item 5**: reference repairs — `macaroons2014` + `zanzibar2019`
  missing pages; `seoBlockchain2024` metadata verification; last-accessed
  dates for URL-only refs.
- [ ] **Item 5**: fig9 caption must explain the ~20 s post-outage denial
  tail (circuit breaker 30 s open state) when regenerated figures are
  swapped in.
- [ ] **Item 5**: figure captions for regenerated fig1/fig5 must state CI
  method, fig1 PG valid-region filtering, fig5 superseded baselines
  (see `experiments/legacy_figures/RESULTS.md`).
- [ ] **Item 5**: CRediT roles — user adds manually (author sign-off).
- [ ] **Item 5**: data availability statement — repository choice
  (GitHub vs Zenodo DOI) deferred by user; draft both variants.
- [ ] **Before camera-ready**: re-verify page citations for the three
  journal pre-proofs (RBAC-IPFS, Liu & Zheng, Notash) against versions of
  record — affects the comparison table and any page-cited claims.
- [ ] **Before camera-ready**: pre-proof caveat — RBAC-IPFS numbers
  (146–156 ms, 356–450 TPS) cited in main.tex come from an uncorrected
  proof; re-check against the version of record.
