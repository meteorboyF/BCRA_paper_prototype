#!/usr/bin/env python3
"""Render fig15_ci_headline.{png,pdf} — headline results with 95% CIs
(IMPROVEMENTS.md item 3.6).

Usage: plot_cis.py <out_dir>
Panel (a): Exp 1 throughput sweep with CIs (fabric fixedcount 50-600 shape,
canonical duration60s anchor at conc 50, valid PG points).
Panel (b): the ACL-cost story across measurement levels — Exp 2
function-level and Exp 14 end-to-end P50s with bootstrap 95% CIs.
Style matches Exp 1-9 house figures; palette CVD-validated.
"""
import csv
import math
import pathlib
import random
import statistics as st
import sys
from collections import defaultdict

ROOT = pathlib.Path(__file__).resolve().parents[2]
out = pathlib.Path(sys.argv[1])
rng = random.Random(7)
N_BOOT = 10000

try:
    import matplotlib.pyplot as plt
except Exception as e:
    print(f"matplotlib unavailable: {e}")
    sys.exit(0)

AMBER, BLUE, GREEN, INK = "#b45309", "#2563eb", "#16a34a", "#111111"


def boot_ci_median(vals):
    meds = sorted(st.median(rng.choices(vals, k=len(vals))) for _ in range(N_BOOT))
    return st.median(vals), meds[int(N_BOOT * .025)], meds[int(N_BOOT * .975)]


def t_ci_mean(vals):
    t = {4: 2.776, 5: 2.571, 9: 2.262, 10: 2.228}.get(len(vals) - 1, 1.96)
    m = st.mean(vals)
    half = t * st.stdev(vals) / math.sqrt(len(vals)) if len(vals) > 1 else 0
    return m, m - half, m + half


fig, (ax_a, ax_b) = plt.subplots(1, 2, figsize=(11, 4.6))

# (a) Exp 1 throughput with CIs ------------------------------------------------
e1 = list(csv.DictReader(open(ROOT / "results/exp1_throughput.csv")))
fab = defaultdict(list)
for r in e1:
    if r["tool"] == "fixedcount_x10" and r["batch_timeout_ms"] == "2000" \
            and r["mode"] == "fabric":
        fab[int(r["concurrency"])].append(float(r["tps"]))
xs = sorted(fab)
mids, los, his = zip(*(t_ci_mean(fab[c]) for c in xs))
ax_a.errorbar(xs, mids, yerr=[[m - l for m, l in zip(mids, los)],
                              [h - m for m, h in zip(mids, his)]],
              color=AMBER, marker="o", markersize=5, linewidth=2, capsize=3,
              label="Fabric mode (fixedcount tool)")
pg = defaultdict(list)
for r in e1:
    if r["tool"] == "duration60s" and r["mode"] == "postgres" \
            and int(r["concurrency"]) < 150:  # valid region only
        pg[int(r["concurrency"])].append(float(r["tps"]))
pxs = sorted(pg)
pmids, plos, phis = zip(*(t_ci_mean(pg[c]) for c in pxs))
ax_a.errorbar(pxs, pmids, yerr=[[m - l for m, l in zip(pmids, plos)],
                                [h - m for m, h in zip(pmids, phis)]],
              color=BLUE, marker="s", markersize=6, linewidth=2, capsize=3,
              linestyle="--", label="PostgreSQL-only (duration60s, valid region)")
dur50 = [float(r["tps"]) for r in e1 if r["tool"] == "duration60s"
         and r["batch_timeout_ms"] == "2000" and r["mode"] == "fabric"]
m, lo, hi = t_ci_mean(dur50)
ax_a.errorbar([50], [m], yerr=[[m - lo], [hi - m]], color=GREEN, marker="^",
              markersize=7, capsize=3, linestyle="none",
              label="Fabric, canonical duration60s @conc 50")
ax_a.set_xlabel("Concurrent clients")
ax_a.set_ylabel("Gateway throughput (TPS)")
ax_a.set_title("(a) Exp 1 throughput, mean with 95% CI (t)")
ax_a.legend(fontsize=8)

# (b) ACL cost across measurement levels ---------------------------------------
e2 = defaultdict(list)
for r in csv.DictReader(open(ROOT / "results/exp2_latency.csv")):
    if int(r["sample_idx"]) > 20 and r["operation"] == "checkaccess":
        e2[r["mode"]].append(float(r["latency_ms"]))
e14 = defaultdict(list)
for r in csv.DictReader(open(ROOT / "experiments/baseline_auditlog/results/"
                                    "20260716_122821/samples.csv")):
    if r["status"] == "200" and int(r["conc"]) == 10:
        e14[r["mode"]].append(float(r["latency_ms"]))

groups = [
    ("Exp 2 function-level\n(n=100 each)",
     [("Fabric CheckAccess", e2["fabric"], AMBER),
      ("PostgreSQL ACL", e2["db_only"], BLUE)]),
    ("Exp 14 end-to-end release,\nconc 10 (n=2000 each)",
     [("on-path enforcement", e14["onpath"], AMBER),
      ("audit-log-only baseline", e14["auditlog"], BLUE)]),
]
pos, ticks, tick_labels = 0, [], []
seen = set()
for glabel, bars in groups:
    centre = pos + (len(bars) - 1) / 2
    for blabel, vals, color in bars:
        m, lo, hi = boot_ci_median(vals)
        kind = "Fabric on-path" if color == AMBER else "PostgreSQL / baseline"
        ax_b.bar(pos, m, width=0.7, color=color,
                 label=kind if kind not in seen else None)
        seen.add(kind)
        ax_b.errorbar([pos], [m], yerr=[[m - lo], [hi - m]], color=INK,
                      capsize=4, linewidth=1.5)
        ax_b.annotate(f"{m:.2f}", (pos, hi), ha="center", va="bottom",
                      fontsize=8, color=INK)
        pos += 1
    ticks.append(centre)
    tick_labels.append(glabel)
    pos += 0.8
ax_b.set_xticks(ticks)
ax_b.set_xticklabels(tick_labels, fontsize=8)
ax_b.set_ylabel("Latency P50 (ms)")
ax_b.set_title("(b) Ledger ACL cost, P50 with bootstrap 95% CI")
ax_b.legend(fontsize=8)

for ax in (ax_a, ax_b):
    ax.grid(True, alpha=0.25)
    ax.set_axisbelow(True)

fig.suptitle("Headline results with 95% confidence intervals (Experiment 15)",
             fontsize=12)
fig.tight_layout(rect=(0, 0, 1, 0.94))
fig.savefig(out / "fig15_ci_headline.pdf")
fig.savefig(out / "fig15_ci_headline.png", dpi=180)
print(f"wrote {out / 'fig15_ci_headline.png'} and .pdf")
