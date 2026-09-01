#!/usr/bin/env python3
"""fig9 — release-path behavior through an induced ledger outage (unified style).
Self-contained: reads ./data/per_second.csv, writes ./out/."""
import csv, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import pangostyle as ps

HERE = Path(__file__).parent
rows = list(csv.DictReader(open(HERE / "data/per_second.csv")))
x = [int(r["second"]) for r in rows]
success = [int(r["success_200"]) for r in rows]
http503 = [int(r["http_503"]) for r in rows]
protected = sum(int(r["protected_bytes_returned"]) for r in rows)
outage = [int(r["second"]) for r in rows if r["phase"] == "outage"]
assert protected == 0, f"protected bytes returned: {protected}"

ps.apply()
fig, ax = ps.figure(width=6.2, height=3.0)
ax.axvspan(min(outage), max(outage) + 1, color=ps.BAND, zorder=0, label="Fabric outage")
ax.plot(x, success, color=ps.C[0], label="Successful downloads (HTTP 200)")
ax.plot(x, http503, color=ps.C[1], label="Fail-closed denials (HTTP 503)")
ax.set_xlabel("Time (s)")
ax.set_ylabel("Requests per second")
ax.set_xlim(min(x), max(x))
ax.set_ylim(0, max(max(success), max(http503)) * 1.28)
ax.legend(loc="upper right")
ax.annotate("zero protected bytes released",
            xy=((min(outage) + max(outage)) / 2, 2.5), ha="center",
            fontsize=ps.FONT_SIZE - 0.5, style="italic", color=ps.EDGE)
ps.save(fig, "fig9_failclosed_outage", outdir=HERE / "out")
