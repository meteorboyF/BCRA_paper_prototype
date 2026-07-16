# Legacy Figure Regeneration (fig1–fig9) — Results Report

- **Purpose:** completes IMPROVEMENTS.md item 3.6's "add confidence
  intervals to the headline plots" for the ORIGINAL nine experiments, and
  makes every manuscript figure reproducible from committed raw data.
- **Evidence run:** `experiments/legacy_figures/results/20260716_145930/`
  (fig1–fig9, PNG 180 dpi + vector PDF)
- **Inputs:** repo-root `results/*.csv` (verified raw bundle) and
  `experiments/fail_closed_outage/final_evidence_bundle/` (Exp 9);
  canonical filters per `results/DELTAS.md`. Deterministic (bootstrap
  seed 7).

## What changed vs the published figures (review before swapping into the manuscript)

| Fig | Change | Why |
|---|---|---|
| fig1 | PostgreSQL series **truncated to conc ≤ 100** (valid region); both series now carry 95% CIs | conc ≥ 150 PG rows are self-flagged harness-invalid (DELTAS.md); the old figure may have plotted them |
| fig2 | Warmed-only samples (n=100/cell), bootstrap CIs; the 6.51 vs 7.16 ms pair now shows **overlapping CIs** | statistical support for the "no significant added delay" claim |
| fig3 | Log-scale latency axis; Fabric-commit constant drawn as a CI band | makes size-independence + the 2.13 s constant readable in one panel |
| fig4 | CIs added (n=10/method) | |
| fig5 | **Full 8-point RTT sweep, both configs** (bridge + bridge_veth), t-CIs | supersedes the old ~22 TPS-regime baselines per DELTAS.md |
| fig6 | 12 primitives, log-scale horizontal bars, CIs; title flags the **Node WebCrypto runtime** | honest-runtime disclosure carried into the figure itself |
| fig7 | Trial strip + median + CI band (n=10, depth 107) | replaces whatever aggregate the old figure used; single-depth data supports no trend line |
| fig8 | Two panels (TPS mean + t-CI; P50 latency + bootstrap CI) across 2000/500/250 ms | shows the reproducible 250 < 500 ms non-monotonicity with intervals |
| fig9 | Re-rendered from the evidence bundle, house style | note: denials persist ~20 s past the outage window — the backend circuit breaker's 30 s open state before half-open recovery; consistent with the published narrative but visible |

Statistic conventions: medians via `statistics.median` with bootstrap
percentile CIs (10k resamples); trial-level TPS as means with Student-t
CIs. Values can differ ≤0.1 ms from per-experiment logs that used
floor-index percentiles.

## Reproduce

```bash
experiments/.venv/bin/python experiments/legacy_figures/regen_figs.py \
  --out experiments/legacy_figures/results/<stamp>
```

## Not done here

Swapping these into `bra_submission/figures/` is manuscript work —
excluded from this campaign's scope. When that happens, figure captions
must be updated to state the CI method and the valid-region filtering
(fig1) and superseded-baseline change (fig5).
