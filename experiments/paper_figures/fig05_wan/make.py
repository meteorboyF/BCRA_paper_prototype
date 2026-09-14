#!/usr/bin/env python3
"""fig05 — write throughput under injected round-trip delay.

Two configurations: delay on the client path only, and delay on the
inter-orderer Raft path as well. Mean TPS of five 60 s trials per point with
the individual trials shown; the Raft-delayed 150 ms point is annotated with
its request errors, because its throughput describes a degrading service.
Data: ./data/wan.csv (duration60s rows of the released exp5 sweep).
"""
import csv, statistics as st, sys
from collections import defaultdict
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import pangostyle as ps

HERE = Path(__file__).parent
agg = defaultdict(list)
err = defaultdict(int)
for r in csv.DictReader(open(HERE / "data/wan.csv")):
    k = (r["config"], int(r["rtt_ms"]))
    agg[k].append(float(r["tps"]))
    err[k] += int(float(r["errors"] or 0))

RTTS = [0, 50, 100, 150]
assert all(len(agg[(c, t)]) == 5 for c in ("bridge", "bridge_veth") for t in RTTS)
assert err[("bridge_veth", 150)] == 976
assert round(st.mean(agg[("bridge", 0)]), 1) == 68.2
assert round(st.mean(agg[("bridge_veth", 150)]), 1) == 38.3

ps.apply()
fig, ax = ps.figure(width=4.9, height=3.2)
SERIES = [
    ("bridge", "Client-path delay only", ps.C[0], "o"),
    ("bridge_veth", "Client + inter-orderer Raft delay", ps.C[2], "s"),
]
for cfg, label, color, marker in SERIES:
    means = [st.mean(agg[(cfg, t)]) for t in RTTS]
    ax.plot(RTTS, means, marker=marker, color=color, markeredgecolor=ps.EDGE,
            markeredgewidth=0.7, label=label, zorder=3)
    for t in RTTS:
        ax.scatter([t] * len(agg[(cfg, t)]), agg[(cfg, t)], s=11, color=color,
                   alpha=0.55, linewidths=0, zorder=2)

ax.annotate("Raft-delayed 150 ms: 976 request errors across five trials",
            xy=(0.975, 0.035), xycoords="axes fraction", ha="right",
            va="bottom", fontsize=ps.FONT_SIZE - 1.5, style="italic")
ax.set_xticks(RTTS)
ax.set_xlabel("Injected round-trip delay (ms)")
ax.set_ylabel("Write throughput (TPS)")
ax.set_title("Throughput under injected WAN delay")
ax.set_ylim(30, 78)
ax.legend(loc="upper right", fontsize=ps.FONT_SIZE - 1.5)
ax.grid(axis="y")
ps.save(fig, "fig05_wan_delay", outdir=HERE / "out")
