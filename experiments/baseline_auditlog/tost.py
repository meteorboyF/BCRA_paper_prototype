#!/usr/bin/env python3
"""TOST equivalence test on the ledger-vs-database access decision (reviewer item 6).

Experiment 2 concluded "statistically indistinguishable" from a non-significant
Mann-Whitney result, which does not establish equivalence. RQ2 fixes a 50 ms margin,
so test against it directly.

Usage: tost.py <samples.csv> [margin_ms] [conc]
"""
import csv, math, statistics as st, sys

path = sys.argv[1]
MARGIN = float(sys.argv[2]) if len(sys.argv) > 2 else 50.0
CONC = sys.argv[3] if len(sys.argv) > 3 else "10"

arms = {"onpath": [], "auditlog": []}
for r in csv.DictReader(open(path)):
    if r["conc"] == CONC and r["mode"] in arms and r["status"] == "200":
        arms[r["mode"]].append(float(r["latency_ms"]))

a, b = arms["onpath"], arms["auditlog"]
for name, v in (("on-path (ledger CheckAccess)", a), ("PostgreSQL ACL", b)):
    print(f"{name:32s} n={len(v)} P50={st.median(v):.2f}ms mean={st.mean(v):.2f}ms SD={st.stdev(v):.2f}")

diff = st.mean(a) - st.mean(b)
se = math.sqrt(st.variance(a) / len(a) + st.variance(b) / len(b))
sf = lambda t: 0.5 * math.erfc(t / math.sqrt(2))
p1, p2 = sf((diff + MARGIN) / se), sf(-((diff - MARGIN) / se))
p = max(p1, p2)

print(f"\nmean difference {diff:+.2f} ms; 90% CI [{diff-1.645*se:.2f}, {diff+1.645*se:.2f}] ms")
# Underflow is expected for large effects; report a bound rather than a literal zero.
shown = "< 1e-15" if p == 0 else f"= {p:.3g}"
print(f"TOST vs +/-{MARGIN:.0f} ms: p {shown} -> "
      f"{'EQUIVALENT within margin' if p < 0.05 else 'equivalence NOT demonstrated'}")
