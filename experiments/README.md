# Experiments

Benchmark and evaluation code for the BRA submission. Manuscript lives on the
`bra-submission` branch; the work plan is that branch's `IMPROVEMENTS.md`.

## Results reports (one RESULTS.md per new experiment)

| Exp | IMPROVEMENTS.md item | Report | Evidence run | Figure |
|---|---|---|---|---|
| 10 — IPFS storage/retrieval cost | 3.4 | [`ipfs_cost/RESULTS.md`](ipfs_cost/RESULTS.md) | `ipfs_cost/results/20260715_173114/` | `fig10_ipfs_cost.png/.pdf` |
| 11 — Caliper direct-Fabric benchmark | 3.1 | [`caliper/RESULTS.md`](caliper/RESULTS.md) | `caliper/results/20260715_180121/` | `fig11_caliper.png/.pdf` |
| 12 — Ledger-growth scaling (10³–10⁶, complete) | 3.3 | [`ledger_growth/RESULTS.md`](ledger_growth/RESULTS.md) | `ledger_growth/results/20260715_183009/` | `fig12_ledger_growth.png/.pdf` |

Planned next (same pattern, one dir + RESULTS.md each): item 3.2
network-size scaling, item 3.5a passive-audit-log baseline, item 3.6
consolidated statistics.

## Layout

- Exp 1–9 scripts (throughput sweep, latency, filesize, audit, WAN, crypto,
  history, BatchTimeout, fail-closed): top level of this directory;
  `fail_closed_outage/` has the full runner + evidence bundle for Exp 9.
- `caliper/` — Caliper setups: REST-mode (legacy, `run-experiments.sh`) and
  direct-Fabric (`run-fabric-benchmark.sh`, Exp 11).
- `ipfs_cost/` — Exp 10, 3-node IPFS bench (`run.sh`, `--teardown` to restore).
- `.venv/` — local python env with matplotlib/numpy (gitignored; recreate with
  `python3 -m venv --without-pip .venv && curl -sSf https://bootstrap.pypa.io/get-pip.py | .venv/bin/python && .venv/bin/pip install matplotlib numpy`).

Conventions: each run writes a timestamped dir under `<exp>/results/` with
CSVs + `environment.json` + `run.log` + figure PNG/PDF; `results/smoke/` dirs
are gitignored validation runs, never evidence.
