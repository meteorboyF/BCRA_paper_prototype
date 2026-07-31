#!/usr/bin/env python3
"""Render fig14b_durable_baseline.{png,pdf} from a three-mode baseline results dir.

Usage: plot14b.py <results_dir>

Panels: (a) gateway throughput vs concurrency, (b) request latency P50 (caps: P95)
vs concurrency, for on-path enforcement against BOTH audit-log-only baselines -
the fire-and-forget one of Experiment 14 and the durable batched one of 14b.

Two panels rather than one with two y-axes: throughput and latency are different
measures on different scales, and a dual-axis chart would invite reading a crossing
point that means nothing.

Palette: extends plot.py's two CVD-validated hues with a third, checked together as
a categorical set (lightness band, chroma floor, adjacent CVD separation,
normal-vision floor, contrast). The worst adjacent tritan separation lands in the
6-8 floor band, which is only legal alongside secondary encoding, so each series
also carries a distinct marker - the markers are load-bearing for accessibility,
not decoration.
"""
import csv
import pathlib
import sys

out = pathlib.Path(sys.argv[1])
rows = list(csv.DictReader(open(out / "levels.csv")))

try:
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
except Exception as e:
    print(f"matplotlib unavailable: {e}")
    sys.exit(0)

# Fixed order, assigned by identity and never cycled.
MODES = [
    ("onpath", "#b45309", "o", "on-path ledger CheckAccess (this work)"),
    ("auditlog", "#2563eb", "s", "audit-log-only, fire-and-forget anchoring"),
    ("auditlog-durable", "#15803d", "^", "audit-log-only, durable batched anchoring"),
]

fig, (ax_t, ax_l) = plt.subplots(1, 2, figsize=(11, 4.6))

for mode, color, marker, label in MODES:
    pts = sorted((r for r in rows if r["mode"] == mode), key=lambda r: int(r["conc"]))
    if not pts:
        continue
    conc = [int(r["conc"]) for r in pts]
    tps = [float(r["tps"]) for r in pts]
    p50 = [float(r["p50_ms"]) for r in pts]
    p95 = [float(r["p95_ms"]) for r in pts]

    ax_t.plot(conc, tps, color=color, marker=marker, markersize=8, linewidth=2,
              label=label, zorder=3)
    # P95 as a cap above P50 rather than a second line: it is the same measure's
    # tail, so it belongs on the same scale as an error-bar-style extent.
    ax_l.plot(conc, p50, color=color, marker=marker, markersize=8, linewidth=2,
              label=label, zorder=3)
    ax_l.vlines(conc, p50, p95, color=color, linewidth=1.2, alpha=0.55, zorder=2)
    ax_l.scatter(conc, p95, color=color, marker="_", s=90, linewidths=1.6,
                 alpha=0.75, zorder=2)

for ax, ylabel, title in (
        (ax_t, "Gateway throughput (requests/s)", "(a) Throughput"),
        (ax_l, "Request latency (ms), P50 with P95 cap", "(b) Latency")):
    # Tick only at measured levels: intermediate ticks would imply the sweep sampled
    # concurrencies it never ran.
    ax.set_xticks(sorted({int(r["conc"]) for r in rows}))
    ax.set_xlabel("Concurrent clients")
    ax.set_ylabel(ylabel)
    ax.set_title(title, fontsize=11)
    ax.grid(True, alpha=0.25, linewidth=0.6)
    ax.set_axisbelow(True)
    for spine in ("top", "right"):
        ax.spines[spine].set_visible(False)

# One legend for both panels; identity is never carried by colour alone.
handles, labels = ax_t.get_legend_handles_labels()
fig.legend(handles, labels, loc="lower center", ncol=1, frameon=False,
           bbox_to_anchor=(0.5, -0.10), fontsize=9)

fig.tight_layout()
for ext in ("png", "pdf"):
    path = out / f"fig14b_durable_baseline.{ext}"
    fig.savefig(path, dpi=200, bbox_inches="tight")
    print(f"wrote {path}")
