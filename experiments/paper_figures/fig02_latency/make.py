#!/usr/bin/env python3
"""fig2 — read-path latency (unified paper style).

Self-contained: reads ./data/ and writes ./out/. Data is the citable quiet-host
run (function_latency_exp2/results/20260801_155550): CheckAccess pooled Fabric
brackets vs PostgreSQL lookup, RegisterDocument for scale. Section 7.1 method:
120 samples/op, first 20 discarded; bootstrap percentile CI on the median,
10,000 resamples, fixed seed. Assertions guard the published medians.
"""
import csv, random, statistics as st, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import pangostyle as ps

HERE = Path(__file__).parent
DATA = HERE / "data"
SEED, RESAMPLES, WARMUP = 42, 10_000, 20


def samples(fname, op="checkaccess"):
    return [float(r["latency_ms"]) for r in csv.DictReader(open(DATA / fname))
            if r["operation"] == op and int(r["sample_idx"]) > WARMUP]


def boot_ci(xs):
    rng = random.Random(SEED)
    meds = sorted(st.median(rng.choices(xs, k=len(xs))) for _ in range(RESAMPLES))
    return meds[int(0.025 * RESAMPLES)], meds[int(0.975 * RESAMPLES)]


fabric = samples("exp2_latency.fabric1.csv") + samples("exp2_latency.fabric2.csv")
db = samples("exp2_latency.dbonly.csv")
reg = [float(r["latency_ms"]) for r in csv.DictReader(open(DATA / "exp2_latency.fabric1.csv"))
       if r["operation"] == "registerdoc" and int(r["sample_idx"]) > WARMUP]
assert abs(st.median(fabric) - 10.989) < 0.01, st.median(fabric)
assert abs(st.median(db) - 6.438) < 0.01, st.median(db)

arms = [
    ("CheckAccess\nFabric evaluate\n(n=200, pooled)", fabric, ps.C[0]),
    ("CheckAccess\nPostgreSQL lookup\n(n=100)", db, ps.C[1]),
    ("RegisterDocument\nendorse+order+commit\n(n=100)", reg, ps.GREY),
]

ps.apply()
fig, ax = ps.figure(width=5.4, height=3.4)
for i, (label, xs, color) in enumerate(arms):
    p50 = st.median(xs)
    lo, hi = boot_ci(xs)
    ax.bar(i, p50, width=0.58, color=color, edgecolor=ps.EDGE, linewidth=0.8,
           yerr=[[p50 - lo], [hi - p50]], error_kw=dict(ecolor=ps.EDGE, lw=1.1, capsize=4))
    ax.annotate(f"{p50:,.2f}", (i, p50), xytext=(0, 6), textcoords="offset points",
                ha="center", fontsize=ps.FONT_SIZE, fontweight="bold")
ax.set_yscale("log")
ax.set_ylim(3, 9000)
ax.set_ylabel("Latency P50 (ms, log scale)")
ax.set_xticks(range(len(arms)), [a[0] for a in arms])
ax.grid(axis="y", which="both")
ps.save(fig, "fig2_latency", outdir=HERE / "out")
