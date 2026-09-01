# Paper figures — self-contained, per-figure folders

Every figure the BCRA paper renders from measured data lives in its own folder and
is reproducible in isolation: `<folder>/make.py` reads only `<folder>/data/` and
writes `<folder>/out/{pdf,png}`. Shared style (muted CVD-validated palette, black
borders, dashed y-grid, embedded fonts) is `pangostyle.py`. Rebuild everything with
`PANGO_PY=/path/to/venv/python bash build_all.sh`.

The palette was validated computationally for colour-vision-deficiency separation
on a white surface; every figure adds a secondary encoding (direct labels, bar
gaps, distinct markers) so identity never rests on hue alone. No bright colours;
consistent scheme across the set, in the spirit of the IEEE version.

| Folder | Output | Paper element | Source data | Guards |
|---|---|---|---|---|
| `fig02_latency/` | `fig2_latency` | Read-path latency (Table readpath, Fig latency) | `function_latency_exp2/results/20260801_155550` | asserts P50 10.99 / 6.44 ms |
| `fig09_failclosed/` | `fig9_failclosed_outage` | Induced-outage fail-closed | `fail_closed_outage/final_evidence_bundle` | asserts 0 protected bytes |
| `fig12_ledger_growth/` | `fig12_ledger_growth` | Ledger growth, both axes | `ledger_growth_12b/results/20260801_132837` + released doc-scale series | asserts 7.84 MB/day |
| `fig14b_baseline/` | `fig14b_durable_baseline` | On-path vs audit-log baselines | `baseline_auditlog/results/20260731_150414` | asserts 469.5 TPS / 209.31 ms |
| `fig18_divergence/` | `fig18_write_divergence` | **NEW** grant+revoke reconvergence | `grant_outage_reconciliation_18/summary18.json` + 16b released windows | n=6 grant, n=5 revoke |
| `fig_netscale/` | `fig13_network_scaling` | Consortium-size scaling (supplementary) | `network_scaling/results/20260715_225854` + `o7verify` corrected 7-org majority | asserts corrected 35.7 TPS |

Notes:
- **fig18 is new** (this campaign): the write-path divergence result now covers
  both the revoke and grant paths. The exposure taxonomy (confidentiality vs
  availability) is a LaTeX table in the paper, not a figure box.
- **fig_netscale** replaces the contention-affected 7-org majority point with the
  isolated `o7verify` re-run, exactly as the paper's exclusion table describes.
- Schematic figures (topology, role hierarchy, write-path reconciliation
  sequence) are hand-drawn, not generated here.
- WAN and batch-timeout results are table-only in the paper; no figure is
  generated for them (their released CSVs do not carry the batch/config arm the
  table cites, so a figure would misrepresent them).
