#!/usr/bin/env python3
"""Experiment 12b — analysis of ledger growth as a*docs + b*time.

Phase A (idle): ordinary least squares of block-store bytes on elapsed time with
zero document activity, giving the background rate b introduced by the TimeAnchor
heartbeat. Also reports bytes per block, since with no other traffic every new
block is one heartbeat.

Phase B (load): bytes per document on the current build, with Phase A's
background term subtracted over the load window — otherwise the heartbeat bytes
that accrue during the preload are silently attributed to the documents.

Usage: analyze12b.py <results_dir>
"""
import csv, json, os, sys

d = sys.argv[1]
rows = list(csv.DictReader(open(os.path.join(d, "ledger_size.csv"))))
for r in rows:
    r["epoch_s"] = float(r["epoch_s"])
    for k in ("block_height", "peer_production_bytes", "blockstore_bytes", "couchdb_bytes"):
        r[k] = float(r[k]) if r[k] else float("nan")

idle = [r for r in rows if r["phase"] == "idle"]
load = [r for r in rows if r["phase"].startswith("load")]

out = {}


def ols(xs, ys):
    n = len(xs)
    mx, my = sum(xs) / n, sum(ys) / n
    sxx = sum((x - mx) ** 2 for x in xs)
    sxy = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    slope = sxy / sxx
    icpt = my - slope * mx
    syy = sum((y - my) ** 2 for y in ys)
    r2 = (sxy ** 2 / (sxx * syy)) if syy > 0 else float("nan")
    return slope, icpt, r2


print(f"=== Experiment 12b — {os.path.basename(d)} ===\n")

if len(idle) >= 3:
    t0 = idle[0]["epoch_s"]
    ts = [r["epoch_s"] - t0 for r in idle]
    span_s = ts[-1]
    d_blocks = idle[-1]["block_height"] - idle[0]["block_height"]
    bs_slope, _, bs_r2 = ols(ts, [r["blockstore_bytes"] for r in idle])
    blk_slope, _, blk_r2 = ols(ts, [r["block_height"] for r in idle])
    cdb_slope, _, cdb_r2 = ols(ts, [r["couchdb_bytes"] for r in idle])
    per_block = (idle[-1]["blockstore_bytes"] - idle[0]["blockstore_bytes"]) / d_blocks if d_blocks else float("nan")

    # CouchDB is compacted: its size is a sawtooth, so a fitted slope is not a
    # growth rate and must not be quoted as one. The block store is append-only
    # and never reclaims, so its slope is the durable term.
    cdb_monotonic = all(b["couchdb_bytes"] >= a["couchdb_bytes"] - 1
                        for a, b in zip(idle, idle[1:]))
    cdb_usable = cdb_monotonic and cdb_r2 > 0.9

    print("--- Phase A: idle background growth (zero document activity) ---")
    print(f"span {span_s/60:.1f} min, {len(idle)} samples, blocks +{d_blocks:.0f} "
          f"({blk_slope*60:.2f} blocks/min, R^2={blk_r2:.4f})")
    print(f"block store  {bs_slope:>10.1f} B/s  = {bs_slope*86400/1e6:8.2f} MB/day   (R^2={bs_r2:.4f})")
    if cdb_usable:
        print(f"CouchDB      {cdb_slope:>10.1f} B/s  = {cdb_slope*86400/1e6:8.2f} MB/day   (R^2={cdb_r2:.4f})")
    else:
        print(f"CouchDB      NOT A RATE — series is non-monotonic (compaction), "
              f"fit R^2={cdb_r2:.3f}; no idle CouchDB rate is reported")
    print(f"per block    {per_block:>10.1f} B    (every idle block is one TimeAnchor heartbeat)")
    out["phase_a"] = {
        "span_minutes": round(span_s / 60, 2), "samples": len(idle),
        "blocks_added": d_blocks, "blocks_per_min": round(blk_slope * 60, 3), "blocks_r2": round(blk_r2, 5),
        "blockstore_bytes_per_s": round(bs_slope, 2), "blockstore_mb_per_day": round(bs_slope * 86400 / 1e6, 3),
        "blockstore_r2": round(bs_r2, 5),
        "couchdb_rate_reportable": cdb_usable,
        "couchdb_bytes_per_s": round(cdb_slope, 2) if cdb_usable else None,
        "couchdb_mb_per_day": round(cdb_slope * 86400 / 1e6, 3) if cdb_usable else None,
        "couchdb_r2": round(cdb_r2, 5),
        "couchdb_note": None if cdb_usable else
            "series non-monotonic (CouchDB compaction observed mid-run); no idle rate reported",
        "blockstore_bytes_per_block": round(per_block, 1),
    }
    if not cdb_usable:
        cdb_slope = 0.0   # subtract no CouchDB background in Phase B rather than a fitted artefact
else:
    print("--- Phase A: insufficient samples ---")
    bs_slope = cdb_slope = None

if len(load) >= 2 and bs_slope is not None:
    meta_path = os.path.join(d, "phase_b_preload.json")
    meta = json.load(open(meta_path)) if os.path.exists(meta_path) else {}
    n_docs = meta.get("committed")
    a, b = load[0], load[-1]
    dt = b["epoch_s"] - a["epoch_s"]
    d_bs = b["blockstore_bytes"] - a["blockstore_bytes"]
    d_cdb = b["couchdb_bytes"] - a["couchdb_bytes"]
    d_blocks = b["block_height"] - a["block_height"]
    bg_bs, bg_cdb = bs_slope * dt, cdb_slope * dt

    print(f"\n--- Phase B: per-document cost on the current build ---")
    print(f"window {dt/60:.1f} min, blocks +{d_blocks:.0f}, documents committed {n_docs}")
    print(f"block store delta {d_bs:>12.0f} B   background {bg_bs:>10.0f} B   "
          f"attributable {d_bs-bg_bs:>12.0f} B")
    print(f"CouchDB    delta {d_cdb:>12.0f} B   background {bg_cdb:>10.0f} B   "
          f"attributable {d_cdb-bg_cdb:>12.0f} B")
    if n_docs:
        bs_doc, cdb_doc = (d_bs - bg_bs) / n_docs, (d_cdb - bg_cdb) / n_docs
        print(f"\nper document: block store {bs_doc:.0f} B + CouchDB {cdb_doc:.0f} B "
              f"= {(bs_doc+cdb_doc)/1024:.2f} KB/doc/peer")
        print(f"published Experiment 12: ~5,618 B + ~1,389 B = ~7 KB/doc/peer")
        out["phase_b"] = {
            "window_minutes": round(dt / 60, 2), "blocks_added": d_blocks,
            "documents_committed": n_docs,
            "blockstore_delta_bytes": d_bs, "blockstore_background_bytes": round(bg_bs),
            "blockstore_bytes_per_doc": round(bs_doc, 1),
            "couchdb_delta_bytes": d_cdb, "couchdb_background_bytes": round(bg_cdb),
            "couchdb_bytes_per_doc": round(cdb_doc, 1),
            "total_kb_per_doc_per_peer": round((bs_doc + cdb_doc) / 1024, 3),
            "published_kb_per_doc_per_peer": 7.0,
        }
        if "phase_a" in out:
            # The comparison that makes the time term concrete.
            eq = out["phase_a"]["blockstore_mb_per_day"] * 1e6 / bs_doc if bs_doc > 0 else float("nan")
            out["phase_a"]["idle_day_in_documents_equivalent"] = round(eq, 1)
            print(f"\nOne idle day costs the block store as much as {eq:.0f} document registrations.")
else:
    print("\n--- Phase B: not run or insufficient samples ---")

json.dump(out, open(os.path.join(d, "analysis.json"), "w"), indent=2)
print(f"\nwrote {os.path.join(d, 'analysis.json')}")
