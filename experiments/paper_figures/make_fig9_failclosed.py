#!/usr/bin/env python3
"""fig9_failclosed_outage — release-path behavior through an induced ledger outage,
regenerated in the unified paper style from the released per-second evidence bundle
(experiments/fail_closed_outage/final_evidence_bundle/per_second.csv)."""
import csv
from pathlib import Path
import pangostyle as ps

DATA = Path(__file__).parent.parent / "fail_closed_outage/final_evidence_bundle/per_second.csv"
rows = list(csv.DictReader(open(DATA)))

x = [int(r["second"]) for r in rows]
success = [int(r["success_200"]) for r in rows]
http503 = [int(r["http_503"]) for r in rows]
protected = sum(int(r["protected_bytes_returned"]) for r in rows)
outage = [int(r["second"]) for r in rows if r["phase"] == "outage"]
assert protected == 0, f"protected bytes returned during outage run: {protected}"

ps.apply()
fig, ax = ps.figure(width=6.0, height=3.0)
ax.axvspan(min(outage), max(outage) + 1, color=ps.BAND, zorder=0, label="Fabric outage")
ax.plot(x, success, color=ps.C[0], label="Successful downloads (HTTP 200)")
ax.plot(x, http503, color=ps.C[1], label="Fail-closed denials (HTTP 503)")
ax.set_xlabel("Time (s)")
ax.set_ylabel("Requests per second")
ax.set_xlim(min(x), max(x))
ax.set_ylim(bottom=0)
ax.legend(loc="upper right")
ax.annotate("zero protected bytes released",
            xy=((min(outage) + max(outage)) / 2, 2), ha="center",
            fontsize=ps.FONT_SIZE - 0.5, style="italic", color=ps.EDGE)
ps.save(fig, "fig9_failclosed_outage")
