#!/usr/bin/env python3
"""
Registers a benchmark test user, creates a case, uploads a document.
Outputs shell-eval-able lines: JWT=..., CASE_ID=..., DOC_ID=...
"""
import json, sys, time, urllib.request, urllib.error

BASE = "http://localhost:8080/api"
EMAIL    = "bench@pangochain.test"
PASSWORD = "BenchPass123!"
FULL_NAME = "Bench User"

# Valid P-256 JWK (ECDH, used for ECIES key wrapping)
PUBLIC_KEY_JWK = json.dumps({
    "key_ops": [], "ext": True, "kty": "EC",
    "x": "E_gWrIIdr82r7VBi1Puni6MWZYVX229afdYCT0FnuMI",
    "y": "OadM9BGwCf_07-zUuZHCTPyJWyC2nVs0zhJ-u-8LLao",
    "crv": "P-256"
})

def req(method, path, data=None, token=None, ok_codes=(200,201)):
    hdrs = {"Content-Type": "application/json"}
    if token:
        hdrs["Authorization"] = f"Bearer {token}"
    body = json.dumps(data).encode() if data else None
    r = urllib.request.Request(f"{BASE}{path}", body, hdrs, method=method)
    try:
        with urllib.request.urlopen(r, timeout=30) as resp:
            return json.loads(resp.read()), resp.status
    except urllib.error.HTTPError as e:
        try:
            return json.loads(e.read()), e.code
        except Exception:
            return {"error": str(e)}, e.code
    except Exception as e:
        return {"error": str(e)}, 0

import subprocess

# Register (ignore 409 conflict = already exists)
data, code = req("POST", "/auth/register", {
    "email": EMAIL, "password": PASSWORD, "fullName": FULL_NAME,
    "role": "ASSOCIATE_JUNIOR", "publicKeyJwk": PUBLIC_KEY_JWK,
    "firmId": "5c86b39f-f353-4d0b-bfda-f448fe9d38bc",
})
if code not in (200, 201, 409):
    print(f"WARN: register returned {code}: {data}", file=sys.stderr)

# Activate user in DB (new accounts start as PENDING_APPROVAL)
activate = subprocess.run(
    ["docker", "exec", "pangochain-postgres", "psql", "-U", "pangochain", "-d", "pangochain",
     "-c", f"UPDATE users SET status = 'ACTIVE' WHERE email = '{EMAIL}';"],
    capture_output=True, text=True)
if activate.returncode != 0:
    print(f"WARN: psql activate failed: {activate.stderr}", file=sys.stderr)
else:
    print(f"User activated (rows: {activate.stdout.strip()})", file=sys.stderr)

# Login
data, code = req("POST", "/auth/login", {"email": EMAIL, "password": PASSWORD})
token = data.get("accessToken", "")
if not token:
    print(f"ERROR: login failed ({code}): {data}", file=sys.stderr)
    sys.exit(1)

# Create case
data, code = req("POST", "/cases",
    {"title": "P2-Bench-Case", "description": "BatchTimeout / WAN benchmark load test"},
    token)
case_id = data.get("id", "")
if not case_id:
    print(f"ERROR: create case failed ({code}): {data}", file=sys.stderr)
    sys.exit(1)

# Upload document
data, code = req("POST", "/documents/upload", {
    "caseId": str(case_id),
    "fileName": "bench.bin",
    "ivBase64": "AAAAAAAAAAAAAAAA",
    "ciphertextBase64": "A" * 1024,
    "documentHashSha256": "0" * 64,
    "wrappedKeyTokenForOwner": "A" * 125,
}, token)
doc_id = data.get("id", "")
if not doc_id:
    print(f"ERROR: upload doc failed ({code}): {data}", file=sys.stderr)
    sys.exit(1)

# Shell-eval output
print(f"export PANGOCHAIN_JWT_TOKEN={token!r}")
print(f"export PANGOCHAIN_TEST_CASE_ID={str(case_id)!r}")
print(f"export PANGOCHAIN_TEST_DOC_ID={str(doc_id)!r}")
