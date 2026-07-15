#!/usr/bin/env python3
"""
Experiment 2 — RegisterDocument 1MB via REST (JSON, Fabric mode)
Measures end-to-end latency for a 1MB ciphertext upload via REST API.
Usage: JWT=<token> CASE_ID=<id> python3 experiments/measure-regdoc-rest.py
"""

import os, sys, time, json, math, http.client, statistics

BASE_HOST = "localhost"
BASE_PORT = 8080
REPS = 20
SIZE_MB = 1

JWT     = os.environ.get("JWT", "")
CASE_ID = os.environ.get("CASE_ID", "")

if not JWT or not CASE_ID:
    print("ERROR: set JWT and CASE_ID env vars", file=sys.stderr)
    sys.exit(1)

size_bytes = SIZE_MB * 1024 * 1024
b64_len = math.ceil(size_bytes / 3) * 4
ciphertext_b64 = "A" * b64_len

print(f"Exp2 REST: RegisterDocument {SIZE_MB}MB — {REPS} samples, Fabric mode")
print(f"Method: POST /api/documents/upload (JSON, ciphertextBase64 len={b64_len:,})")
print(f"Date: {time.strftime('%Y-%m-%dT%H:%M:%S%z')}")
print("=" * 54)

times = []

for i in range(1, REPS + 1):
    payload = json.dumps({
        "caseId": CASE_ID,
        "fileName": f"regdoc-bench-{i}.bin",
        "ivBase64": "A" * 16,
        "ciphertextBase64": ciphertext_b64,
        "documentHashSha256": "0" * 64,
        "wrappedKeyTokenForOwner": "A" * 125,
    })
    body = payload.encode("utf-8")

    try:
        conn = http.client.HTTPConnection(BASE_HOST, BASE_PORT, timeout=30)
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
            print(f"  [{i:2d}/{REPS}] {elapsed}ms  OK")
        else:
            print(f"  [{i:2d}/{REPS}] FAIL (HTTP {resp.status})")
    except Exception as e:
        print(f"  [{i:2d}/{REPS}] ERROR: {e}")

print()
print("Results:")
if times:
    s = sorted(times)
    n = len(s)
    mean = statistics.mean(times)
    p50 = s[n // 2]
    p95 = s[min(int(n * 0.95), n - 1)]
    p99 = s[min(int(n * 0.99), n - 1)]
    print(f"  n={n}  Mean={mean:.1f}ms  P50={p50}ms  P95={p95}ms  P99={p99}ms  Min={min(times)}ms  Max={max(times)}ms")
    print(f"  Note: Includes IPFS primary upload + secondary pin + Fabric commit (~2132ms)")
else:
    print("  No successful samples!")
    sys.exit(1)
