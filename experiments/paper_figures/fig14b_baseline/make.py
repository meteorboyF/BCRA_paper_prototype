#!/usr/bin/env python3
"""fig14b — on-path enforcement vs both audit-log-only baselines (unified style).
Grouped bars at the two measured concurrency levels. Self-contained: ./data, ./out."""
import csv, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import pangostyle as ps

HERE = Path(__file__).parent
rows = list(csv.DictReader(open(HERE / "data/levels.csv")))
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
fig, (axa, axb) = ps.panels(2, width=6.8, height=3.0)
width = 0.24
for mi, (mode, label, color) in enumerate(MODES):
    xs = [ci + (mi - 1) * width for ci in range(len(CONC))]
    tb = axa.bar(xs, [val(mode, c, "tps") for c in CONC], width * 0.92,
                 color=color, edgecolor=ps.EDGE, linewidth=0.8, label=label)
    pb = axb.bar(xs, [val(mode, c, "p50_ms") for c in CONC], width * 0.92,
                 color=color, edgecolor=ps.EDGE, linewidth=0.8, label=label)
    ps.label_bars(axa, tb)
    ps.label_bars(axb, pb)

for ax, ylab, title in [(axa, "Gateway throughput (req/s)", "(a) Throughput"),
                        (axb, "Release latency P50 (ms)", "(b) Latency")]:
    ax.set_xticks(range(len(CONC)), [f"{c} clients" for c in CONC])
    ax.set_ylabel(ylab)
    ax.set_title(title, fontsize=ps.FONT_SIZE)
    ax.margins(y=0.16)
axa.legend(loc="upper left", fontsize=ps.FONT_SIZE - 1.5)

fig.tight_layout()
ps.save(fig, "fig14b_durable_baseline", outdir=HERE / "out")
