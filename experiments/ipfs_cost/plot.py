#!/usr/bin/env python3
"""Render fig10_ipfs_cost.{png,pdf} from an ipfs_cost results directory.

Usage: plot.py <results_dir>
Style follows the existing Exp 1-9 figures (recessive grid, alpha 0.25,
house amber #b45309, 180 dpi PNG + vector PDF).
Palette (#b45309, #2563eb, #16a34a) validated for CVD separation and
surface contrast; series additionally carry distinct markers/linestyles.
"""
import csv
import pathlib
import sys
from collections import defaultdict

out = pathlib.Path(sys.argv[1])

try:
    import matplotlib.pyplot as plt
except Exception as e:
    print(f"matplotlib unavailable: {e}")
    sys.exit(0)

INK = "#111111"
SERIES = ["#b45309", "#2563eb", "#16a34a"]  # validated categorical order
MARKERS = ["o", "s", "^"]


def load(name):
    p = out / name
    return list(csv.DictReader(open(p))) if p.exists() else []


def p50(vals):
    v = sorted(vals)
    return v[len(v) // 2] if v else float("nan")


def p95(vals):
    v = sorted(vals)
    return v[min(int(len(v) * 0.95), len(v) - 1)] if v else float("nan")


retrieval = load("retrieval.csv")
replication = load("replication.csv")
storage = load("storage.csv")
node_down = load("node_down.csv")

fig, axes = plt.subplots(2, 2, figsize=(11, 8.2))
(ax_a, ax_b), (ax_c, ax_d) = axes

# (a) retrieval latency vs size -----------------------------------------------
lat = defaultdict(list)  # (source, conc, size) -> [ms]
for r in retrieval:
    if int(r["ok"]):
        lat[(r["source"], int(r["concurrency"]), int(r["size_mb"]))].append(
            float(r["latency_ms"]))
concs = sorted({c for (_, c, _) in lat})
sizes = sorted({s for (_, _, s) in lat})
for i, conc in enumerate(concs):
    med = [p50(lat[("remote", conc, s)]) for s in sizes]
    hi = [p95(lat[("remote", conc, s)]) for s in sizes]
    ax_a.errorbar(sizes, med, yerr=[[0] * len(sizes),
                                    [h - m for h, m in zip(hi, med)]],
                  color=SERIES[i % 3], marker=MARKERS[i % 3], markersize=5,
                  linewidth=2, capsize=3, label=f"remote, {conc} concurrent")
if any(("local", concs[0], s) in lat for s in sizes):
    med = [p50(lat[("local", concs[0], s)]) for s in sizes]
    ax_a.plot(sizes, med, color=INK, linestyle="--", linewidth=1.5,
              label=f"local node baseline ({concs[0]} concurrent)")
ax_a.set_xlabel("File size (MB)")
ax_a.set_ylabel("Retrieval latency (ms)")
ax_a.set_title("(a) IPFS retrieval latency, P50 (caps: P95)")
ax_a.legend(fontsize=8)

# (b) replication pin time vs size --------------------------------------------
pin = defaultdict(list)  # (replica_index, size) -> [ms]
for r in replication:
    pin[(int(r["replica_index"]), int(r["size_mb"]))].append(float(r["pin_ms"]))
rsizes = sorted({s for (_, s) in pin})
for i, (idx, label) in enumerate([(2, "2nd replica (2-node pinning)"),
                                  (3, "3rd replica (3-node pinning)")]):
    med = [p50(pin[(idx, s)]) for s in rsizes]
    hi = [p95(pin[(idx, s)]) for s in rsizes]
    ax_b.errorbar(rsizes, med, yerr=[[0] * len(rsizes),
                                     [h - m for h, m in zip(hi, med)]],
                  color=SERIES[i], marker=MARKERS[i], markersize=5,
                  linewidth=2, capsize=3, label=label)
ax_b.set_xlabel("File size (MB)")
ax_b.set_ylabel("Pin time (ms)")
ax_b.set_title("(b) Replication cost per added replica, P50 (caps: P95)")
ax_b.legend(fontsize=8)

# (c) storage overhead ---------------------------------------------------------
ssizes = [int(r["size_mb"]) for r in storage]
over = [float(r["overhead_pct"]) for r in storage]
bars = ax_c.bar([str(s) for s in ssizes], over, color=SERIES[0], width=0.55)
for b, v in zip(bars, over):
    ax_c.annotate(f"{v:.2f}%", (b.get_x() + b.get_width() / 2, v),
                  ha="center", va="bottom", fontsize=8, color=INK)
ax_c.set_xlabel("File size (MB)")
ax_c.set_ylabel("DAG overhead vs raw ciphertext (%)")
ax_c.set_title("(c) IPFS storage overhead (UnixFS DAG vs raw bytes)")
ax_c.set_ylim(0, max(over) * 1.3 if over else 1)

# (d) node-down behaviour ------------------------------------------------------
order = ["all_up", "one_replica_down", "all_replicas_down", "recovery"]
labels = ["all\nreplicas up", "one replica\ndown", "all replicas\ndown", "after\nrecovery"]
sc = defaultdict(lambda: {"ok": [], "n": 0})
for r in node_down:
    s = sc[r["scenario"]]
    s["n"] += 1
    if int(r["ok"]):
        s["ok"].append(float(r["latency_ms"]))
meds = [p50(sc[s]["ok"]) if sc[s]["ok"] else 0 for s in order]
cols = [SERIES[1] if sc[s]["ok"] else "#9ca3af" for s in order]
bars = ax_d.bar(labels, meds, color=cols, width=0.55)
for b, s in zip(bars, order):
    n_ok, n = len(sc[s]["ok"]), sc[s]["n"]
    if n_ok:
        txt = f"{p50(sc[s]['ok']):.0f} ms\n{n_ok}/{n} served"
        y = b.get_height()
    else:
        txt = f"0/{n} served\n(timeout)"
        y = max(meds) * 0.04 if any(meds) else 1
    ax_d.annotate(txt, (b.get_x() + b.get_width() / 2, y), ha="center",
                  va="bottom", fontsize=8, color=INK)
ax_d.set_xlabel("Scenario (document pinned on 2 of 3 nodes)")
ax_d.set_ylabel("Retrieval latency, P50 (ms)")
ax_d.set_title("(d) Retrieval under IPFS node failure")

for ax in (ax_a, ax_b, ax_c, ax_d):
    ax.grid(True, alpha=0.25)
    ax.set_axisbelow(True)

fig.suptitle("IPFS storage and retrieval cost (Experiment 10)", fontsize=13)
fig.tight_layout(rect=(0, 0, 1, 0.97))
fig.savefig(out / "fig10_ipfs_cost.pdf")
fig.savefig(out / "fig10_ipfs_cost.png", dpi=180)
print(f"wrote {out / 'fig10_ipfs_cost.png'} and .pdf")
