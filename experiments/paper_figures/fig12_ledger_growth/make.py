#!/usr/bin/env python3
"""fig12 — ledger growth on both scale axes (unified style).
Panel (a): storage vs document count (released document-scale series).
Panel (b): idle block-store growth from the ordered heartbeat (ledger_growth_12b).
Self-contained: reads ./data/, writes ./out/."""
import csv, json, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import pangostyle as ps

HERE = Path(__file__).parent
DATA = HERE / "data"

_ds = list(csv.DictReader(open(HERE / "data/doc_scale.csv")))
docs = [int(r["documents"]) for r in _ds]
blockstore_mb = [float(r["blockstore_mb"]) for r in _ds]
statedb_mb = [float(r["statedb_mb"]) for r in _ds]
assert docs == [10**3, 10**4, 10**5, 10**6] and blockstore_mb[-1] == 5618.0

rows = [r for r in csv.DictReader(open(DATA / "ledger_size.csv")) if r["phase"] == "idle"]
t0 = int(rows[0]["epoch_s"]); b0 = int(rows[0]["blockstore_bytes"])
mins = [(int(r["epoch_s"]) - t0) / 60 for r in rows]
kb = [(int(r["blockstore_bytes"]) - b0) / 1000 for r in rows]  # decimal kB, matching MB/day
a = json.load(open(DATA / "analysis.json"))["phase_a"]
assert abs(a["blockstore_mb_per_day"] - 7.839) < 0.01

ps.apply()
fig, (axa, axb) = ps.panels(2, width=6.8, height=2.9)

axa.plot(docs, blockstore_mb, marker="o", color=ps.C[0], label="Peer block store")
axa.plot(docs, statedb_mb, marker="s", color=ps.C[1], label="CouchDB state DB")
axa.set_xscale("log"); axa.set_yscale("log")
axa.set_xlabel("Documents registered")
axa.set_ylabel("Disk usage per peer (MB)")
axa.set_title("(a) Growth in documents", fontsize=ps.FONT_SIZE)
axa.set_ylim(top=4e4)
axa.legend(loc="upper left", fontsize=ps.FONT_SIZE - 1.5)
axa.annotate("~7 KB per document per peer", xy=(0.97, 0.05), xycoords="axes fraction",
             ha="right", fontsize=ps.FONT_SIZE - 1, style="italic")

axb.plot(mins, kb, marker="o", markersize=3.4, color=ps.C[1],
         label="Block store, zero document activity")
axb.plot([0, mins[-1]], [0, a["blockstore_bytes_per_s"] * mins[-1] * 60 / 1000],
         linestyle=(0, (4, 3)), color=ps.GREY, label="Fitted 7.84 MB/day ($R^2$=1.0000)")
axb.set_xlabel("Elapsed time, no documents registered (min)")
axb.set_ylabel("Block store growth (kB)")
axb.set_title("(b) Growth in time", fontsize=ps.FONT_SIZE)
axb.set_xlim(-0.8, 21)
axb.set_ylim(0, 130)
axb.legend(loc="upper left", fontsize=ps.FONT_SIZE - 1.5)
axb.annotate("~1 block/min:\none ordered heartbeat/min", xy=(0.96, 0.10),
             xycoords="axes fraction", ha="right", fontsize=ps.FONT_SIZE - 1, style="italic")

fig.tight_layout()
ps.save(fig, "fig12_ledger_growth", outdir=HERE / "out")
