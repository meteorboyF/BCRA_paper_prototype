#!/usr/bin/env python3
"""Parse Caliper's final results table from a run log into caliper_rounds.csv.

Usage: parse-report.py <run.log> <out.csv>
Looks for the summary table after '### All test results ###'. Row format:
| label | Succ | Fail | Send Rate (TPS) | Max (s) | Min (s) | Avg (s) | Throughput (TPS) |
"""
import csv
import re
import sys

log_path, csv_path = sys.argv[1], sys.argv[2]
text = open(log_path, errors="replace").read()

idx = text.find("### All test results ###")
if idx < 0:
    sys.exit("ERROR: no '### All test results ###' section in log")
section = text[idx:]

rows = []
for line in section.splitlines():
    m = re.match(
        r"\s*.*\|\s*([a-z]+-\d+)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|"
        r"\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|"
        r"\s*([\d.]+)\s*\|", line)
    if not m:
        continue
    label = m.group(1)
    func, load = label.rsplit("-", 1)
    rows.append({
        "label": label, "function": func, "offered_load": int(load),
        "succ": int(m.group(2)), "fail": int(m.group(3)),
        "send_rate_tps": float(m.group(4)),
        "max_latency_s": float(m.group(5)), "min_latency_s": float(m.group(6)),
        "avg_latency_s": float(m.group(7)),
        "throughput_tps": float(m.group(8)),
    })

if not rows:
    sys.exit("ERROR: results section found but no rows parsed")
with open(csv_path, "w", newline="") as fh:
    w = csv.DictWriter(fh, fieldnames=list(rows[0].keys()))
    w.writeheader()
    w.writerows(rows)
print(f"wrote {csv_path} ({len(rows)} rounds)")
