#!/usr/bin/env python3
"""fig17 — staleness-ceiling sweep on the peer-clock freshness check.

Measured window to first refusal against the configured ceiling, with the
identity line: each window tracks its ceiling to within the 3 s poll
granularity, which is the visual form of the one-second-for-one-second trade
between outage tolerance and backdating tolerance. The disabled ceiling (0),
which never refused within the 200 s observation window, is annotated rather
than plotted as a point. Data: ./data/sweep.csv (corrected-semantics export
of the released sweepv2 run).
"""
import csv, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import pangostyle as ps

HERE = Path(__file__).parent
rows = list(csv.DictReader(open(HERE / "data/sweep.csv")))
pts = [(int(r["ceiling_seconds"]), int(r["observed_window_seconds"]))
       for r in rows if r["outcome"] == "refused"]
assert pts == [(30, 28), (60, 59), (120, 119)], pts
assert any(r["ceiling_seconds"] == "0" and r["outcome"].startswith("no_refusal") for r in rows)

ps.apply()
fig, ax = ps.figure(width=4.6, height=3.2)
lim = 140
ax.plot([0, lim], [0, lim], linestyle=(0, (4, 3)), color=ps.GREY,
        linewidth=1.1, label="Identity (window = ceiling)", zorder=2)
ax.scatter([p[0] for p in pts], [p[1] for p in pts], s=52, color=ps.C[0],
           edgecolor=ps.EDGE, linewidth=0.8, zorder=3,
           label="Measured window to first refusal")
for x, y in pts:
    ax.annotate(f"{y} s", (x, y), xytext=(6, -11),
                textcoords="offset points", fontsize=ps.FONT_SIZE - 1)

ax.annotate("ceiling 0 (disabled, default):\nno refusal within 200 s",
            xy=(0.04, 0.86), xycoords="axes fraction", ha="left",
            fontsize=ps.FONT_SIZE - 1, style="italic")
ax.set_xlim(0, lim)
ax.set_ylim(0, lim)
ax.set_xticks([0, 30, 60, 120])
ax.set_yticks([0, 30, 60, 120])
ax.set_xlabel("Configured staleness ceiling (s)")
ax.set_ylabel("Measured window (s)")
ax.legend(loc="lower right", fontsize=ps.FONT_SIZE - 1.5)
ax.grid(axis="both")
ps.save(fig, "fig17_staleness_sweep", outdir=HERE / "out")
