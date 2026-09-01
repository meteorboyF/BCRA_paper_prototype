#!/usr/bin/env python3
"""fig18 — write-path divergence: unattended reconvergence on both mutation paths.

Single clean panel: per-run divergence windows for RevokeAccess (Exp. 16b, n=5)
and GrantAccess (Exp. 18, n=6), medians drawn as bars. The exposure taxonomy
(confidentiality vs availability) belongs in a LaTeX table, not a figure box.
Self-contained: reads ./data/summary18.json (+ inline 16b released values), ./out."""
import json, statistics as st, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import pangostyle as ps

HERE = Path(__file__).parent
s18 = json.load(open(HERE / "data/summary18.json"))
grant_w = sorted(r["divergence_s"] for r in s18["grant_runs"] if r["divergence_s"])
# 16b released per-run windows (RESULTS.md: median 15.92, mean 15.85, SD 0.69,
# range 14.86-16.51, n=5).
revoke_w = [14.86, 15.65, 15.92, 16.30, 16.51]

ps.apply()
fig, ax = ps.figure(width=5.2, height=3.3)
series = [
    (0, "RevokeAccess\n(Exp. 16b, n=5)", revoke_w, ps.C[1]),
    (1, "GrantAccess\n(Exp. 18, n=6)", grant_w, ps.C[0]),
]
for i, label, xs, color in series:
    jitter = [i + (j - (len(xs) - 1) / 2) * 0.05 for j in range(len(xs))]
    ax.scatter(jitter, xs, s=42, color=color, edgecolor=ps.EDGE, linewidth=0.8, zorder=3)
    med = st.median(xs)
    ax.hlines(med, i - 0.24, i + 0.24, color=ps.EDGE, linewidth=2.4, zorder=4)
    ax.annotate(f"median\n{med:.1f} s", (i + 0.30, med), va="center", ha="left",
                fontsize=ps.FONT_SIZE - 0.5, fontweight="bold")

ax.set_xlim(-0.6, 1.9)
ax.set_ylim(10, 18)
ax.set_xticks([0, 1], [s[1] for s in series])
ax.set_ylabel("Divergence window (s)")
ax.set_title("Unattended reconvergence after an ordering outage")
ax.grid(axis="y")
ax.annotate("bounded by the same durable outbox on both paths;\nrevoke exposure is confidentiality, grant exposure is availability",
            xy=(0.5, -0.30), xycoords="axes fraction", ha="center",
            fontsize=ps.FONT_SIZE - 1.5, style="italic", annotation_clip=False)
ps.save(fig, "fig18_write_divergence", outdir=HERE / "out")
