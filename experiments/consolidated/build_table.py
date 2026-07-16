#!/usr/bin/env python3
"""Experiment 15 — consolidated evidence table across Exp 1-14
(IMPROVEMENTS.md item 3.6).

Reads every experiment's raw per-sample/per-trial data, applies the
canonical filters documented in results/DELTAS.md, computes 95% CIs
(bootstrap percentile CI for medians/P50s; Student-t CI for means of
trial-level TPS), and emits:
  consolidated_evidence.csv   one row per headline metric
  consolidated_table.md       reviewer-facing markdown with footnotes

Usage: build_table.py --out DIR [--boot 10000] [--seed 7]
"""
import argparse
import csv
import json
import math
import pathlib
import random
import statistics as st
from collections import defaultdict

ROOT = pathlib.Path(__file__).resolve().parents[2]
R = ROOT / "results"
E = ROOT / "experiments"

# evidence run directories (stable, committed)
RUN10 = E / "ipfs_cost/results/20260715_173114"
RUN11 = E / "caliper/results/20260715_180121"
RUN12 = E / "ledger_growth/results/20260715_183009"
RUN13 = E / "network_scaling/results/20260715_225854"
RUN14 = E / "baseline_auditlog/results/20260716_122821"
RUN9 = E / "fail_closed_outage/final_evidence_bundle"

# Student-t 97.5% quantiles for small df
T975 = {1: 12.706, 2: 4.303, 3: 3.182, 4: 2.776, 5: 2.571, 6: 2.447,
        7: 2.365, 8: 2.306, 9: 2.262, 10: 2.228, 15: 2.131, 20: 2.086,
        29: 2.045, 30: 2.042}


def t975(df):
    if df in T975:
        return T975[df]
    return next((v for k, v in sorted(T975.items()) if k >= df), 1.96)


def rows_csv(path):
    return list(csv.DictReader(open(path)))


def boot_ci_median(vals, n_boot, rng):
    """Bootstrap percentile 95% CI for the median."""
    meds = sorted(st.median(rng.choices(vals, k=len(vals))) for _ in range(n_boot))
    return meds[int(n_boot * 0.025)], meds[int(n_boot * 0.975)]


def t_ci_mean(vals):
    m = st.mean(vals)
    if len(vals) < 2:
        return float("nan"), float("nan")
    half = t975(len(vals) - 1) * st.stdev(vals) / math.sqrt(len(vals))
    return m - half, m + half


class Table:
    def __init__(self, n_boot, seed):
        self.rows = []
        self.n_boot = n_boot
        self.rng = random.Random(seed)

    def add(self, exp, metric, vals=None, stat="median", unit="ms",
            value=None, ci=("", ""), n=None, source="", notes=""):
        if vals is not None:
            vals = [float(v) for v in vals]
            n = len(vals)
            if stat == "median":
                value = st.median(vals)
                ci = boot_ci_median(vals, self.n_boot, self.rng)
            elif stat == "mean":
                value = st.mean(vals)
                ci = t_ci_mean(vals)
        self.rows.append({
            "experiment": exp, "metric": metric, "n": n, "statistic": stat,
            "value": round(value, 2) if isinstance(value, float) else value,
            "ci95_low": round(ci[0], 2) if isinstance(ci[0], float) else ci[0],
            "ci95_high": round(ci[1], 2) if isinstance(ci[1], float) else ci[1],
            "unit": unit, "source": source, "notes": notes,
        })


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True)
    ap.add_argument("--boot", type=int, default=10000)
    ap.add_argument("--seed", type=int, default=7)
    a = ap.parse_args()
    out = pathlib.Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    t = Table(a.boot, a.seed)

    # ── Exp 1 — throughput (canonical regimes per DELTAS.md) ────────────────
    e1 = rows_csv(R / "exp1_throughput.csv")
    fab50 = [float(r["tps"]) for r in e1 if r["tool"] == "duration60s"
             and r["batch_timeout_ms"] == "2000" and r["mode"] == "fabric"
             and r["concurrency"] == "50"]
    t.add("Exp 1", "Fabric gateway TPS @conc 50 (duration60s, 2s batch)",
          fab50, "mean", "TPS", source="results/exp1_throughput.csv", notes="[a]")
    pg = defaultdict(list)
    for r in e1:
        if r["tool"] == "duration60s" and r["mode"] == "postgres" \
                and int(r["concurrency"]) < 150:                     # [b]
            pg[int(r["concurrency"])].append(float(r["tps"]))
    pg_peak_conc = max(pg, key=lambda c: st.mean(pg[c]))
    t.add("Exp 1", f"PostgreSQL-only gateway TPS @conc {pg_peak_conc} (peak)",
          pg[pg_peak_conc], "mean", "TPS",
          source="results/exp1_throughput.csv", notes="[a][b]")
    pg50 = st.mean(pg[50])
    t.add("Exp 1", "PG:Fabric matched-tool throughput ratio @conc 50",
          value=round(pg50 / st.mean(fab50), 2), stat="ratio", unit="x",
          n=len(pg[50]) + len(fab50), source="results/exp1_throughput.csv",
          notes="[a]")

    # ── Exp 2 — function-level latency (warmed: sample_idx > 20) ────────────
    e2 = defaultdict(list)
    for r in rows_csv(R / "exp2_latency.csv"):
        if int(r["sample_idx"]) > 20:
            e2[(r["operation"], r["mode"])].append(float(r["latency_ms"]))
    t.add("Exp 2", "CheckAccess P50, Fabric evaluate (warmed)",
          e2[("checkaccess", "fabric")], source="results/exp2_latency.csv")
    t.add("Exp 2", "CheckAccess P50, PostgreSQL ACL (warmed)",
          e2[("checkaccess", "db_only")], source="results/exp2_latency.csv")
    t.add("Exp 2", "RegisterDocument P50 (endorse+order+commit)",
          e2[("registerdoc", "fabric")], source="results/exp2_latency.csv")

    # ── Exp 3 — file-size independence ──────────────────────────────────────
    e3 = defaultdict(list)
    for r in rows_csv(R / "exp3_filesize.csv"):
        e3[(r["kind"], r["size_mb"])].append(float(r["value_ms"]))
    t.add("Exp 3", "Fabric commit constant (size-independent)",
          e3[("fabric_commit", "")], source="results/exp3_filesize.csv")
    t.add("Exp 3", "IPFS add P50, 1 MB", e3[("ipfs_add", "1")],
          source="results/exp3_filesize.csv")
    t.add("Exp 3", "IPFS add P50, 50 MB", e3[("ipfs_add", "50")],
          source="results/exp3_filesize.csv")

    # ── Exp 4 — audit verification ──────────────────────────────────────────
    e4 = defaultdict(list)
    for r in rows_csv(R / "exp4_audit.csv"):
        e4[r["method"]].append(float(r["ms"]))
    t.add("Exp 4", "Audit query P50, PostgreSQL (1000 events)",
          e4["pg_query_1000"], source="results/exp4_audit.csv")
    t.add("Exp 4", "Audit verify P50, CSV+SHA256 chain (1000 events)",
          e4["csv_sha256_chain_1000"], source="results/exp4_audit.csv")

    # ── Exp 5 — WAN sweep ────────────────────────────────────────────────────
    e5 = defaultdict(list)
    for r in rows_csv(R / "exp5_wan.csv"):
        e5[(r["config"], int(r["rtt_ms"]))].append(float(r["tps"]))
    for cfg, rtt in (("bridge", 0), ("bridge", 150), ("bridge_veth", 150)):
        t.add("Exp 5", f"Gateway TPS, {cfg} @ {rtt} ms RTT",
              e5[(cfg, rtt)], "mean", "TPS", source="results/exp5_wan.csv")

    # ── Exp 6 — crypto primitives (Node WebCrypto fallback) ────────────────
    e6 = defaultdict(list)
    for r in rows_csv(R / "exp6_crypto.csv"):
        e6[r["operation"]].append(float(r["latency_ms"]))
    t.add("Exp 6", "PBKDF2-SHA256 600k iterations P50",
          e6["pbkdf2_sha256_600k_aes256"],
          source="results/exp6_crypto.csv", notes="[c]")
    for op, label in (("aes_256_gcm_encrypt_50mb", "AES-256-GCM encrypt 50 MB P50"),):
        if e6.get(op):
            t.add("Exp 6", label, e6[op], source="results/exp6_crypto.csv",
                  notes="[c]")

    # ── Exp 7 — history depth ────────────────────────────────────────────────
    e7 = [float(r["latency_ms"]) for r in rows_csv(R / "exp7_history.csv")]
    t.add("Exp 7", "GetHistoryForKey P50 @ depth 107", e7,
          source="results/exp7_history.csv")

    # ── Exp 8 — BatchTimeout sensitivity ────────────────────────────────────
    e8 = defaultdict(list)
    for r in rows_csv(R / "exp_batchtimeout_sens.csv"):
        e8[r["batch_timeout_ms"]].append(float(r["tps"]))
    for bt in ("2000", "500", "250"):
        t.add("Exp 8", f"Sustained TPS @ BatchTimeout {bt} ms",
              e8[bt], "mean", "TPS", source="results/exp_batchtimeout_sens.csv")

    # ── Exp 9 — fail-closed outage (categorical outcome, no CI) ────────────
    s9 = json.load(open(RUN9 / "summary.json"))
    t.add("Exp 9", "Protected bytes released during Fabric outage",
          value=s9["outage_protected_bytes_returned"], stat="count", unit="bytes",
          n=s9["total_requests"], source="fail_closed_outage/final_evidence_bundle",
          notes="[d]")
    t.add("Exp 9", "Fail-closed 503 denials during 45 s outage",
          value=s9["outage_http_503"], stat="count", unit="requests",
          n=s9["total_requests"], source="fail_closed_outage/final_evidence_bundle",
          notes="[d]")

    # ── Exp 10 — IPFS cost ───────────────────────────────────────────────────
    e10 = defaultdict(list)
    for r in rows_csv(RUN10 / "retrieval.csv"):
        if int(r["ok"]):
            e10[(r["source"], int(r["concurrency"]), int(r["size_mb"]))].append(
                float(r["latency_ms"]))
    t.add("Exp 10", "IPFS retrieval P50, 50 MB remote, conc 1",
          e10[("remote", 1, 50)], source=str(RUN10.relative_to(E)))
    t.add("Exp 10", "IPFS retrieval P50, 50 MB remote, conc 24",
          e10[("remote", 24, 50)], source=str(RUN10.relative_to(E)))
    st10 = rows_csv(RUN10 / "storage.csv")
    t.add("Exp 10", "IPFS DAG storage overhead (all sizes)",
          value=st10[0]["overhead_pct"], stat="constant", unit="%",
          n=len(st10), source=str(RUN10.relative_to(E)))
    nd = defaultdict(lambda: [0, 0])
    for r in rows_csv(RUN10 / "node_down.csv"):
        nd[r["scenario"]][0] += int(r["ok"]); nd[r["scenario"]][1] += 1
    t.add("Exp 10", "Served with 1 of 2 IPFS replicas down",
          value=f"{nd['one_replica_down'][0]}/{nd['one_replica_down'][1]}",
          stat="count", unit="requests", n=nd['one_replica_down'][1],
          source=str(RUN10.relative_to(E)))

    # ── Exp 11 — Caliper (single run per round; avg latency convention) ────
    e11 = {r["label"]: r for r in rows_csv(RUN11 / "caliper_rounds.csv")}
    t.add("Exp 11", "Caliper CheckAccess throughput @ load 600",
          value=float(e11["checkaccess-600"]["throughput_tps"]), stat="single-run",
          unit="TPS", n=int(e11["checkaccess-600"]["succ"]),
          source=str(RUN11.relative_to(E)), notes="[e]")
    t.add("Exp 11", "Caliper RegisterDocument throughput @ load 600",
          value=float(e11["register-600"]["throughput_tps"]), stat="single-run",
          unit="TPS", n=int(e11["register-600"]["succ"]),
          source=str(RUN11.relative_to(E)), notes="[e]")

    # ── Exp 12 — ledger growth ───────────────────────────────────────────────
    e12 = defaultdict(list)
    for r in rows_csv(RUN12 / "latency_samples.csv"):
        e12[(r["function"], int(r["checkpoint"]))].append(float(r["latency_ms"]))
    t.add("Exp 12", "CheckAccess P50 @ 10^3 docs", e12[("CheckAccess", 1000)],
          source=str(RUN12.relative_to(E)))
    t.add("Exp 12", "CheckAccess P50 @ 10^6 docs", e12[("CheckAccess", 1000000)],
          source=str(RUN12.relative_to(E)))
    d12 = rows_csv(RUN12 / "disk.csv")
    span = int(d12[-1]["checkpoint"]) - int(d12[1]["checkpoint"])
    per_doc = (int(d12[-1]["peer_production_bytes"]) + int(d12[-1]["couchdb_bytes"])
               - int(d12[1]["peer_production_bytes"]) - int(d12[1]["couchdb_bytes"])) / span
    t.add("Exp 12", "Disk growth per document per peer",
          value=round(per_doc), stat="slope", unit="bytes/doc",
          n=int(d12[-1]["checkpoint"]), source=str(RUN12.relative_to(E)))

    # ── Exp 13 — network-size scaling (latency CIs from samples) ───────────
    # o7p1-majority per-sample data must come from the VERIFIED rerun
    # (results/o7verify); the main run's samples.csv holds the documented
    # host-artifact outlier for that one label.
    e13 = defaultdict(list)
    for r in rows_csv(RUN13 / "samples.csv"):
        if r["label"] != "o7p1-majority":
            e13[(r["label"], r["function"])].append(float(r["latency_ms"]))
    for r in rows_csv(RUN13.parent / "o7verify/samples.csv"):
        e13[(r["label"], r["function"])].append(float(r["latency_ms"]))
    m13 = {r["label"]: r for r in rows_csv(RUN13 / "matrix_final.csv")}
    for lbl, desc in (("o2p1-majority", "2 orgs, majority"),
                      ("o7p1-majority", "7 orgs, majority")):
        t.add("Exp 13", f"Write TPS, {desc}",
              value=float(m13[lbl]["write_tps"]), stat="single-run", unit="TPS",
              n=int(m13[lbl]["write_ok"]), source=str(RUN13.relative_to(E)),
              notes="[f]")
    t.add("Exp 13", "CheckAccess P50, 7 orgs majority (verified rerun)",
          e13[("o7p1-majority", "CheckAccess")],
          source="network_scaling/results/o7verify", notes="[f]")

    # ── Exp 14 — passive-audit-log baseline ────────────────────────────────
    e14 = defaultdict(list)
    for r in rows_csv(RUN14 / "samples.csv"):
        if r["status"] == "200":
            e14[(r["mode"], int(r["conc"]))].append(float(r["latency_ms"]))
    t.add("Exp 14", "Release latency P50, on-path enforcement, conc 10",
          e14[("onpath", 10)], source=str(RUN14.relative_to(E)), notes="[g]")
    t.add("Exp 14", "Release latency P50, audit-log-only baseline, conc 10",
          e14[("auditlog", 10)], source=str(RUN14.relative_to(E)), notes="[g]")
    onp = st.median(e14[("onpath", 10)])
    aud = st.median(e14[("auditlog", 10)])
    t.add("Exp 14", "End-to-end on-path enforcement premium, conc 10",
          value=round(onp - aud, 2), stat="difference", unit="ms",
          n=len(e14[("onpath", 10)]) + len(e14[("auditlog", 10)]),
          source=str(RUN14.relative_to(E)), notes="[g]")

    # ── write outputs ────────────────────────────────────────────────────────
    with open(out / "consolidated_evidence.csv", "w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=list(t.rows[0].keys()))
        w.writeheader()
        w.writerows(t.rows)

    FOOT = {
        "[a]": "Exp 1 raw CSV mixes measurement regimes; canonical filter per "
               "results/DELTAS.md: tool=duration60s, BatchTimeout=2 s. The "
               "published 50-600 sweep shape uses the fixedcount tool.",
        "[b]": "PostgreSQL-mode rows at conc >= 150 are self-flagged "
               "harness-invalid (closed-loop client socket saturation) and "
               "excluded, per DELTAS.md.",
        "[c]": "Exp 6 ran on the Node.js WebCrypto fallback (recorded in the "
               "raw CSV), not an in-browser runtime.",
        "[d]": "Categorical outcome (zero-leak / denial counts); confidence "
               "intervals not applicable.",
        "[e]": "Caliper reports a single run per round with avg/min/max "
               "latency (community convention); no replicate CI available.",
        "[f]": "One matrix run per topology point (TPS is single-run; latency "
               "CIs from per-sample data). o7p1-majority is the verified "
               "rerun; the first measurement was a documented host artifact.",
        "[g]": "Measured after the async-executor defect fix (AsyncConfig); "
               "not comparable to Exp 1 absolute numbers (different endpoint "
               "and backend build).",
    }
    with open(out / "consolidated_table.md", "w") as fh:
        fh.write("# Consolidated evidence table (Exp 1-14)\n\n"
                 "| Exp | Metric | n | Statistic | Value | 95% CI | Unit | Notes |\n"
                 "|---|---|---|---|---|---|---|---|\n")
        for r in t.rows:
            ci = (f"[{r['ci95_low']}, {r['ci95_high']}]"
                  if r["ci95_low"] != "" else "—")
            fh.write(f"| {r['experiment']} | {r['metric']} | {r['n']} | "
                     f"{r['statistic']} | {r['value']} | {ci} | {r['unit']} | "
                     f"{r['notes']} |\n")
        fh.write("\n## Footnotes\n\n")
        for k, v in FOOT.items():
            fh.write(f"- **{k}** {v}\n")
        fh.write("\nSources: `results/` (Exp 1-8 raw bundle, see DELTAS.md) and "
                 "`experiments/<exp>/results/<run>/` evidence runs (Exp 9-14).\n")
    print(f"wrote {out / 'consolidated_evidence.csv'} ({len(t.rows)} metrics)")
    print(f"wrote {out / 'consolidated_table.md'}")


if __name__ == "__main__":
    main()
