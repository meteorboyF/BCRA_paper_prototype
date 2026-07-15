#!/usr/bin/env python3
"""Render fig11_caliper.{png,pdf} from caliper_rounds.csv.

Usage: plot-caliper.py <results_dir>
Style matches Exp 1-9 house figures. Caliper reports avg/min/max latency
(no percentiles); the band shows min..max, the line is the average.
Palette (#b45309, #2563eb) validated for CVD separation; series also carry
distinct markers/linestyles.
"""
import csv
import pathlib
import sys

out = pathlib.Path(sys.argv[1])
rows = list(csv.DictReader(open(out / "caliper_rounds.csv")))

try:
    import matplotlib.pyplot as plt
except Exception as e:
    print(f"matplotlib unavailable: {e}")
    sys.exit(0)

SERIES = {"register": ("#b45309", "o", "RegisterDocument (submit, write)"),
          "checkaccess": ("#2563eb", "s", "CheckAccess (evaluate, read)")}

fig, (ax_t, ax_l) = plt.subplots(1, 2, figsize=(11, 4.6))

for func, (color, marker, label) in SERIES.items():
    data = sorted((r for r in rows if r["function"] == func),
                  key=lambda r: int(r["offered_load"]))
    if not data:
        continue
    x = [int(r["offered_load"]) for r in data]
    ax_t.plot(x, [float(r["throughput_tps"]) for r in data], color=color,
              marker=marker, markersize=5, linewidth=2, label=label)
    avg = [float(r["avg_latency_s"]) * 1000 for r in data]
    lo = [float(r["min_latency_s"]) * 1000 for r in data]
    hi = [float(r["max_latency_s"]) * 1000 for r in data]
    ax_l.plot(x, avg, color=color, marker=marker, markersize=5, linewidth=2,
              label=label)
    ax_l.fill_between(x, lo, hi, color=color, alpha=0.12, linewidth=0)

ax_t.set_xlabel("Offered load (concurrent transactions, fixed-load)")
ax_t.set_ylabel("Throughput (TPS)")
ax_t.set_title("(a) Caliper throughput vs offered load")
ax_t.legend(fontsize=8)

ax_l.set_xlabel("Offered load (concurrent transactions, fixed-load)")
ax_l.set_ylabel("Latency (ms, avg; band: min-max)")
ax_l.set_yscale("log")
ax_l.set_title("(b) Caliper latency vs offered load")
ax_l.legend(fontsize=8)

for ax in (ax_t, ax_l):
    ax.grid(True, alpha=0.25)
    ax.set_axisbelow(True)

fig.suptitle("Hyperledger Caliper benchmark of legalcc, 3-org network (Experiment 11)",
             fontsize=12)
fig.tight_layout(rect=(0, 0, 1, 0.94))
fig.savefig(out / "fig11_caliper.pdf")
fig.savefig(out / "fig11_caliper.png", dpi=180)
print(f"wrote {out / 'fig11_caliper.png'} and .pdf")
