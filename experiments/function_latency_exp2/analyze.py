#!/usr/bin/env python3
"""Experiment 2 re-run — analysis of the bracketed CheckAccess comparison.

Reports, for the warmed window (samples 21..120) of each arm:
  * n, mean, P50, SD, min, max
  * bootstrap percentile 95% CI on the median (10,000 resamples, seed 7) — the
    same convention as experiments/consolidated/build_table.py, so the intervals
    are comparable to the ones already in the manuscript
  * a drift check between the two fabric brackets
  * Mann-Whitney U (normal approximation, tie-corrected) — the original test
  * TOST against the pre-specified RQ2 margin of 50 ms

On the TOST margin: 50 ms is the margin RQ2 fixed in advance, and it is the one
experiments/baseline_auditlog/tost.py uses for the end-to-end comparison. It is
very wide relative to a function-level difference of a few ms, so passing it is
weak evidence on its own; the 90% CI of the mean difference is reported next to
it so the reader can see the actual resolution. Narrowing the margin after seeing
the data would reproduce exactly the inference error the reviewer objected to, so
no post-hoc margin is reported.

Usage: analyze.py <results_dir>
"""
import csv, json, math, os, random, statistics as st, sys

N_WARM = 20
BOOT = 10_000
SEED = 7

d = sys.argv[1]
rows = list(csv.DictReader(open(os.path.join(d, "exp2_latency.csv"))))

# arms keyed by (operation, mode, method-bracket)
arms = {}
for r in rows:
    if r["http"] != "200":
        continue
    if int(r["sample_idx"]) <= N_WARM:      # warmed window only
        continue
    arms.setdefault((r["operation"], r["mode"], r["method"]), []).append(float(r["latency_ms"]))


def boot_ci(v, alpha=0.05):
    rnd = random.Random(SEED)
    n = len(v)
    meds = sorted(st.median(rnd.choices(v, k=n)) for _ in range(BOOT))
    return meds[int(alpha / 2 * BOOT)], meds[int((1 - alpha / 2) * BOOT)]


def pct(v, q):
    """Floor-index percentile — the convention the per-experiment run summaries
    and the manuscript prose use (see the Exp 15 note on percentile conventions)."""
    s = sorted(v)
    return s[min(int(len(s) * q), len(s) - 1)]


def describe(v):
    lo, hi = boot_ci(v)
    return dict(n=len(v), mean=round(st.mean(v), 3), p50=round(st.median(v), 3),
                ci95_p50=[round(lo, 3), round(hi, 3)],
                sd=round(st.stdev(v), 3), min=round(min(v), 3), max=round(max(v), 3),
                # P50 above is the central-pair median (matches the CI); the
                # percentiles below are floor-index, as in the original table.
                p25=round(pct(v, 0.25), 3), p75=round(pct(v, 0.75), 3),
                p95=round(pct(v, 0.95), 3), p99=round(pct(v, 0.99), 3))


def mannwhitney(a, b):
    """Two-sided Mann-Whitney U, normal approximation with tie correction."""
    comb = sorted([(x, 0) for x in a] + [(x, 1) for x in b])
    ranks = [0.0] * len(comb)
    i = 0
    tie_term = 0.0
    while i < len(comb):
        j = i
        while j + 1 < len(comb) and comb[j + 1][0] == comb[i][0]:
            j += 1
        avg = (i + j) / 2.0 + 1.0
        for k in range(i, j + 1):
            ranks[k] = avg
        t = j - i + 1
        if t > 1:
            tie_term += t ** 3 - t
        i = j + 1
    n1, n2 = len(a), len(b)
    r1 = sum(rk for rk, (_, g) in zip(ranks, comb) if g == 0)
    u1 = r1 - n1 * (n1 + 1) / 2.0
    u2 = n1 * n2 - u1
    u = min(u1, u2)
    n = n1 + n2
    mu = n1 * n2 / 2.0
    sigma = math.sqrt(n1 * n2 / 12.0 * ((n + 1) - tie_term / (n * (n - 1))))
    if sigma == 0:
        return u, 1.0
    z = (abs(u - mu) - 0.5) / sigma      # continuity correction
    p = math.erfc(z / math.sqrt(2))      # two-sided
    return u, p


def tost(a, b, margin):
    diff = st.mean(a) - st.mean(b)
    se = math.sqrt(st.variance(a) / len(a) + st.variance(b) / len(b))
    sf = lambda t: 0.5 * math.erfc(t / math.sqrt(2))
    p = max(sf((diff + margin) / se), sf(-((diff - margin) / se)))
    return diff, se, p


out = {"arms": {}, "checks": {}}
print(f"=== Experiment 2 re-run — {os.path.basename(d)} ===\n")
print(f"{'arm':34s} {'n':>4s} {'P50':>8s} {'95% CI':>18s} {'mean':>8s} {'SD':>7s}")
for k in sorted(arms):
    v = arms[k]
    s = describe(v)
    out["arms"]["/".join(k)] = s
    ci = f"[{s['ci95_p50'][0]:.2f}, {s['ci95_p50'][1]:.2f}]"
    print(f"{'/'.join(k):34s} {s['n']:>4d} {s['p50']:>8.2f} {ci:>18s} {s['mean']:>8.2f} {s['sd']:>7.2f}")

f1 = arms.get(("checkaccess", "fabric", "fabric1"))
f2 = arms.get(("checkaccess", "fabric", "fabric2"))
db = arms.get(("checkaccess", "db_only", "dbonly"))

if f1 and f2:
    u, p = mannwhitney(f1, f2)
    drift = st.median(f2) - st.median(f1)
    out["checks"]["drift_fabric2_minus_fabric1_ms"] = round(drift, 3)
    out["checks"]["drift_mannwhitney_p"] = p
    print(f"\n--- drift control (fabric bracket 2 - bracket 1) ---")
    print(f"median drift {drift:+.2f} ms; Mann-Whitney p = {p:.4g} "
          f"({'brackets agree' if p >= 0.05 else 'BRACKETS DISAGREE — host drifted during the run'})")

if f1 and f2 and db:
    pooled = f1 + f2                      # the arm measured on both sides of db_only
    s = describe(pooled)
    out["arms"]["checkaccess/fabric/pooled"] = s
    u, p = mannwhitney(pooled, db)
    diff, se, ptost = tost(pooled, db, 50.0)
    out["checks"]["fabric_vs_db"] = {
        "fabric_p50": s["p50"], "fabric_ci95": s["ci95_p50"],
        "db_p50": describe(db)["p50"], "db_ci95": describe(db)["ci95_p50"],
        "mannwhitney_p": p, "mean_diff_ms": round(diff, 3),
        "ci90_diff_ms": [round(diff - 1.645 * se, 3), round(diff + 1.645 * se, 3)],
        "tost_margin_ms": 50.0, "tost_p": ptost,
    }
    print(f"\n--- fabric (both brackets pooled, n={len(pooled)}) vs db_only (n={len(db)}) ---")
    print(f"fabric  P50 {s['p50']:.2f} ms [{s['ci95_p50'][0]:.2f}, {s['ci95_p50'][1]:.2f}]")
    dbs = describe(db)
    print(f"db_only P50 {dbs['p50']:.2f} ms [{dbs['ci95_p50'][0]:.2f}, {dbs['ci95_p50'][1]:.2f}]")
    print(f"Mann-Whitney p = {p:.4g} "
          f"({'no significant difference' if p >= 0.05 else 'significant difference'})")
    print(f"mean difference {diff:+.2f} ms; 90% CI [{diff-1.645*se:.2f}, {diff+1.645*se:.2f}] ms")
    shown = "< 1e-15" if ptost == 0 else f"= {ptost:.3g}"
    print(f"TOST vs +/-50 ms (pre-specified RQ2 margin): p {shown} -> "
          f"{'EQUIVALENT within margin' if ptost < 0.05 else 'equivalence NOT demonstrated'}")

json.dump(out, open(os.path.join(d, "analysis.json"), "w"), indent=2)
print(f"\nwrote {os.path.join(d, 'analysis.json')}")
