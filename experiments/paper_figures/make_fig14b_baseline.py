#!/usr/bin/env python3
"""fig14b_durable_baseline — on-path enforcement vs both audit-log-only baselines,
unified paper style. Data: released run experiments/baseline_auditlog/results/20260731_150414
(1,000 requests per level, zero failures in every cell). Grouped bars at the two
measured concurrency levels — no line interpolation between two points."""
import csv
from pathlib import Path
import pangostyle as ps

RUN = Path(__file__).parent.parent / "baseline_auditlog/results/20260731_150414"
rows = list(csv.DictReader(open(RUN / "levels.csv")))
MODES = [
    ("onpath", "On-path enforcement (this work)", ps.C[0]),
    ("auditlog", "Audit-log-only, fire-and-forget", ps.C[1]),
    ("auditlog-durable", "Audit-log-only, durable batched", ps.C[2]),
]
CONC = [10, 50]


def val(mode, conc, field):
    return float(next(r[field] for r in rows if r["mode"] == mode and int(r["conc"]) == conc))


assert val("onpath", 10, "tps") == 469.5 and val("auditlog-durable", 50, "p50_ms") == 209.31

ps.apply()
fig, (axa, axb) = ps.panels(2, width=6.6, height=2.9)
width = 0.24
for mi, (mode, label, color) in enumerate(MODES):
    xs = [ci + (mi - 1) * width for ci in range(len(CONC))]
    tps = [val(mode, c, "tps") for c in CONC]
    p50 = [val(mode, c, "p50_ms") for c in CONC]
    axa.bar(xs, tps, width * 0.92, color=color, edgecolor=ps.EDGE, linewidth=0.8, label=label)
    axb.bar(xs, p50, width * 0.92, color=color, edgecolor=ps.EDGE, linewidth=0.8, label=label)
    for x, v in zip(xs, tps):
        axa.annotate(f"{v:.0f}", (x, v), xytext=(0, 2.5), textcoords="offset points",
                     ha="center", fontsize=ps.FONT_SIZE - 1.5)
    for x, v in zip(xs, p50):
        axb.annotate(f"{v:.0f}", (x, v), xytext=(0, 2.5), textcoords="offset points",
                     ha="center", fontsize=ps.FONT_SIZE - 1.5)

for ax, ylab, title in [(axa, "Gateway throughput (req/s)", "(a) Throughput"),
                        (axb, "Release latency P50 (ms)", "(b) Latency")]:
    ax.set_xticks(range(len(CONC)), [f"{c} clients" for c in CONC])
    ax.set_ylabel(ylab)
    ax.set_title(title, fontsize=ps.FONT_SIZE)
    ax.margins(y=0.14)
axa.legend(loc="upper left", fontsize=ps.FONT_SIZE - 1.5)

fig.tight_layout()
ps.save(fig, "fig14b_durable_baseline")
