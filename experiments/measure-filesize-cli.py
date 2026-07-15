#!/usr/bin/env python3
"""
Experiment 3 — File Size Impact on Latency (CLI path, no WebClient)
Measures IPFS upload (direct Kubo API, primary + secondary pin) and
Fabric CLI RegisterDocument separately. Total = IPFS + Fabric constant.
Usage: python3 experiments/measure-filesize-cli.py
"""

import os, sys, time, json, subprocess, statistics, tempfile, urllib.request

IPFS_PRIMARY  = "http://localhost:5001"
IPFS_SECONDARY = "http://localhost:5002"
ORDERER_TLS   = ("/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto"
                 "/ordererOrganizations/pangochain.com/orderers"
                 "/orderer1.pangochain.com/tls/ca.crt")
CRYPTO_BASE   = "/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto"
REPS          = 10
SIZES_MB      = [1, 5, 10, 20, 30, 50]
FAB_REPS      = 10


def ipfs_add(filepath):
    """Upload file to IPFS primary (timed), then fire secondary pin non-blocking.
    Returns (hash, elapsed_ms) where elapsed covers primary upload only."""
    start = time.time()
    result = subprocess.run(
        ["curl", "-s", "-X", "POST",
         f"{IPFS_PRIMARY}/api/v0/add?pin=true&quieter=true",
         "-F", f"file=@{filepath}"],
        capture_output=True, text=True, timeout=120
    )
    elapsed = int((time.time() - start) * 1000)
    if result.returncode != 0 or not result.stdout.strip():
        return None, elapsed
    data = json.loads(result.stdout.strip())
    cid = data.get("Hash", "")
    # Secondary pin — fire non-blocking (background), don't wait or include in timing
    if cid:
        subprocess.Popen(
            ["curl", "-s", "-X", "POST",
             f"{IPFS_SECONDARY}/api/v0/pin/add?arg={cid}"],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
        )
    return cid, elapsed


def fabric_invoke(doc_id):
    """Run RegisterDocument via fabric-cli. Returns elapsed_ms or None on failure."""
    cmd = [
        "docker", "exec", "fabric-cli", "peer", "chaincode", "invoke",
        "-C", "legal-channel", "-n", "legalcc",
        "-o", "orderer1.pangochain.com:7050",
        "--tls", "--cafile", ORDERER_TLS,
        "--waitForEvent", "--waitForEventTimeout", "15s",
        "--peerAddresses", "peer0.firma.pangochain.com:7051",
        "--tlsRootCertFiles",
        f"{CRYPTO_BASE}/peerOrganizations/firma.pangochain.com/peers/peer0.firma.pangochain.com/tls/ca.crt",
        "--peerAddresses", "peer0.firmb.pangochain.com:8051",
        "--tlsRootCertFiles",
        f"{CRYPTO_BASE}/peerOrganizations/firmb.pangochain.com/peers/peer0.firmb.pangochain.com/tls/ca.crt",
        "-c", json.dumps({"function": "RegisterDocument", "Args": [
            doc_id, "case-exp3-001", f"hash-{doc_id}", f"QmExp3{doc_id}",
            "user-exp3", "FirmAMSP", "2026-05-22T10:00:00Z"
        ]})
    ]
    start = time.time()
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    elapsed = int((time.time() - start) * 1000)
    out = result.stdout + result.stderr
    return elapsed if "invoke successful" in out else None


def stats(times):
    s = sorted(times)
    n = len(s)
    return {
        "n": n,
        "p50": s[n // 2],
        "p95": s[min(int(n * 0.95), n - 1)],
        "mean": statistics.mean(times),
        "min": min(times),
        "max": max(times),
    }


print("=== Experiment 3 — File Size Impact on Latency (CLI path) ===")
print(f"Date: {time.strftime('%Y-%m-%dT%H:%M:%S')}")
print(f"Method: IPFS Kubo API (port 5001 primary + 5002 secondary pin) + Fabric CLI")
print(f"Samples: IPFS={REPS}/size, Fabric={FAB_REPS}")
print()

# --- Part A: Fabric CLI constant ---
print(f"--- Part A: Fabric CLI baseline ({FAB_REPS} samples) ---")
fab_times = []
for i in range(1, FAB_REPS + 1):
    elapsed = fabric_invoke(f"exp3-fab-{i}-{int(time.time())}")
    if elapsed is not None:
        fab_times.append(elapsed)
        print(f"  Fabric {i}/{FAB_REPS}: {elapsed}ms  OK")
    else:
        print(f"  Fabric {i}/{FAB_REPS}: FAIL")

fab_stat = stats(fab_times)
FAB_P50 = fab_stat["p50"]
print(f"\nFabric CLI constant: n={fab_stat['n']} P50={fab_stat['p50']}ms "
      f"P95={fab_stat['p95']}ms Mean={fab_stat['mean']:.0f}ms\n")

# --- Part B: IPFS upload per file size ---
print("--- Part B: IPFS direct upload per file size ---\n")

all_results = {}

for size_mb in SIZES_MB:
    print(f"--- {size_mb}MB ---")
    tmpfile = f"/tmp/exp3-{size_mb}mb.bin"

    print(f"  Generating {size_mb}MB random file...", end=" ", flush=True)
    with open(tmpfile, "wb") as f:
        f.write(os.urandom(size_mb * 1024 * 1024))
    print(f"done ({size_mb}MB)")

    ipfs_times = []
    for i in range(1, REPS + 1):
        cid, elapsed = ipfs_add(tmpfile)
        if cid:
            ipfs_times.append(elapsed)
            print(f"  IPFS {i}/{REPS}: {elapsed}ms  {cid[:20]}...")
        else:
            print(f"  IPFS {i}/{REPS}: FAIL (elapsed={elapsed}ms)")

    os.remove(tmpfile)

    if ipfs_times:
        ist = stats(ipfs_times)
        total_p50 = ist["p50"] + FAB_P50
        total_p95 = ist["p95"] + FAB_P50
        all_results[size_mb] = {
            "ipfs": ist, "total_p50": total_p50, "total_p95": total_p95
        }
        print(f"  {size_mb}MB IPFS: P50={ist['p50']}ms P95={ist['p95']}ms "
              f"Mean={ist['mean']:.0f}ms n={ist['n']}")
        print(f"  {size_mb}MB TOTAL (IPFS+Fabric): P50={total_p50}ms P95={total_p95}ms")
        print(f"  RESULT size={size_mb}MB IPFS_P50={ist['p50']} IPFS_P95={ist['p95']} "
              f"TOTAL_P50={total_p50} TOTAL_P95={total_p95} n={ist['n']}")
    else:
        print(f"  {size_mb}MB: no successful samples")
    print()

print("=== Summary ===")
print(f"Fabric CLI constant P50: {FAB_P50}ms\n")
print(f"| File Size | IPFS P50 (ms) | IPFS P95 (ms) | IPFS Mean (ms) | Total P50 (ms) | Total P95 (ms) |")
print(f"|-----------|--------------|--------------|---------------|---------------|---------------|")
for size_mb, r in all_results.items():
    ist = r["ipfs"]
    print(f"| {size_mb:>5}MB   | {ist['p50']:>12} | {ist['p95']:>12} | "
          f"{ist['mean']:>13.0f} | {r['total_p50']:>13} | {r['total_p95']:>13} |")

print(f"\nFabric constant = {FAB_P50}ms (P50 of {FAB_REPS} CLI invocations)")
print("Total P50 = IPFS P50 + Fabric constant (additive decomposition)")
print("\n=== Experiment 3 Done ===")
