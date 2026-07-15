#!/usr/bin/env python3
"""
Experiment 3 — File Size Impact on Latency (REST path, with secondary IPFS pin)
Sends JSON POST to /api/documents/upload with base64 ciphertext of each target size.
Matches 2026-05-15 methodology: full IpfsService path (primary upload + secondary pin + Fabric commit).
Usage: JWT=<token> CASE_ID=<id> python3 experiments/measure-filesize-rest.py
"""

import os, sys, time, json, math, http.client, statistics

BASE_HOST = "localhost"
BASE_PORT = 8080
REPS = 10
SIZES_MB = [1, 5, 10, 20, 30, 50]

JWT    = os.environ.get("JWT", "")
CASE_ID = os.environ.get("CASE_ID", "")

if not JWT or not CASE_ID:
    print("ERROR: set JWT and CASE_ID env vars", file=sys.stderr)
    sys.exit(1)

print(f"=== Experiment 3 — File Size Impact on Latency (REST path) ===")
print(f"Date: {time.strftime('%Y-%m-%dT%H:%M:%S%z')}")
print(f"Method: POST /api/documents/upload (JSON, AES-GCM ciphertext base64)")
print(f"IPFS: primary (port 5001) + secondary pin (port 5002)")
print(f"Samples per size: {REPS}")
print()

all_results = {}

for size_mb in SIZES_MB:
    size_bytes = size_mb * 1024 * 1024
    # base64 length = ceil(size_bytes / 3) * 4
    b64_len = math.ceil(size_bytes / 3) * 4
    # actual bytes that will be uploaded to IPFS = floor(b64_len * 3 / 4)
    actual_bytes = b64_len * 3 // 4

    ciphertext_b64 = "A" * b64_len

    print(f"--- {size_mb}MB (ciphertext_b64 len={b64_len:,}, actual bytes={actual_bytes:,}) ---")

    times = []
    for i in range(1, REPS + 1):
        payload = json.dumps({
            "caseId": CASE_ID,
            "fileName": f"bench-{size_mb}mb-{i}.bin",
            "ivBase64": "A" * 16,
            "ciphertextBase64": ciphertext_b64,
            "documentHashSha256": "0" * 64,
            "wrappedKeyTokenForOwner": "A" * 125,
        })
        body = payload.encode("utf-8")

        try:
            conn = http.client.HTTPConnection(BASE_HOST, BASE_PORT, timeout=90)
            start = time.time()
            conn.request("POST", "/api/documents/upload", body=body, headers={
                "Authorization": f"Bearer {JWT}",
                "Content-Type": "application/json",
                "Content-Length": str(len(body)),
            })
            resp = conn.getresponse()
            resp.read()
            elapsed = int((time.time() - start) * 1000)
            conn.close()

            if resp.status in (200, 201):
                times.append(elapsed)
                print(f"  {size_mb}MB sample {i}: {elapsed}ms  OK")
            else:
                print(f"  {size_mb}MB sample {i}: {elapsed}ms  FAIL (HTTP {resp.status})")
        except Exception as e:
            elapsed_e = int((time.time() - start) * 1000) if 'start' in dir() else -1
            print(f"  {size_mb}MB sample {i}: ERROR {e} ({elapsed_e}ms)")

    if times:
        s = sorted(times)
        n = len(s)
        mean = statistics.mean(times)
        p50 = s[n // 2]
        p95 = s[min(int(n * 0.95), n - 1)]
        all_results[size_mb] = {"mean": mean, "p50": p50, "p95": p95, "n": n}
        print(f"  {size_mb}MB REST: mean={mean:.0f}ms  P50={p50}ms  P95={p95}ms  n={n}")
    else:
        print(f"  {size_mb}MB: no successful samples")
    print()

print("=== Summary ===")
print("| File Size | Total P50 (ms) | Total P95 (ms) | Total Mean (ms) | IPFS est P50 (ms) |")
print("|-----------|---------------|---------------|----------------|-------------------|")
FABRIC_CONSTANT = 2132  # from CLI benchmark 2026-05-22
for size_mb, r in all_results.items():
    ipfs_est = r["p50"] - FABRIC_CONSTANT
    print(f"| {size_mb} MB  | {r['p50']} | {r['p95']} | {r['mean']:.0f} | ~{ipfs_est} |")

print()
print(f"IPFS estimate = Total P50 - {FABRIC_CONSTANT}ms (Fabric CLI constant, 2026-05-22)")
print("Note: Includes IpfsService primary upload + secondary pin (~234ms) + Fabric commit.")
