#!/usr/bin/env python3
"""
Client-side copy of experiments/setup-bench-data.py for the two-host
validation. Registers the benchmark user, creates a case, uploads a
document against a REMOTE gateway, and prints shell-eval-able
JWT/CASE_ID/DOC_ID lines.

Differences from the original (both required for remote use):
  - Gateway base URL comes from PANGOCHAIN_API_URL (the original
    hardcoded http://localhost:8080/api).
  - The user-activation step (docker exec ... psql UPDATE users ...)
    is REMOVED: it must run on the SERVER host, which owns the
    database. If login fails with a pending-approval status, ask the
    server session to run the activation SQL (see client_bundle
    README) and rerun this script — registration is idempotent.

PANGOCHAIN_FIRM_ID must be set to a firm UUID from the server's
database (the server session provides it together with the URL).
"""
import json, os, sys, urllib.request, urllib.error

BASE = os.environ.get("PANGOCHAIN_API_URL", "http://localhost:8080/api").rstrip("/")
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

def req(method, path, data=None, token=None):
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

firm_id = os.environ.get("PANGOCHAIN_FIRM_ID")
if not firm_id:
    print("ERROR: set PANGOCHAIN_FIRM_ID (ask the server session for a "
          "firm UUID from its database)", file=sys.stderr)
    sys.exit(1)

# Register (ignore 409 conflict = already exists)
data, code = req("POST", "/auth/register", {
    "email": EMAIL, "password": PASSWORD, "fullName": FULL_NAME,
    "role": "ASSOCIATE_JUNIOR", "publicKeyJwk": PUBLIC_KEY_JWK,
    "firmId": firm_id,
})
if code not in (200, 201, 409):
    print(f"WARN: register returned {code}: {data}", file=sys.stderr)

print("NOTE: if this is a fresh registration, the server session must "
      "activate the user before login succeeds (see README).", file=sys.stderr)

# Login
data, code = req("POST", "/auth/login", {"email": EMAIL, "password": PASSWORD})
token = data.get("accessToken", "")
if not token:
    print(f"ERROR: login failed ({code}): {data}\n"
          "If status is pending approval, ask the server session to run "
          "the activation SQL, then rerun this script.", file=sys.stderr)
    sys.exit(1)

# Create case
data, code = req("POST", "/cases",
    {"title": "TwoHost-Bench-Case", "description": "Cross-host validation load test"},
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
