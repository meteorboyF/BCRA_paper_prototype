#!/usr/bin/env python3
"""Regenerate the Exp 1-9 manuscript figures from the committed raw data
(repo-root results/), in the unified house style with 95% confidence
intervals wherever per-sample/per-trial data supports them.

Canonical filters follow results/DELTAS.md:
  - Exp 1: fabric sweep = fixedcount_x10 @ BatchTimeout 2 s (published
    shape); PostgreSQL = duration60s, VALID region conc <= 100 only
    (conc >= 150 rows are self-flagged harness-invalid).
  - Exp 5: full 8-point RTT sweep (supersedes the old 0 ms-only baselines).
  - Exp 6: Node WebCrypto fallback runtime, flagged in the panel title.

Usage: regen_figs.py --out DIR [--boot 10000] [--seed 7]
Writes fig1..fig9 as PNG (180 dpi) + PDF.
"""
import argparse
import csv
import math
import pathlib
import random
import statistics as st
from collections import defaultdict

ROOT = pathlib.Path(__file__).resolve().parents[2]
R = ROOT / "results"
BUNDLE = ROOT / "experiments/fail_closed_outage/final_evidence_bundle"

AMBER, BLUE, GREEN, GOLD, INK, GRAY = ("#b45309", "#2563eb", "#16a34a",
                                       "#d4af37", "#111111", "#9ca3af")

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

ap = argparse.ArgumentParser()
ap.add_argument("--out", required=True)
ap.add_argument("--boot", type=int, default=10000)
ap.add_argument("--seed", type=int, default=7)
A = ap.parse_args()
OUT = pathlib.Path(A.out)
OUT.mkdir(parents=True, exist_ok=True)
rng = random.Random(A.seed)

T975 = {4: 2.776, 5: 2.571, 9: 2.262, 10: 2.228, 30: 2.042}


def t975(df):
    return T975.get(df, next((v for k, v in sorted(T975.items()) if k >= df), 1.96))


def rows(path):
    return list(csv.DictReader(open(path)))


def med_ci(vals):
    """median + bootstrap percentile 95% CI"""
    b = sorted(st.median(rng.choices(vals, k=len(vals))) for _ in range(A.boot))
    return st.median(vals), b[int(A.boot * .025)], b[int(A.boot * .975)]


def mean_ci(vals):
    m = st.mean(vals)
    if len(vals) < 2:
        return m, m, m
    h = t975(len(vals) - 1) * st.stdev(vals) / math.sqrt(len(vals))
    return m, m - h, m + h


def style(ax):
    ax.grid(True, alpha=0.25)
    ax.set_axisbelow(True)


def save(fig, name):
    fig.tight_layout()
    fig.savefig(OUT / f"{name}.pdf")
    fig.savefig(OUT / f"{name}.png", dpi=180)
    plt.close(fig)
    print(f"wrote {name}")


def errbar(ax, xs, stats, color, marker, label, ls="-"):
    mids = [s[0] for s in stats]
    ax.errorbar(xs, mids,
                yerr=[[m - lo for (m, lo, _) in stats],
                      [hi - m for (m, _, hi) in stats]],
                color=color, marker=marker, markersize=5, linewidth=2,
                capsize=3, linestyle=ls, label=label)


# ── fig1 — Exp 1 scalability ────────────────────────────────────────────────
e1 = rows(R / "exp1_throughput.csv")
fab = defaultdict(list)
pg = defaultdict(list)
for r in e1:
    if r["tool"] == "fixedcount_x10" and r["batch_timeout_ms"] == "2000" \
            and r["mode"] == "fabric":
        fab[int(r["concurrency"])].append(float(r["tps"]))
    if r["tool"] == "duration60s" and r["mode"] == "postgres" \
            and int(r["concurrency"]) <= 100:
        pg[int(r["concurrency"])].append(float(r["tps"]))
fig, ax = plt.subplots(figsize=(10, 4.8))
xs = sorted(fab)
errbar(ax, xs, [mean_ci(fab[c]) for c in xs], AMBER, "o",
       "Fabric mode (2 s BatchTimeout)")
pxs = sorted(pg)
errbar(ax, pxs, [mean_ci(pg[c]) for c in pxs], BLUE, "s",
       "PostgreSQL-only (valid region, conc ≤ 100)", ls="--")
# client-side saturation region: PG rows at conc >= 150 are self-flagged
# harness-invalid (closed-loop socket saturation), per DELTAS.md
ax.axvspan(150, 600, color=GOLD, alpha=0.12,
           label="PostgreSQL-mode client-side saturation (harness-invalid)")
# Exp 8 BatchTimeout tuning reference: 193.0 TPS at 500 ms
ax.axhline(193.0, color=GREEN, linewidth=1.5, linestyle=":",
           label="Exp 8 tuning reference: 193 TPS @500 ms BatchTimeout")
ax.set_xlabel("Concurrent clients")
ax.set_ylabel("Gateway throughput (TPS)")
ax.set_title("Exp 1 — Throughput vs concurrency, mean with 95% CI")
ax.legend(fontsize=8)
style(ax)
save(fig, "fig1_scalability")

# ── fig2 — Exp 2 function-level latency ─────────────────────────────────────
e2 = defaultdict(list)
for r in rows(R / "exp2_latency.csv"):
    if int(r["sample_idx"]) > 20:
        e2[(r["operation"], r["mode"])].append(float(r["latency_ms"]))
e4pre = defaultdict(list)
for r in rows(R / "exp4_audit.csv"):
    e4pre[r["method"]].append(float(r["ms"]))
fig, ax = plt.subplots(figsize=(10, 4.8))
bars = [("CheckAccess\nFabric evaluate\n(n=100)", e2[("checkaccess", "fabric")], AMBER),
        ("CheckAccess\nPostgreSQL ACL\n(n=100)", e2[("checkaccess", "db_only")], BLUE),
        ("RegisterDocument\nendorse+order+commit\n(n=100)", e2[("registerdoc", "fabric")], AMBER),
        ("Audit query\nPostgreSQL, 1000 ev.\n(n=10)", e4pre["pg_query_1000"], BLUE),
        ("Audit verify\nCSV+SHA-256 chain\n(n=10)", e4pre["csv_sha256_chain_1000"], GREEN)]
for i, (lbl, vals, color) in enumerate(bars):
    m, lo, hi = med_ci(vals)
    ax.bar(i, m, width=0.62, color=color)
    ax.errorbar([i], [m], yerr=[[m - lo], [hi - m]], color=INK, capsize=4,
                linewidth=1.5)
    ax.annotate(f"{m:.2f}" if m < 100 else f"{m:.0f}", (i, hi), ha="center",
                va="bottom", fontsize=9, color=INK)
ax.set_xticks(range(len(bars)))
ax.set_xticklabels([b[0] for b in bars], fontsize=8)
ax.set_yscale("log")
ax.set_ylabel("Latency P50 (ms, log scale)")
ax.set_title("Exp 2 — Function-level latency with audit baselines, "
             "P50 with bootstrap 95% CI")
style(ax)
save(fig, "fig2_latency")

# ── fig3 — Exp 3 file-size independence ─────────────────────────────────────
e3 = defaultdict(list)
for r in rows(R / "exp3_filesize.csv"):
    e3[(r["kind"], r["size_mb"])].append(float(r["value_ms"]))
sizes = sorted({int(s) for (k, s) in e3 if k == "ipfs_add"})
fig, ax = plt.subplots(figsize=(10, 4.8))
errbar(ax, sizes, [med_ci(e3[("ipfs_add", str(s))]) for s in sizes],
       BLUE, "s", "IPFS add, P50 (n=10/size)")
fc, fc_lo, fc_hi = med_ci(e3[("fabric_commit", "")])
ax.axhline(fc, color=AMBER, linewidth=2, label=f"Fabric commit constant ({fc:.0f} ms, n=5)")
ax.axhspan(fc_lo, fc_hi, color=AMBER, alpha=0.12)
e2e = [fc + st.median(e3[("ipfs_add", str(s))]) for s in sizes]
ax.plot(sizes, e2e, color=GREEN, marker="^", markersize=5, linewidth=1.6,
        linestyle="-.", label="End-to-end upload (derived: commit + IPFS P50)")
ax.set_yscale("log")
ax.set_xlabel("File size (MB)")
ax.set_ylabel("Latency (ms, log scale)")
ax.set_title("Exp 3 — Upload-path cost vs file size, P50 with bootstrap 95% CI")
ax.legend(fontsize=9)
style(ax)
save(fig, "fig3_filesize")

# ── fig4 — Exp 4 audit verification ─────────────────────────────────────────
e4 = defaultdict(list)
for r in rows(R / "exp4_audit.csv"):
    e4[r["method"]].append(float(r["ms"]))
fig, ax = plt.subplots(figsize=(10, 4.8))
e7pre = [float(r["latency_ms"]) for r in rows(R / "exp7_history.csv")]
bars = [("PostgreSQL indexed query\n(1000 events, n=10)", e4["pg_query_1000"], BLUE),
        ("CSV + SHA-256 hash chain\n(1000 events, n=10)", e4["csv_sha256_chain_1000"], AMBER),
        ("Fabric GetHistoryForKey\n(depth 107, n=10)", e7pre, GREEN)]
for i, (lbl, vals, color) in enumerate(bars):
    m, lo, hi = med_ci(vals)
    ax.bar(i, m, width=0.55, color=color)
    ax.errorbar([i], [m], yerr=[[m - lo], [hi - m]], color=INK, capsize=4,
                linewidth=1.5)
    ax.annotate(f"{m:.2f} ms", (i, hi), ha="center", va="bottom", fontsize=9,
                color=INK)
ax.set_xticks(range(len(bars)))
ax.set_xticklabels([b[0] for b in bars], fontsize=9)
ax.set_ylabel("Verification latency P50 (ms)")
ax.set_title("Exp 4 — Audit-trail verification cost (n=10), bootstrap 95% CI")
style(ax)
save(fig, "fig4_audit")

# ── fig5 — Exp 5 WAN sweep ──────────────────────────────────────────────────
e5 = defaultdict(list)
e5l = defaultdict(list)
for r in rows(R / "exp5_wan.csv"):
    e5[(r["config"], int(r["rtt_ms"]))].append(float(r["tps"]))
    e5l[(r["config"], int(r["rtt_ms"]))].append(float(r["p50_ms"]))
fig, (axt, axl2) = plt.subplots(1, 2, figsize=(10, 4.8))
for cfg, color, marker, lbl in (
        ("bridge", AMBER, "o", "bridge (delay on docker bridge)"),
        ("bridge_veth", BLUE, "s", "bridge_veth (+ per-orderer veth delay)")):
    rtts = sorted(r for (c, r) in e5 if c == cfg)
    errbar(axt, rtts, [mean_ci(e5[(cfg, r)]) for r in rtts], color, marker, lbl)
    errbar(axl2, rtts, [med_ci(e5l[(cfg, r)]) for r in rtts], color, marker, lbl)
axt.set_xlabel("Injected round-trip time (ms)")
axt.set_ylabel("Gateway throughput (TPS)")
axt.set_title("(a) Throughput, mean with t 95% CI", fontsize=10)
axl2.set_xlabel("Injected round-trip time (ms)")
axl2.set_ylabel("Request latency P50 (ms)")
axl2.set_title("(b) Latency, median with bootstrap 95% CI", fontsize=10)
for ax in (axt, axl2):
    ax.legend(fontsize=8)
    style(ax)
fig.suptitle("Exp 5 — WAN sensitivity (duration60s, conc 200, n=5/point)",
             fontsize=12)
save(fig, "fig5_wan")

# ── fig6 — Exp 6 crypto primitives ──────────────────────────────────────────
e6 = defaultdict(list)
for r in rows(R / "exp6_crypto.csv"):
    e6[r["operation"]].append(float(r["latency_ms"]))
ORDER = [
    ("pbkdf2_sha256_600k_aes256", "PBKDF2-SHA256 600k"),
    ("ecdh_p256_keygen", "ECDH P-256 keygen"),
    ("ecdsa_p256_keygen", "ECDSA P-256 keygen"),
    ("ecdsa_p256_sign_sha256_hash", "ECDSA sign"),
    ("ecdsa_p256_verify_signature", "ECDSA verify"),
    ("ecies_p256_wrap_32b_doc_key", "ECIES wrap key"),
    ("ecies_p256_unwrap_32b_doc_key", "ECIES unwrap key"),
    ("rsa_oaep_2048_wrap_32b_doc_key", "RSA-OAEP-2048 wrap"),
    ("aes_256_gcm_encrypt_1mb", "AES-GCM encrypt 1 MB"),
    ("aes_256_gcm_encrypt_50mb", "AES-GCM encrypt 50 MB"),
    ("aes_256_gcm_decrypt_50mb", "AES-GCM decrypt 50 MB"),
    ("sha256_hash_50mb", "SHA-256 hash 50 MB"),
]
fig, ax = plt.subplots(figsize=(10, 5.6))
ys = range(len(ORDER))
stats = [med_ci(e6[k]) for k, _ in ORDER]
ax.barh(list(ys), [s[0] for s in stats], color=AMBER, height=0.6)
ax.errorbar([s[0] for s in stats], list(ys),
            xerr=[[m - lo for (m, lo, _) in stats],
                  [hi - m for (m, _, hi) in stats]],
            color=INK, capsize=3, linewidth=1.2, linestyle="none")
for y, (m, _, hi) in zip(ys, stats):
    ax.annotate(f" {m:.2f}", (hi, y), va="center", fontsize=8, color=INK)
ax.set_yticks(list(ys))
ax.set_yticklabels([lbl for _, lbl in ORDER], fontsize=9)
ax.invert_yaxis()
ax.set_xscale("log")
ax.set_xlabel("Latency P50 (ms, log scale)")
ax.set_title("Exp 6 — Client-side crypto primitives (Node WebCrypto runtime, n=10), bootstrap 95% CI")
ax.annotate("Wrapped-key token size:\nECIES P-256 125 B vs. RSA-OAEP-2048 256 B\n(51.2% reduction)",
            xy=(0.97, 0.72), xycoords="axes fraction", ha="right",
            fontsize=8, color=INK,
            bbox={"boxstyle": "round,pad=0.4", "facecolor": "white",
                  "edgecolor": GRAY})
style(ax)
save(fig, "fig6_crypto")

# ── fig7 — Exp 7 history query ──────────────────────────────────────────────
e7 = [float(r["latency_ms"]) for r in rows(R / "exp7_history.csv")]
m, lo, hi = med_ci(e7)
fig, ax = plt.subplots(figsize=(10, 4.8))
ax.scatter([rng.uniform(-0.08, 0.08) for _ in e7], e7, s=45, zorder=3,
           facecolors="none", edgecolors=BLUE, linewidths=1.8,
           label="individual trials (n=10)")
ax.axhline(m, color=AMBER, linewidth=2, label=f"P50 = {m:.1f} ms")
ax.axhspan(lo, hi, color=AMBER, alpha=0.15, label="bootstrap 95% CI")
ax.set_xlim(-0.5, 0.5)
ax.set_xticks([])
ax.set_ylabel("GetHistoryForKey latency (ms)")
ax.set_title("Exp 7 — Full-history query at depth 107 (peer CLI)")
ax.legend(fontsize=9)
style(ax)
save(fig, "fig7_gethistory")

# ── fig8 — Exp 8 BatchTimeout sensitivity ───────────────────────────────────
e8t = defaultdict(list)
e8l = defaultdict(list)
for r in rows(R / "exp_batchtimeout_sens.csv"):
    e8t[int(r["batch_timeout_ms"])].append(float(r["tps"]))
    e8l[int(r["batch_timeout_ms"])].append(float(r["p50_ms"]))
bts = sorted(e8t, reverse=True)
fig, (axt, axl) = plt.subplots(1, 2, figsize=(10, 4.8))
for i, bt in enumerate(bts):
    m, lo, hi = mean_ci(e8t[bt])
    axt.bar(i, m, width=0.55, color=AMBER)
    axt.errorbar([i], [m], yerr=[[m - lo], [hi - m]], color=INK, capsize=4,
                 linewidth=1.5)
    axt.annotate(f"{m:.1f}", (i, hi), ha="center", va="bottom", fontsize=9,
                 color=INK)
    ml, lol, hil = med_ci(e8l[bt])
    axl.bar(i, ml, width=0.55, color=BLUE)
    axl.errorbar([i], [ml], yerr=[[ml - lol], [hil - ml]], color=INK,
                 capsize=4, linewidth=1.5)
    axl.annotate(f"{ml:.0f}", (i, hil), ha="center", va="bottom", fontsize=9,
                 color=INK)
for ax, ylab, t in ((axt, "Sustained throughput (TPS), mean",
                     "(a) Throughput, t-based 95% CI"),
                    (axl, "Request latency P50 (ms)",
                     "(b) Latency, bootstrap 95% CI")):
    ax.set_xticks(range(len(bts)))
    ax.set_xticklabels([f"{b} ms" for b in bts])
    ax.set_xlabel("BatchTimeout")
    ax.set_ylabel(ylab)
    ax.set_title(t, fontsize=10)
    style(ax)
fig.suptitle("Exp 8 — BatchTimeout sensitivity (duration60s, conc 50, n=10)", fontsize=12)
save(fig, "fig8_sensitivity")

# ── fig9 — Exp 9 fail-closed outage (time series, from evidence bundle) ────
p9 = rows(BUNDLE / "per_second.csv")
x = [int(r["second"]) for r in p9]
ok = [int(r["success_200"]) for r in p9]
denied = [int(r["http_503"]) for r in p9]
outage = [int(r["second"]) for r in p9 if r["phase"] == "outage"]
fig, ax = plt.subplots(figsize=(10, 4.8))
if outage:
    ax.axvspan(min(outage), max(outage) + 1, color=GOLD, alpha=0.16,
               label="Fabric outage")
ax.plot(x, ok, color=INK, linewidth=2, label="Successful downloads")
ax.plot(x, denied, color=AMBER, linewidth=2, label="HTTP 503 fail-closed denials")
ax.set_xlabel("Time (seconds)")
ax.set_ylabel("Requests per second")
ax.set_title("Exp 9 — Fail-closed Fabric outage: document downloads (conc 50)")
ax.legend(loc="upper right", fontsize=9)
style(ax)
save(fig, "fig9_failclosed_outage")

print(f"done: {OUT}")
