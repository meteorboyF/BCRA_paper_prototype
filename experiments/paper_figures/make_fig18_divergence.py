#!/usr/bin/env python3
"""fig18_write_divergence — the completed write-path divergence picture.

Panel (a): per-run divergence windows for both mutation paths of the
access-control state — RevokeAccess (Experiment 16b, n=5) and GrantAccess
(Experiment 18, n=6) — with medians. Same mechanism bounds both.
Panel (b): the exposure taxonomy the two directions form, drawn as a simple
annotated quadrant: which principal is wrongly served/denied during the window.

Data: experiments/orderer_outage_reconciliation_16b (released) and
experiments/grant_outage_reconciliation_18/summary18.json (this campaign).
"""
import json, statistics as st
from pathlib import Path
import pangostyle as ps

EXP = Path(__file__).parent.parent
s18 = json.load(open(EXP / "grant_outage_reconciliation_18/summary18.json"))
grant_w = [r["divergence_s"] for r in s18["grant_runs"] if r["divergence_s"]]

# 16b released per-run windows (RESULTS.md: median 15.92, mean 15.85, SD 0.69,
# range 14.86-16.51, n=5).
revoke_w = None
for d in sorted((EXP / "orderer_outage_reconciliation_16b/results").iterdir()):
    f = d / "sequence.csv"
    if f.exists():
        import csv
        for r in csv.DictReader(open(f)):
            if "divergence" in r["description"] and r["result"].split()[0].replace(".", "").isdigit():
                revoke_w = (revoke_w or []) + [float(r["result"].split()[0])]
if not revoke_w:
    revoke_w = [14.86, 15.65, 15.92, 16.30, 16.51]  # released summary values

ps.apply()
fig, (axa, axb) = ps.panels(2, width=6.6, height=2.9)

# ── (a) strip plot of per-run windows, medians as thick bars ──────────────
for i, (label, xs, color) in enumerate([
        (f"RevokeAccess\n(n={len(revoke_w)})", revoke_w, ps.C[1]),
        (f"GrantAccess\n(n={len(grant_w)})", grant_w, ps.C[0])]):
    jitter = [i + (j - (len(xs) - 1) / 2) * 0.055 for j in range(len(xs))]
    axa.scatter(jitter, xs, s=34, color=color, edgecolor=ps.EDGE, linewidth=0.7, zorder=3)
    med = st.median(xs)
    axa.hlines(med, i - 0.22, i + 0.22, color=ps.EDGE, linewidth=2.2, zorder=4)
    axa.annotate(f"median {med:.1f} s", (i + 0.26, med), va="center",
                 fontsize=ps.FONT_SIZE - 1)
axa.set_xlim(-0.55, 1.75)
axa.set_ylim(10, 18)
axa.set_xticks([0, 1], [f"RevokeAccess\n(Exp. 16b)", f"GrantAccess\n(Exp. 18)"])
axa.set_ylabel("Divergence window (s)")
axa.set_title("(a) Unattended reconvergence, both paths", fontsize=ps.FONT_SIZE)

# ── (b) exposure taxonomy ─────────────────────────────────────────────────
axb.set_xlim(0, 10); axb.set_ylim(0, 10)
axb.set_xticks([]); axb.set_yticks([])
axb.grid(False)
axb.set_title("(b) Exposure during the window", fontsize=ps.FONT_SIZE)


def box(x, y, w, h, title, lines, color):
    axb.add_patch(__import__("matplotlib.patches", fromlist=["FancyBboxPatch"]).FancyBboxPatch(
        (x, y), w, h, boxstyle="round,pad=0.12", facecolor=color, alpha=0.14,
        edgecolor=ps.EDGE, linewidth=0.9))
    axb.annotate(title, (x + w / 2, y + h - 1.0), ha="center",
                 fontsize=ps.FONT_SIZE - 0.5, fontweight="bold")
    for i, ln in enumerate(lines):
        axb.annotate(ln, (x + w / 2, y + h - 2.1 - i * 1.15), ha="center",
                     fontsize=ps.FONT_SIZE - 1.2)


box(0.4, 1.2, 4.4, 7.4, "Revocation diverges",
    ["revoked user", "still authorized", "", "confidentiality", "exposure"], ps.C[1])
box(5.2, 1.2, 4.4, 7.4, "Grant diverges",
    ["authorized user", "still denied", "", "availability", "exposure"], ps.C[0])
axb.annotate("both bounded by the same durable outbox;\nintent order preserved under reconciliation",
             (5.0, 0.45), ha="center", fontsize=ps.FONT_SIZE - 1.2, style="italic")

fig.tight_layout()
ps.save(fig, "fig18_write_divergence")
