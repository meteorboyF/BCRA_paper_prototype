#!/usr/bin/env python3
"""Experiment 18 analysis — aggregates every grant/fifo run under results/ into
summary statistics and a machine-readable summary.json. Statistical conventions
match Section 7.1 of the paper: median with bootstrap percentile CI (10,000
resamples, fixed seed) when n supports it; counts reported as counts."""
import csv, json, random, statistics as st
from pathlib import Path

RES = Path(__file__).parent / "results"
SEED, RESAMPLES = 42, 10_000


def boot_ci(xs):
    rng = random.Random(SEED)
    meds = sorted(st.median(rng.choices(xs, k=len(xs))) for _ in range(RESAMPLES))
    return meds[int(0.025 * RESAMPLES)], meds[int(0.975 * RESAMPLES)]


def read_run(d):
    seq = {r["step"]: r["result"] for r in csv.DictReader(open(d / "sequence.csv"))}
    return seq


out = {"grant_runs": [], "fifo_runs": []}
for d in sorted(RES.iterdir()):
    if not d.is_dir():
        continue
    seq = read_run(d)
    run = {
        "dir": d.name,
        "baseline_403": "403" in seq.get("0", ""),
        "grant_http": seq.get("2", ""),
        "mid_outage_download": seq.get("3", ""),
        "mid_outage_wrapped_key": seq.get("4", ""),
        "tri_state": seq.get("5", ""),
        "converged": "converged=1" in seq.get("6", ""),
        "post_download": seq.get("7", ""),
        "divergence_s": float(seq["8"].split()[0]) if seq.get("8", "").split()[0].replace(".", "").isdigit() else None,
    }
    if d.name.startswith("fifo"):
        run["fifo_order_ok"] = seq.get("9", "").strip() == "t"
        out["fifo_runs"].append(run)
    else:
        out["grant_runs"].append(run)

gw = [r["divergence_s"] for r in out["grant_runs"] if r["divergence_s"]]
fw = [r["divergence_s"] for r in out["fifo_runs"] if r["divergence_s"]]
lo, hi = boot_ci(gw)
out["summary"] = {
    "n_grant": len(out["grant_runs"]),
    "n_fifo": len(out["fifo_runs"]),
    "grant_divergence_s": {
        "median": round(st.median(gw), 2), "mean": round(st.mean(gw), 2),
        "sd": round(st.stdev(gw), 2), "min": round(min(gw), 2), "max": round(max(gw), 2),
        "boot95_lo": round(lo, 2), "boot95_hi": round(hi, 2),
    },
    "fifo_divergence_s": [round(x, 2) for x in fw],
    "all_grants_202_pending": all("202" in r["grant_http"] for r in out["grant_runs"] + out["fifo_runs"]),
    "all_mid_outage_denied": all("403" in r["mid_outage_download"] and "403" in r["mid_outage_wrapped_key"]
                                 for r in out["grant_runs"] + out["fifo_runs"]),
    "all_converged_unattended": all(r["converged"] for r in out["grant_runs"] + out["fifo_runs"]),
    "all_grant_runs_end_200": all("200" in r["post_download"] for r in out["grant_runs"]),
    "all_fifo_runs_end_403": all("403" in r["post_download"] for r in out["fifo_runs"]),
    "all_fifo_intent_order_preserved": all(r["fifo_order_ok"] for r in out["fifo_runs"]),
}
json.dump(out, open(RES.parent / "summary18.json", "w"), indent=2)
print(json.dumps(out["summary"], indent=2))
