#!/usr/bin/env python3
"""Generic CSV -> summary.json: mean, median(P50), min, max, stdev of a value column,
grouped by chosen columns. Excludes warm-up rows where trial==0 by default.

Usage:
  summarize.py <in.csv> <out.json> --group mode,batch_timeout_ms,concurrency --value tps
  [--also p50_ms,p95_ms] [--keep-trial0]
"""
import csv, sys, json, statistics, argparse

ap = argparse.ArgumentParser()
ap.add_argument("csv"); ap.add_argument("out")
ap.add_argument("--group", required=True)
ap.add_argument("--value", required=True)
ap.add_argument("--also", default="")
ap.add_argument("--keep-trial0", action="store_true")
a = ap.parse_args()

gcols = a.group.split(",")
also = [c for c in a.also.split(",") if c]
rows = list(csv.DictReader(open(a.csv)))

def num(x):
    try: return float(x)
    except: return None

groups = {}
for r in rows:
    if not a.keep_trial0 and r.get("trial", "1") in ("0",):
        continue
    key = tuple(r[c] for c in gcols)
    groups.setdefault(key, []).append(r)

def stats(vals):
    vals = [v for v in vals if v is not None]
    if not vals: return None
    return {
        "n": len(vals),
        "mean": round(statistics.mean(vals), 3),
        "p50": round(statistics.median(vals), 3),
        "min": round(min(vals), 3),
        "max": round(max(vals), 3),
        "stdev": round(statistics.stdev(vals), 3) if len(vals) > 1 else 0.0,
    }

out = []
for key in sorted(groups):
    g = groups[key]
    entry = {c: key[i] for i, c in enumerate(gcols)}
    entry[a.value] = stats([num(r[a.value]) for r in g])
    for col in also:
        entry[col] = stats([num(r[col]) for r in g])
    entry["raw_" + a.value] = [num(r[a.value]) for r in g]
    out.append(entry)

json.dump(out, open(a.out, "w"), indent=2)
print(f"wrote {a.out} ({len(out)} groups)")
for e in out:
    v = e[a.value]
    if v:
        print(f"  {'/'.join(str(e[c]) for c in gcols)}: mean={v['mean']} p50={v['p50']} "
              f"min={v['min']} max={v['max']} stdev={v['stdev']} n={v['n']}")
