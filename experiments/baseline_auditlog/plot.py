#!/usr/bin/env python3
"""Render fig14_baseline.{png,pdf} from a baseline_auditlog results dir.

Usage: plot.py <results_dir>
Panels: (a) gateway throughput vs concurrency, (b) request latency P50
(caps: P95) vs concurrency — on-path enforcement vs audit-log-only baseline.
Style matches Exp 1-9; palette CVD-validated.
"""
import csv
import pathlib
import sys

out = pathlib.Path(sys.argv[1])
rows = list(csv.DictReader(open(out / "levels.csv")))

try:
    import matplotlib.pyplot as plt
except Exception as e:
    print(f"matplotlib unavailable: {e}")
    sys.exit(0)

MODES = {"onpath": ("#b45309", "o", "on-path ledger CheckAccess (this work)"),
         "auditlog": ("#2563eb", "s", "audit-log-only baseline (DB ACL + async anchor)")}

fig, (ax_t, ax_l) = plt.subplots(1, 2, figsize=(11, 4.6))

for mode, (color, marker, label) in MODES.items():
    pts = sorted((r for r in rows if r["mode"] == mode), key=lambda r: int(r["conc"]))
    if not pts:
        continue
    x = [int(r["conc"]) for r in pts]
    ax_t.plot(x, [float(r["tps"]) for r in pts], color=color, marker=marker,
              markersize=6, linewidth=2, label=label)
    p50 = [float(r["p50_ms"]) for r in pts]
    p95 = [float(r["p95_ms"]) for r in pts]
    ax_l.errorbar(x, p50, yerr=[[0] * len(x), [h - m for h, m in zip(p95, p50)]],
                  color=color, marker=marker, markersize=6, linewidth=2,
                  capsize=3, label=label)

ax_t.set_xlabel("Concurrent clients (closed loop)")
ax_t.set_ylabel("Gateway throughput (requests/s)")
ax_t.set_title("(a) Document-release throughput")
ax_t.legend(fontsize=8)

ax_l.set_xlabel("Concurrent clients (closed loop)")
ax_l.set_ylabel("Request latency (ms), P50 (caps: P95)")
ax_l.set_title("(b) Document-release latency")
ax_l.legend(fontsize=8)

for ax in (ax_t, ax_l):
    ax.grid(True, alpha=0.25)
    ax.set_axisbelow(True)

fig.suptitle("Price of on-path enforcement vs Fabric-as-passive-audit-log (Experiment 14)",
             fontsize=12)
fig.tight_layout(rect=(0, 0, 1, 0.94))
fig.savefig(out / "fig14_baseline.pdf")
fig.savefig(out / "fig14_baseline.png", dpi=180)
print(f"wrote {out / 'fig14_baseline.png'} and .pdf")
