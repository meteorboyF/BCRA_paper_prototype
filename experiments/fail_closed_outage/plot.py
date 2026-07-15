#!/usr/bin/env python3
import csv, pathlib, sys

out = pathlib.Path(sys.argv[1])
rows = list(csv.DictReader(open(out / "per_second.csv")))

try:
    import matplotlib.pyplot as plt
except Exception as e:
    print(f"matplotlib unavailable: {e}")
    sys.exit(0)

x = [int(r["second"]) for r in rows]
success = [int(r["success_200"]) for r in rows]
http503 = [int(r["http_503"]) for r in rows]
protected = [int(r["protected_bytes_returned"]) for r in rows]
outage_seconds = [int(r["second"]) for r in rows if r["phase"] == "outage"]

fig, ax = plt.subplots(figsize=(10, 4.8))
if outage_seconds:
    ax.axvspan(min(outage_seconds), max(outage_seconds) + 1, color="#d4af37", alpha=0.16, label="Fabric outage")
ax.plot(x, success, color="#111111", linewidth=2, label="Successful downloads")
ax.plot(x, http503, color="#b45309", linewidth=2, label="HTTP 503 fail-closed denials")
ax.set_xlabel("Time (seconds)")
ax.set_ylabel("Requests per second")
ax.set_title("Fail-Closed Fabric Outage: Document Downloads")
ax.grid(True, alpha=0.25)
ax.legend(loc="upper right")
if outage_seconds:
    mid = (min(outage_seconds) + max(outage_seconds)) / 2
    ax.annotate("Fabric unavailable:\nrequests denied fail-closed", xy=(mid, max(http503 or [1])), xytext=(mid, max(http503 or [1]) * 1.08 + 1),
                ha="center", arrowprops={"arrowstyle": "->", "color": "#b45309"}, color="#111111")
    if any(protected):
        ax.annotate(
            "Protected bytes returned: inspect failure",
            xy=(0.03, 0.08),
            xycoords="axes fraction",
            color="#b91c1c",
        )
fig.tight_layout()
fig.savefig(out / "fig_failclosed_outage.pdf")
fig.savefig(out / "fig_failclosed_outage.png", dpi=180)
