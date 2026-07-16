#!/usr/bin/env python3
"""Render fig13_network_scaling.{png,pdf} from a network_scaling results dir.

Usage: plot.py <results_dir>
Panels: (a) write throughput vs org count, (b) latency vs org count (log y:
write P50 ~seconds, read P50 ~ms). Series = endorsement policy; the 2-peer
point is marked separately. Style matches Exp 1-9; palette CVD-validated.
"""
import csv
import pathlib
import sys

out = pathlib.Path(sys.argv[1])
# matrix_final.csv (curated: outlier rows replaced by verified reruns, see
# RESULTS.md) takes precedence over the raw matrix.csv when present.
src = out / ("matrix_final.csv" if (out / "matrix_final.csv").exists() else "matrix.csv")
rows = list(csv.DictReader(open(src)))
print(f"plotting from {src.name}")

try:
    import matplotlib.pyplot as plt
except Exception as e:
    print(f"matplotlib unavailable: {e}")
    sys.exit(0)

POL = {"majority": ("#b45309", "o", "majority endorsement"),
       "single": ("#2563eb", "s", "single-org endorsement")}

fig, (ax_t, ax_l) = plt.subplots(1, 2, figsize=(11, 4.6))

for pol, (color, marker, label) in POL.items():
    pts = sorted((r for r in rows
                  if r["policy"] == pol and r["peers_per_org"] == "1"),
                 key=lambda r: int(r["orgs"]))
    if not pts:
        continue
    x = [int(r["orgs"]) for r in pts]
    ax_t.plot(x, [float(r["write_tps"]) for r in pts], color=color,
              marker=marker, markersize=6, linewidth=2, label=label)
    ax_l.plot(x, [float(r["write_p50_ms"]) for r in pts], color=color,
              marker=marker, markersize=6, linewidth=2,
              label=f"RegisterDocument P50, {pol}")
    ax_l.plot(x, [float(r["read_p50_ms"]) for r in pts], color=color,
              marker=marker, markersize=6, linewidth=1.5, linestyle="--",
              label=f"CheckAccess P50, {pol}")

# 2-peer point(s), if measured, as standalone markers
for r in rows:
    if r["peers_per_org"] != "1":
        color, marker, _ = POL.get(r["policy"], ("#16a34a", "^", ""))
        ax_t.scatter([int(r["orgs"])], [float(r["write_tps"])], marker="^",
                     s=70, facecolors="none", edgecolors=color, linewidths=2,
                     label=f"{r['orgs']} orgs x {r['peers_per_org']} peers, {r['policy']}")
        ax_l.scatter([int(r["orgs"])], [float(r["write_p50_ms"])], marker="^",
                     s=70, facecolors="none", edgecolors=color, linewidths=2)

ax_t.set_xlabel("Organizations (1 peer each unless marked)")
ax_t.set_ylabel("Write throughput (TPS)")
ax_t.set_title("(a) RegisterDocument throughput vs network size")
ax_t.legend(fontsize=8)

ax_l.set_xlabel("Organizations (1 peer each unless marked)")
ax_l.set_ylabel("Latency (ms, P50)")
ax_l.set_yscale("log")
ax_l.set_title("(b) Latency vs network size")
ax_l.legend(fontsize=7)

for ax in (ax_t, ax_l):
    ax.grid(True, alpha=0.25)
    ax.set_axisbelow(True)
    ax.set_xticks(sorted({int(r["orgs"]) for r in rows}))

fig.suptitle("Network-size scaling: orgs, peers, endorsement policy (Experiment 13)",
             fontsize=12)
fig.tight_layout(rect=(0, 0, 1, 0.94))
fig.savefig(out / "fig13_network_scaling.pdf")
fig.savefig(out / "fig13_network_scaling.png", dpi=180)
print(f"wrote {out / 'fig13_network_scaling.png'} and .pdf")
