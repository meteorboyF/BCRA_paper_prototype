#!/usr/bin/env python3
"""Render fig12_ledger_growth.{png,pdf} from a ledger_growth campaign dir.

Usage: plot.py <results_dir>
Panels: (a) query latency vs world-state size (log x), P50 with P95 caps;
        (b) disk usage vs document count with per-document growth annotation.
Style matches Exp 1-9 house figures; palette validated for CVD separation.
"""
import csv
import pathlib
import sys
from collections import defaultdict

out = pathlib.Path(sys.argv[1])

try:
    import matplotlib.pyplot as plt
except Exception as e:
    print(f"matplotlib unavailable: {e}")
    sys.exit(0)

INK = "#111111"
SERIES = {"CheckAccess": ("#b45309", "o"),
          "GetDocumentHistory": ("#2563eb", "s")}
DISK = {"blockstore_bytes": ("#b45309", "o", "peer block store"),
        "couchdb_bytes": ("#2563eb", "s", "CouchDB state DB")}


def p(sorted_vals, q):
    return sorted_vals[min(int(len(sorted_vals) * q), len(sorted_vals) - 1)]


lat = defaultdict(list)  # (function, checkpoint) -> [ms]
for r in csv.DictReader(open(out / "latency_samples.csv")):
    lat[(r["function"], int(r["checkpoint"]))].append(float(r["latency_ms"]))
disk = list(csv.DictReader(open(out / "disk.csv")))

fig, (ax_a, ax_b) = plt.subplots(1, 2, figsize=(11, 4.6))

# (a) latency vs world-state size ---------------------------------------------
for fn, (color, marker) in SERIES.items():
    cps = sorted(c for (f, c) in lat if f == fn)
    if not cps:
        continue
    med, hi = [], []
    for c in cps:
        v = sorted(lat[(fn, c)])
        med.append(p(v, 0.5))
        hi.append(p(v, 0.95))
    ax_a.errorbar(cps, med,
                  yerr=[[0] * len(cps), [h - m for h, m in zip(hi, med)]],
                  color=color, marker=marker, markersize=5, linewidth=2,
                  capsize=3, label=fn)
ax_a.set_xscale("log")
ax_a.set_xlabel("Documents in world state")
ax_a.set_ylabel("Query latency (ms)")
ax_a.set_title("(a) Ledger query latency vs world-state size, P50 (caps: P95)")
ax_a.set_ylim(bottom=0)
ax_a.legend(fontsize=8)

# (b) disk growth ---------------------------------------------------------------
docs = [int(r["checkpoint"]) for r in disk]
for key, (color, marker, label) in DISK.items():
    vals = [int(r[key]) / (1024 * 1024) for r in disk]
    ax_b.plot(docs, vals, color=color, marker=marker, markersize=5,
              linewidth=2, label=label)
if len(disk) >= 2:
    d0, d1 = disk[0], disk[-1]
    span = int(d1["checkpoint"]) - int(d0["checkpoint"])
    if span > 0:
        per_doc_bs = (int(d1["blockstore_bytes"]) - int(d0["blockstore_bytes"])) / span
        per_doc_cd = (int(d1["couchdb_bytes"]) - int(d0["couchdb_bytes"])) / span
        ax_b.annotate(f"block store: {per_doc_bs:.0f} B/doc\n"
                      f"CouchDB: {per_doc_cd:.0f} B/doc",
                      xy=(0.04, 0.72), xycoords="axes fraction", fontsize=8,
                      color=INK)
ax_b.set_xlabel("Documents registered")
ax_b.set_ylabel("Disk usage (MiB)")
ax_b.set_title("(b) Storage growth per component")
ax_b.legend(fontsize=8, loc="lower right")

for ax in (ax_a, ax_b):
    ax.grid(True, alpha=0.25)
    ax.set_axisbelow(True)

fig.suptitle("Document-volume / ledger-growth scaling (Experiment 12)", fontsize=12)
fig.tight_layout(rect=(0, 0, 1, 0.94))
fig.savefig(out / "fig12_ledger_growth.pdf")
fig.savefig(out / "fig12_ledger_growth.png", dpi=180)
print(f"wrote {out / 'fig12_ledger_growth.png'} and .pdf")
