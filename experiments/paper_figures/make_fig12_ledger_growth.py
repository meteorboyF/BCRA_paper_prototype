#!/usr/bin/env python3
"""fig12_ledger_growth — both scale axes in the unified paper style.

Panel (a): storage vs document count. Values are the released document-scale
campaign series (paper Table: Scale in document volume; 10^3..10^6 documents),
which is the same data the previous figure generation used.
Panel (b): idle growth from the ordered time-anchor heartbeat, plotted from the
released per-minute samples in ledger_growth_12b (idle phase), with the fitted
rate 7.84 MB/day (R^2 = 1.0000) from the released analysis.
"""
import csv, json
from pathlib import Path
import pangostyle as ps

RUN12B = Path(__file__).parent.parent / "ledger_growth_12b/results/20260801_132837"

# Released document-scale series (per peer).
docs = [10**3, 10**4, 10**5, 10**6]
blockstore_mb = [5.8, 56.5, 561.5, 5618.0]
statedb_mb = [2.0, 14.0, 135.8, 1390.0]

# Idle series: block store growth at zero document activity.
rows = [r for r in csv.DictReader(open(RUN12B / "ledger_size.csv")) if r["phase"] == "idle"]
t0 = int(rows[0]["epoch_s"]); b0 = int(rows[0]["blockstore_bytes"])
mins = [(int(r["epoch_s"]) - t0) / 60 for r in rows]
kb = [(int(r["blockstore_bytes"]) - b0) / 1024 for r in rows]
a = json.load(open(RUN12B / "analysis.json"))["phase_a"]
assert abs(a["blockstore_mb_per_day"] - 7.839) < 0.01

ps.apply()
fig, (axa, axb) = ps.panels(2, width=6.6, height=2.8)

axa.plot(docs, blockstore_mb, marker="o", color=ps.C[0], label="Peer block store")
axa.plot(docs, statedb_mb, marker="s", color=ps.C[1], label="CouchDB state DB")
axa.set_xscale("log"); axa.set_yscale("log")
axa.set_xlabel("Documents registered")
axa.set_ylabel("Disk usage per peer (MB)")
axa.set_title("(a) Growth in documents", fontsize=ps.FONT_SIZE)
axa.legend(loc="upper left")
axa.annotate("~7 KB per document per peer", xy=(0.97, 0.06),
             xycoords="axes fraction", ha="right",
             fontsize=ps.FONT_SIZE - 1, style="italic")

axb.plot(mins, kb, marker="o", markersize=3.4, color=ps.C[1],
         label="Block store, zero document activity")
axb.plot([0, mins[-1]], [0, a["blockstore_bytes_per_s"] * mins[-1] * 60 / 1024],
         linestyle=(0, (4, 3)), color=ps.GREY, label="Fitted 7.84 MB/day ($R^2$=1.0000)")
axb.set_xlabel("Elapsed time, no documents registered (min)")
axb.set_ylabel("Block store growth (KB)")
axb.set_title("(b) Growth in time", fontsize=ps.FONT_SIZE)
axb.legend(loc="upper left")
axb.annotate("1.00 block/min:\none ordered heartbeat/min", xy=(0.55, 0.14),
             xycoords="axes fraction", fontsize=ps.FONT_SIZE - 1, style="italic")

fig.tight_layout()
ps.save(fig, "fig12_ledger_growth")
