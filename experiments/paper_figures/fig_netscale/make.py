#!/usr/bin/env python3
"""fig_netscale — write throughput and read latency vs consortium size, both
endorsement policies. The 7-org majority point is the corrected o7verify re-run
(the original suffered transient host contention and is excluded per the paper's
exclusion table). Self-contained: reads ./data, writes ./out."""
import csv, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import pangostyle as ps

HERE = Path(__file__).parent
full = {r["label"]: r for r in csv.DictReader(open(HERE / "data/matrix_full.csv"))}
o7 = {r["label"]: r for r in csv.DictReader(open(HERE / "data/matrix_o7verify.csv"))}
# Replace the contention-affected 7-org majority point with the isolated re-run.
full["o7p1-majority"] = o7["o7p1-majority"]

orgs = [2, 3, 5, 7]
single = [full[f"o{o}p1-single"] for o in orgs]
major = [full[f"o{o}p1-majority"] for o in orgs]
assert abs(float(major[-1]["write_tps"]) - 35.7) < 0.1  # corrected o7 majority

ps.apply()
fig, (axa, axb) = ps.panels(2, width=6.8, height=2.9)

axa.plot(orgs, [float(r["write_tps"]) for r in single], marker="o", color=ps.C[0],
         label="Single-org endorsement")
axa.plot(orgs, [float(r["write_tps"]) for r in major], marker="s", color=ps.C[1],
         label="Majority endorsement")
axa.set_xlabel("Consortium size (organizations)")
axa.set_ylabel("Write throughput (TPS)")
axa.set_title("(a) Write throughput", fontsize=ps.FONT_SIZE)
axa.set_xticks(orgs)
axa.set_ylim(30, 46)
axa.legend(loc="lower left")

axb.plot(orgs, [float(r["read_p50_ms"]) for r in single], marker="o", color=ps.C[0],
         label="Single-org endorsement")
axb.plot(orgs, [float(r["read_p50_ms"]) for r in major], marker="s", color=ps.C[1],
         label="Majority endorsement")
axb.set_xlabel("Consortium size (organizations)")
axb.set_ylabel("Read P50 (ms)")
axb.set_title("(b) Read latency (no trend)", fontsize=ps.FONT_SIZE)
axb.set_xticks(orgs)
axb.set_ylim(0, 8)
axb.legend(loc="upper left")

fig.tight_layout()
ps.save(fig, "fig13_network_scaling", outdir=HERE / "out")
