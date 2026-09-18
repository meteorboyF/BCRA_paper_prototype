#!/usr/bin/env python3
"""fig04 — sequence diagram: durable re-anchoring of a revocation issued
during an ordering-service outage.

Replaces the hand-drawn write_path_reconciliation.pdf, whose interior carried
a superseded median (15.9 s, July build), the lifeline name "Application
Server", and one British spelling (audit items H9/M10/L5). Values here are
the final hardened build's: median reconciliation lag after recovery 13.8 s
(n=5), worker poll 5 s, retry backoff min(5*2^k, 60) s. Loaded constants are
asserted so a rebuild on changed data fails loudly.

Layout rules, so nothing overlaps at print width:
  - every horizontal message owns a y band; labels sit inside that band,
  - the pending outbox row is an activation bar on the PostgreSQL lifeline
    rather than a free-floating double arrow over it,
  - the lag callout sits in the empty Gateway/PostgreSQL gutter and points
    at the activation bar with one short horizontal leader, crossing no
    lifeline,
  - side notes are placed in lane gutters, never on top of a lifeline.
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

# --- geometry ---------------------------------------------------------------
LANES = [(0.90, "Owner's\nbrowser"), (3.00, "Application\nGateway"),
         (5.20, "PostgreSQL +\noutbox"), (7.35, "Reconciliation\nworker"),
         (9.30, "Fabric\n(ordering)")]
X_BROWSER, X_GW, X_PG, X_WORK, X_FAB = [x for x, _ in LANES]
BAR_W = 0.055                    # half-width of the pending-row activation bar
Y_TOP, Y_BOT = 9.00, 1.40        # lifeline extent
Y_ROW, Y_COMMIT = 7.75, 2.45     # outbox row written / marked committed
Y_BAND = 4.85                    # bottom of the ordering-outage band

ps.apply()
fig, ax = plt.subplots(figsize=(6.6, 4.00))
ax.set_xlim(0, 10.15); ax.set_ylim(1.10, 10.0); ax.axis("off")

for x, name in LANES:
    ax.add_patch(Rectangle((x - 0.75, Y_TOP), 1.5, 0.85, facecolor=ps.C[3],
                           edgecolor=ps.EDGE, linewidth=0.9, zorder=2))
    ax.text(x, Y_TOP + 0.42, name, ha="center", va="center",
            fontsize=ps.FONT_SIZE - 1, zorder=3)
    ax.plot([x, x], [Y_BOT, Y_TOP], color=ps.GRID, linewidth=1.0, zorder=1)

# ordering outage band, behind everything on the Fabric lane
ax.add_patch(Rectangle((X_FAB - 0.55, Y_BAND), 1.1, Y_TOP - Y_BAND,
                       facecolor=ps.BAND, edgecolor="none", zorder=0))
ax.text(X_FAB, 8.78, "ordering\noutage", ha="center", va="top",
        fontsize=ps.FONT_SIZE - 1.5, style="italic", color=ps.GREY)

# the pending outbox row, as an activation bar on the PostgreSQL lifeline
ax.add_patch(Rectangle((X_PG - BAR_W, Y_COMMIT), 2 * BAR_W, Y_ROW - Y_COMMIT,
                       facecolor=ps.C[3], edgecolor=ps.EDGE, linewidth=0.8,
                       zorder=2))


def msg(x1, x2, y, text, style="-", color=ps.C[0], fs_off=1.0,
        pad_b=2.0, lx=None, ha="center"):
    """One message arrow. `lx`/`ha` place the label off-center so that no
    label lands on the activation bar or on a neighboring label."""
    ax.add_patch(FancyArrowPatch((x1, y), (x2, y), arrowstyle="-|>",
                 mutation_scale=11, linestyle=style, color=color,
                 linewidth=1.1, zorder=4, shrinkA=2.0, shrinkB=pad_b))
    ax.text((x1 + x2) / 2 if lx is None else lx, y + 0.13, text, ha=ha,
            va="bottom", fontsize=ps.FONT_SIZE - fs_off, zorder=4)


def note(x, y, text, color=ps.GREY):
    ax.text(x, y, text, ha="center", va="top", style="italic",
            fontsize=ps.FONT_SIZE - 1.5, color=color, zorder=4)


# --- messages, top to bottom; each owns a y band ----------------------------
msg(X_BROWSER, X_GW, 8.40, "revoke access")
msg(X_GW, X_PG, Y_ROW, "DB revoke +\nsigned outbox row\n(one transaction)",
    pad_b=3.0)
# long-span arrow: label sits at its source, clear of the activation bar
msg(X_GW, X_FAB, 7.05, "submit RevokeAccess", color=ps.C[2],
    lx=X_GW + 0.06, ha="left")
note(6.55, 6.72, "fails: ordering\nunreachable")
msg(X_GW, X_BROWSER, 6.45, "HTTP 202, ledger sync pending")
note(X_FAB, 5.98, "CheckAccess still\nauthorizes from\nlast-committed state",
     color=ps.C[4])
msg(X_WORK, X_PG, 4.85,
    "poll every 5 s;\nretry after\n$\\min(5\\cdot 2^{k},\\,60)$ s",
    style=(0, (3, 2)), color=ps.C[1], pad_b=3.0, lx=6.45)
note(X_FAB, Y_BAND - 0.07, "ordering recovers")
msg(X_WORK, X_FAB, 3.62, "resubmit RevokeAccess\n(one-time command id)",
    color=ps.C[2])
msg(X_FAB, X_WORK, 3.05, "committed", color=ps.C[2])
msg(X_WORK, X_PG, Y_COMMIT, "mark COMMITTED", color=ps.C[1], pad_b=3.0)
note(X_FAB, 2.05, "release path now\ndenies the revoked user", color=ps.C[4])

# --- lag callout: the empty Gateway/PostgreSQL gutter, pointing at the bar ---
Y_CALL = (Y_ROW + Y_COMMIT) / 2
ax.text(4.02, Y_CALL,
        f"reconciliation lag\nafter recovery:\nmedian {MED} s\n(n=5, final build)",
        ha="center", va="center", fontsize=ps.FONT_SIZE - 1, zorder=5,
        bbox=dict(boxstyle="round,pad=0.26", facecolor="white",
                  edgecolor=ps.EDGE, linewidth=0.8))
ax.add_patch(FancyArrowPatch((4.88, Y_CALL), (X_PG - BAR_W, Y_CALL),
             arrowstyle="-|>", mutation_scale=9, color=ps.EDGE,
             linewidth=0.8, zorder=5, shrinkA=0, shrinkB=0))

fig.tight_layout(pad=0.35)
ps.save(fig, "write_path_reconciliation", outdir=HERE / "out")
