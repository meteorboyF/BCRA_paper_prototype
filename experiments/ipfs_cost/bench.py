#!/usr/bin/env python3
"""Experiment 10 — IPFS storage/retrieval cost analysis (IMPROVEMENTS.md item 3.4).

Phases (each writes one CSV into --out):
  retrieval    retrieval latency vs file size under concurrent load, from a node
               that holds the blocks (local) and a node that must fetch them
               over the swarm (remote).                     -> retrieval.csv
  replication  cost of pinning a CID onto a 2nd and 3rd node: pin time and
               repo growth per replica.                     -> replication.csv
  storage      DAG overhead (CumulativeSize vs raw bytes) and total storage
               footprint at 2x and 3x replication.          -> storage.csv
  nodedown     retrieval behaviour with one replica down and with all
               replicas down (complements Exp 9, which kills Fabric only).
                                                            -> node_down.csv

Stdlib only. `add` uploads use curl (multipart); everything timed uses urllib.
Node roles: node1 (5001) = pin origin, node2 (5002) = 2nd replica,
node3 (5003) = retriever / 3rd replica.
"""

import argparse
import concurrent.futures
import csv
import json
import os
import pathlib
import platform
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request

MB = 1024 * 1024


# ---------------------------------------------------------------- IPFS helpers

def api(base, path, timeout=120):
    """POST to a Kubo RPC endpoint, return decoded JSON (or raw bytes)."""
    req = urllib.request.Request(f"{base}/api/v0/{path}", method="POST")
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        body = resp.read()
    try:
        return json.loads(body)
    except (json.JSONDecodeError, UnicodeDecodeError):
        return body


def cat_timed(base, cid, timeout):
    """Stream /cat for a CID, discard the body. Returns (ok, ms, bytes, err)."""
    url = f"{base}/api/v0/cat?arg={cid}"
    req = urllib.request.Request(url, method="POST")
    start = time.perf_counter()
    total = 0
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            while True:
                chunk = resp.read(1 << 20)
                if not chunk:
                    break
                total += len(chunk)
        return True, (time.perf_counter() - start) * 1000.0, total, ""
    except Exception as e:  # timeout, connection refused, HTTP error
        return False, (time.perf_counter() - start) * 1000.0, total, type(e).__name__


def add_file(base, path, pin):
    """Add a file via curl multipart. Returns CID."""
    out = subprocess.run(
        ["curl", "-sf", "-X", "POST",
         f"{base}/api/v0/add?pin={'true' if pin else 'false'}&quieter=true",
         "-F", f"file=@{path}"],
        capture_output=True, text=True, check=True)
    return json.loads(out.stdout)["Hash"]


def pin_add_timed(base, cid, timeout=600):
    start = time.perf_counter()
    api(base, f"pin/add?arg={cid}", timeout=timeout)
    return (time.perf_counter() - start) * 1000.0

def pin_rm(base, cid):
    try:
        api(base, f"pin/rm?arg={cid}")
    except urllib.error.HTTPError:
        pass  # not pinned here

def repo_gc(base):
    api(base, "repo/gc?silent=true", timeout=600)

def repo_size(base):
    return int(api(base, "repo/stat?size-only=true")["RepoSize"])

def dag_size(base, cid):
    return int(api(base, f"files/stat?arg=/ipfs/{cid}")["CumulativeSize"])


def docker(*args):
    subprocess.run(["docker", *args], check=True, capture_output=True)


def make_files(tmpdir, size_mb, count):
    paths = []
    for i in range(count):
        p = tmpdir / f"f{size_mb}mb_{i}.bin"
        with open(p, "wb") as fh:
            remaining = size_mb * MB
            while remaining > 0:
                n = min(remaining, 8 * MB)
                fh.write(os.urandom(n))
                remaining -= n
        paths.append(p)
    return paths


def percentile(sorted_vals, q):
    if not sorted_vals:
        return float("nan")
    k = min(int(len(sorted_vals) * q), len(sorted_vals) - 1)
    return sorted_vals[k]


# ---------------------------------------------------------------------- phases

def run_retrieval(args, out_dir, tmpdir, summary):
    """Latency of /cat per (size, concurrency, source). Each request targets a
    distinct CID so concurrent remote fetches are independent cold transfers."""
    rows = []
    for size_mb in args.sizes:
        files = make_files(tmpdir, size_mb, args.reps)
        cids = [add_file(args.api1, p, pin=True) for p in files]
        for p in files:
            p.unlink()
        for source, base in (("local", args.api1), ("remote", args.api3)):
            for conc in args.concurrency:
                if source == "remote":
                    repo_gc(args.api3)  # node3 pins nothing: gc -> cold cache
                with concurrent.futures.ThreadPoolExecutor(max_workers=conc) as ex:
                    results = list(ex.map(
                        lambda c: cat_timed(base, c, args.timeout), cids))
                for i, (ok, ms, nbytes, err) in enumerate(results):
                    rows.append({"size_mb": size_mb, "concurrency": conc,
                                 "source": source, "sample": i, "ok": int(ok),
                                 "latency_ms": f"{ms:.1f}", "bytes": nbytes,
                                 "error": err})
                lat = sorted(r[1] for r in results if r[0])
                print(f"  retrieval {size_mb}MB conc={conc} {source}: "
                      f"n={len(lat)}/{args.reps} P50={percentile(lat, .50):.0f}ms "
                      f"P95={percentile(lat, .95):.0f}ms", flush=True)
        for cid in cids:
            pin_rm(args.api1, cid)
        for base in (args.api1, args.api3):
            repo_gc(base)
    write_csv(out_dir / "retrieval.csv", rows)
    ok_lat = sorted(float(r["latency_ms"]) for r in rows if r["ok"])
    summary["retrieval"] = {"requests": len(rows),
                            "failed": sum(1 for r in rows if not r["ok"]),
                            "p50_ms_all": round(percentile(ok_lat, .5), 1)}


def run_replication(args, out_dir, tmpdir, summary):
    """Pin time + repo growth for the 2nd (node2) and 3rd (node3) replica."""
    rows = []
    for size_mb in args.sizes:
        files = make_files(tmpdir, size_mb, args.repl_reps)
        cids = [add_file(args.api1, p, pin=True) for p in files]
        for p in files:
            p.unlink()
        for cid in cids:
            for replicas, base, name in ((2, args.api2, "node2"),
                                         (3, args.api3, "node3")):
                repo_gc(base)
                before = repo_size(base)
                ms = pin_add_timed(base, cid)
                delta = repo_size(base) - before
                rows.append({"size_mb": size_mb, "cid": cid, "node": name,
                             "replica_index": replicas,
                             "pin_ms": f"{ms:.1f}", "repo_delta_bytes": delta})
            for base in (args.api2, args.api3):
                pin_rm(base, cid)
        lat2 = sorted(float(r["pin_ms"]) for r in rows
                      if r["size_mb"] == size_mb and r["replica_index"] == 2)
        lat3 = sorted(float(r["pin_ms"]) for r in rows
                      if r["size_mb"] == size_mb and r["replica_index"] == 3)
        print(f"  replication {size_mb}MB: 2nd replica P50={percentile(lat2, .5):.0f}ms "
              f"3rd replica P50={percentile(lat3, .5):.0f}ms", flush=True)
        for cid in cids:
            pin_rm(args.api1, cid)
        for base in (args.api1, args.api2, args.api3):
            repo_gc(base)
    write_csv(out_dir / "replication.csv", rows)
    summary["replication"] = {"pins": len(rows)}


def run_storage(args, out_dir, tmpdir, summary):
    """DAG overhead vs raw size; storage footprint at 2x / 3x replication.
    Random payloads are incompressible, matching AES-256-GCM ciphertext
    (which adds a constant 12 B IV + 16 B tag over the plaintext)."""
    rows = []
    for size_mb in args.sizes:
        p = make_files(tmpdir, size_mb, 1)[0]
        raw = p.stat().st_size
        cid = add_file(args.api1, p, pin=True)
        p.unlink()
        dag = dag_size(args.api1, cid)
        rows.append({"size_mb": size_mb, "raw_bytes": raw, "dag_bytes": dag,
                     "cid_bytes": len(cid),
                     "overhead_pct": f"{(dag - raw) / raw * 100:.3f}",
                     "footprint_2rep_bytes": 2 * dag,
                     "footprint_3rep_bytes": 3 * dag})
        print(f"  storage {size_mb}MB: raw={raw} dag={dag} "
              f"overhead={(dag - raw) / raw * 100:.2f}%", flush=True)
        pin_rm(args.api1, cid)
    repo_gc(args.api1)
    write_csv(out_dir / "storage.csv", rows)
    summary["storage"] = {"sizes": args.sizes}


def run_nodedown(args, out_dir, tmpdir, summary):
    """Retrieval from node3 with the document pinned on node1+node2 (2 replicas):
    all replicas up, one replica stopped, all replicas stopped, and recovery."""
    rows = []
    files = make_files(tmpdir, args.nodedown_size, args.nodedown_reps * 4)
    cids = [add_file(args.api1, p, pin=True) for p in files]
    for p in files:
        p.unlink()
    for cid in cids:
        pin_add_timed(args.api2, cid)
    batches = [cids[i * args.nodedown_reps:(i + 1) * args.nodedown_reps]
               for i in range(4)]

    def measure(scenario, batch, timeout):
        repo_gc(args.api3)
        for i, cid in enumerate(batch):
            ok, ms, nbytes, err = cat_timed(args.api3, cid, timeout)
            rows.append({"scenario": scenario, "sample": i, "cid": cid,
                         "ok": int(ok), "latency_ms": f"{ms:.1f}",
                         "bytes": nbytes, "error": err})
        lat = sorted(float(r["latency_ms"]) for r in rows
                     if r["scenario"] == scenario and r["ok"])
        n_ok = len(lat)
        print(f"  nodedown [{scenario}]: ok={n_ok}/{len(batch)} "
              f"P50={percentile(lat, .5):.0f}ms" if n_ok else
              f"  nodedown [{scenario}]: ok=0/{len(batch)} (all failed)",
              flush=True)

    try:
        measure("all_up", batches[0], args.timeout)
        print("  stopping replica node2 ...", flush=True)
        docker("stop", args.node2_container)
        measure("one_replica_down", batches[1], args.timeout)
        print("  stopping origin node1 (no replicas left) ...", flush=True)
        docker("stop", args.node1_container)
        measure("all_replicas_down", batches[2], args.dead_timeout)
    finally:
        print("  restarting nodes ...", flush=True)
        docker("start", args.node1_container, args.node2_container)
        time.sleep(10)
        reconnect(args)
    measure("recovery", batches[3], args.timeout)

    for cid in cids:
        pin_rm(args.api1, cid)
        pin_rm(args.api2, cid)
    for base in (args.api1, args.api2, args.api3):
        repo_gc(base)
    write_csv(out_dir / "node_down.csv", rows)
    down = [r for r in rows if r["scenario"] == "all_replicas_down"]
    summary["nodedown"] = {
        "one_replica_down_ok": sum(int(r["ok"]) for r in rows
                                   if r["scenario"] == "one_replica_down"),
        "all_replicas_down_served": sum(int(r["ok"]) for r in down),
        "recovery_ok": sum(int(r["ok"]) for r in rows
                           if r["scenario"] == "recovery"),
    }


def reconnect(args):
    """Re-establish direct swarm connections after container restarts."""
    for target in (args.node1_container, args.node2_container):
        cid_ = subprocess.run(["docker", "exec", target, "ipfs", "id", "-f", "<id>"],
                              capture_output=True, text=True, check=True).stdout.strip()
        ip = subprocess.run(["docker", "inspect", "-f",
                             "{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}",
                             target], capture_output=True, text=True,
                            check=True).stdout.strip()
        try:
            api(args.api3, f"swarm/connect?arg=/ip4/{ip}/tcp/4001/p2p/{cid_}",
                timeout=30)
        except Exception as e:
            print(f"  warn: reconnect to {target} failed: {e}", flush=True)


# ------------------------------------------------------------------------ main

def write_csv(path, rows):
    if not rows:
        return
    with open(path, "w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)
    print(f"  wrote {path} ({len(rows)} rows)", flush=True)


def int_list(s):
    return [int(x) for x in s.split(",") if x]


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--out", required=True, help="output directory")
    ap.add_argument("--phases", default="retrieval,replication,storage,nodedown")
    ap.add_argument("--sizes", type=int_list, default=[1, 10, 25, 50],
                    help="file sizes in MB (default 1,10,25,50)")
    ap.add_argument("--concurrency", type=int_list, default=[1, 8, 24],
                    help="concurrent retrievals per cell (default 1,8,24)")
    ap.add_argument("--reps", type=int, default=24,
                    help="distinct files per retrieval cell (default 24)")
    ap.add_argument("--repl-reps", type=int, default=5,
                    help="pins per size in replication phase (default 5)")
    ap.add_argument("--nodedown-size", type=int, default=10,
                    help="file size MB for node-down phase (default 10)")
    ap.add_argument("--nodedown-reps", type=int, default=10,
                    help="samples per node-down scenario (default 10)")
    ap.add_argument("--timeout", type=float, default=120,
                    help="cat timeout, seconds (default 120)")
    ap.add_argument("--dead-timeout", type=float, default=10,
                    help="cat timeout when all replicas are down (default 10)")
    ap.add_argument("--api1", default="http://localhost:5001")
    ap.add_argument("--api2", default="http://localhost:5002")
    ap.add_argument("--api3", default="http://localhost:5003")
    ap.add_argument("--node1-container", default="pangochain-ipfs")
    ap.add_argument("--node2-container", default="pangochain-ipfs2")
    args = ap.parse_args()

    if max(args.concurrency) > args.reps:
        ap.error("--reps must be >= max(--concurrency)")

    out_dir = pathlib.Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)
    for base, name in ((args.api1, "node1"), (args.api2, "node2"),
                       (args.api3, "node3")):
        v = api(base, "version")
        print(f"{name} {base}: kubo {v['Version']}", flush=True)

    summary = {"started_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
               "config": {k: v for k, v in vars(args).items() if k != "out"}}
    phases = args.phases.split(",")
    with tempfile.TemporaryDirectory(prefix="ipfs-bench-") as td:
        tmpdir = pathlib.Path(td)
        for phase in phases:
            print(f"== phase: {phase}", flush=True)
            t0 = time.perf_counter()
            {"retrieval": run_retrieval, "replication": run_replication,
             "storage": run_storage, "nodedown": run_nodedown}[phase](
                args, out_dir, tmpdir, summary)
            summary.setdefault("phase_seconds", {})[phase] = round(
                time.perf_counter() - t0, 1)

    summary["finished_utc"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    with open(out_dir / "summary.json", "w") as fh:
        json.dump(summary, fh, indent=2)
    with open(out_dir / "environment.json", "w") as fh:
        json.dump({
            "os": platform.platform(),
            "python": sys.version.split()[0],
            "kubo": api(args.api1, "version")["Version"],
            "docker": subprocess.run(["docker", "--version"], capture_output=True,
                                     text=True).stdout.strip(),
            "git_commit": subprocess.run(["git", "rev-parse", "HEAD"],
                                         capture_output=True, text=True).stdout.strip(),
            "branch": subprocess.run(["git", "rev-parse", "--abbrev-ref", "HEAD"],
                                     capture_output=True, text=True).stdout.strip(),
        }, fh, indent=2)
    print(f"done: {out_dir}", flush=True)


if __name__ == "__main__":
    main()
