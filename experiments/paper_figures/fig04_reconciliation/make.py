#!/usr/bin/env python3
"""fig04 — sequence diagram: durable re-anchoring of a revocation issued
during an ordering-service outage.

Replaces the hand-drawn write_path_reconciliation.pdf, whose interior carried
a superseded median (15.9 s, July build), the lifeline name "Application
Server", and one British spelling (audit items H9/M10/L5). Values here are
the final hardened build's: median reconciliation lag after recovery 13.8 s
(n=5), worker poll 5 s, retry backoff min(5*2^k, 60) s. Loaded constants are
asserted so a rebuild on changed data fails loudly.
"""
import statistics as st, sys, csv
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import pangostyle as ps
import matplotlib.pyplot as plt
from matplotlib.patches import FancyArrowPatch, Rectangle

HERE = Path(__file__).parent
rows = list(csv.DictReader(open(HERE.parent / "fig18_divergence/data/divergence_runs.csv")))
rev = sorted(float(r["window_s"]) for r in rows if r["path"] == "revoke")
assert len(rev) == 5 and round(st.median(rev), 2) == 13.75
MED = "13.8"

ps.apply()
fig, ax = plt.subplots(figsize=(6.6, 4.6))
ax.set_xlim(0, 10); ax.set_ylim(0, 10); ax.axis("off")

LANES = [(1.0, "Owner's\nbrowser"), (3.2, "Application\nGateway"),
         (5.4, "PostgreSQL +\noutbox"), (7.3, "Reconciliation\nworker"),
         (9.0, "Fabric\n(ordering)")]
for x, name in LANES:
    ax.add_patch(Rectangle((x-0.75, 9.0), 1.5, 0.85, facecolor=ps.C[3],
                           edgecolor=ps.EDGE, linewidth=0.9))
    ax.text(x, 9.42, name, ha="center", va="center", fontsize=ps.FONT_SIZE-1)
    ax.plot([x, x], [0.6, 9.0], color=ps.GRID, linewidth=1.0, zorder=1)

# outage band on the ordering lane
ax.add_patch(Rectangle((8.45, 4.85), 1.1, 4.15, facecolor=ps.BAND,
                       edgecolor="none", zorder=0))
ax.text(9.0, 8.72, "ordering\noutage", ha="center", va="top",
        fontsize=ps.FONT_SIZE-1.5, style="italic", color=ps.GREY)

def msg(x1, x2, y, text, style="-", color=ps.C[0], above=True, fs_off=1):
    ax.add_patch(FancyArrowPatch((x1, y), (x2, y), arrowstyle="-|>",
                 mutation_scale=11, linestyle=style, color=color, linewidth=1.1,
                 zorder=3, shrinkA=2, shrinkB=2))
    ax.text((x1+x2)/2, y + (0.13 if above else -0.32), text, ha="center",
            fontsize=ps.FONT_SIZE - fs_off)

msg(1.0, 3.2, 8.4, "revoke access")
msg(3.2, 5.4, 7.8, "DB revoke +\nsigned outbox row\n(one transaction)")
msg(3.2, 9.0, 7.1, "submit RevokeAccess", color=ps.C[2])
ax.text(6.35, 6.82, "fails:\nordering unreachable", fontsize=ps.FONT_SIZE-1.5, va="top",
        style="italic", color=ps.GREY, ha="center")
msg(3.2, 1.0, 6.6, "HTTP 202, ledger sync pending")
ax.text(9.0, 6.05, "CheckAccess still\nauthorizes from\nlast-committed state",
        ha="center", fontsize=ps.FONT_SIZE-1.5, style="italic", color=ps.C[4])
msg(7.3, 5.4, 5.5, "poll every 5 s;\nretry after min(5*2^k, 60) s",
    style=(0, (3, 2)), color=ps.C[1])
ax.text(9.0, 4.42, "ordering\nrecovers", ha="center",
        fontsize=ps.FONT_SIZE-1.5, style="italic", color=ps.GREY)
msg(7.3, 9.0, 3.8, "resubmit RevokeAccess\n(one-time command id)", color=ps.C[2])
msg(9.0, 7.3, 3.1, "committed", color=ps.C[2])
msg(7.3, 5.4, 2.5, "mark COMMITTED", color=ps.C[1])
ax.text(9.0, 1.95, "release path now\ndenies the revoked user", ha="center",
        fontsize=ps.FONT_SIZE-1.5, style="italic", color=ps.C[4])

# reconciliation-lag brace on the outbox lane
ax.add_patch(FancyArrowPatch((5.4, 7.75), (5.4, 2.55), arrowstyle="<|-|>",
             mutation_scale=9, color=ps.EDGE, linewidth=1.0, zorder=4))
ax.text(1.95, 4.0, f"reconciliation lag\nafter recovery:\nmedian {MED} s\n(n=5, final build)",
        ha="center", va="center", fontsize=ps.FONT_SIZE-1,
        bbox=dict(boxstyle="round,pad=0.28", facecolor="white",
                  edgecolor=ps.EDGE, linewidth=0.8))
ax.plot([2.95, 5.32], [4.55, 5.05], color=ps.EDGE, linewidth=0.7)

fig.tight_layout(pad=0.4)
ps.save(fig, "write_path_reconciliation", outdir=HERE / "out")
