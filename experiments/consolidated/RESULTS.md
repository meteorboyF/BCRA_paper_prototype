# Experiment 15 — Consolidated Evidence Table + Confidence Intervals

- **IMPROVEMENTS.md item:** 3.6 (statistical presentation)
- **Evidence run:** `experiments/consolidated/results/20260716_131526/`
- **Outputs:** `consolidated_evidence.csv` (37 metrics), `consolidated_table.md`
  (reviewer-facing, with footnotes), `fig15_ci_headline.png/.pdf`
- **Inputs:** `results/` raw bundle (Exp 1–8 + fail-open control, canonical
  filters per `results/DELTAS.md`) and the committed evidence runs of
  Exp 9–14 under `experiments/<exp>/results/`

## Method

- **95% CIs:** bootstrap percentile CI (10,000 resamples, seed 7) for
  medians/P50s computed from per-sample data; Student-t CI for means of
  trial-level TPS (n = 5–10 trials). Categorical outcomes (Exp 9 zero-leak
  counts) and single-run measurements (Caliper rounds, Exp 13 TPS points)
  carry no CI and are labeled as such.
- **Canonical filters carried from DELTAS.md:** Exp 1 uses
  tool=duration60s @ BatchTimeout 2 s for canonical numbers (the 50–600
  sweep *shape* is the fixedcount tool, shown separately in fig15a);
  PostgreSQL rows at conc ≥ 150 are excluded as self-flagged
  harness-invalid; Exp 6 is labeled as Node WebCrypto fallback.
- **Exp 13 note:** per-sample latencies for o7p1-majority come from the
  verified rerun (`results/o7verify/`), not the main run's documented
  host-artifact samples.
- Medians here use `statistics.median` (averages central pair); individual
  experiment consoles used a floor-index percentile, so values can differ
  by ≤ 0.1 ms from per-experiment logs (e.g., Exp 12 @10⁶: 8.54 vs 8.60 ms).

## Headline observations the CIs add

1. **Exp 2's "no significant added delay" claim now has interval support:**
   Fabric CheckAccess P50 6.51 ms [6.33, 7.22] vs PostgreSQL ACL 7.16 ms
   [6.60, 7.81] — **overlapping CIs**, difference within noise, direction
   actually favors Fabric.
2. **Exp 14's end-to-end premium is real but small:** on-path 21.62 ms
   [21.39, 21.84] vs baseline 15.09 ms [14.84, 15.36] at conc 10 —
   **non-overlapping CIs**, premium ≈ 6.5 ms, matching the Exp 2
   function-level delta measured 5 weeks earlier on a different build.
3. Cross-experiment coherence: CheckAccess P50 lands at 6.5–8.6 ms in four
   independent setups (Exp 2, Exp 12 @10³–10⁶ docs, Exp 13 across 2–7 org
   topologies, Exp 14 end-to-end minus transport) — the consolidated table
   makes that visible in one place.

## Reproduce

```bash
experiments/.venv/bin/python experiments/consolidated/build_table.py \
  --out experiments/consolidated/results/<stamp>
experiments/.venv/bin/python experiments/consolidated/plot_cis.py \
  experiments/consolidated/results/<stamp>
```

Deterministic given the committed inputs (fixed bootstrap seed).
