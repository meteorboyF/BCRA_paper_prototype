#!/bin/bash
# Run all PangoChain experiments using Hyperledger Caliper v0.5
# Prerequisites: Node.js 18+, npm, running PangoChain stack (docker-compose + backend + Fabric)

set -e

echo "=== PangoChain Experiment Runner ==="
echo "Stack: Hyperledger Caliper v0.5 -> Spring Boot API -> Fabric"
echo ""

# ── Prerequisites check ────────────────────────────────────────────────────────
command -v node >/dev/null 2>&1 || { echo "ERROR: Node.js not found"; exit 1; }
command -v npx  >/dev/null 2>&1 || { echo "ERROR: npx not found"; exit 1; }

# ── Authenticate and get JWT ───────────────────────────────────────────────────
echo "[1/6] Authenticating with PangoChain API..."
AUTH=$(curl -s -X POST http://localhost:8080/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@pangolawfirm.com","password":"Admin123!"}')

export PANGOCHAIN_JWT_TOKEN=$(echo "$AUTH" | python3 -c "import sys,json; print(json.load(sys.stdin)['accessToken'])" 2>/dev/null || echo "")
if [ -z "$PANGOCHAIN_JWT_TOKEN" ]; then
  echo "ERROR: Could not obtain JWT. Is the backend running on port 8080?"
  exit 1
fi
echo "JWT obtained: ${PANGOCHAIN_JWT_TOKEN:0:20}..."

# ── Get a test case and document ID ───────────────────────────────────────────
echo "[2/6] Getting test case and document IDs..."
export PANGOCHAIN_TEST_CASE_ID=$(curl -s -H "Authorization: Bearer $PANGOCHAIN_JWT_TOKEN" \
  http://localhost:8080/api/cases?page=0\&size=1 | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['content'][0]['id'])" 2>/dev/null || echo "")

export PANGOCHAIN_TEST_DOC_ID=$(curl -s -H "Authorization: Bearer $PANGOCHAIN_JWT_TOKEN" \
  http://localhost:8080/api/documents?page=0\&size=1 | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['content'][0]['id'])" 2>/dev/null || echo "")

echo "  Case ID : $PANGOCHAIN_TEST_CASE_ID"
echo "  Doc ID  : $PANGOCHAIN_TEST_DOC_ID"

# ── Install Caliper ────────────────────────────────────────────────────────────
echo "[3/6] Installing Hyperledger Caliper CLI..."
npm install --save-dev @hyperledger/caliper-cli@0.5.0 axios 2>/dev/null

# ── Run Experiment 1 (Scalability) — Fabric mode ──────────────────────────────
echo "[4/6] Running Experiment 1: Scalability (Fabric mode)..."
mkdir -p results
npx caliper launch manager \
  --caliper-workspace . \
  --caliper-benchconfig pangochain-benchmark.yaml \
  --caliper-report-path results/exp1-fabric-$(date +%Y%m%d-%H%M).html \
  2>&1 | tee results/exp1-fabric.log

echo ""
echo "=== Experiment 1 complete. Results in results/exp1-fabric.log ==="
echo ""
echo "Next steps:"
echo "  - To run PostgreSQL-only mode: set FABRIC_ENABLED=false in backend application.yml, restart backend"
echo "  - Re-run this script for Experiment 1 (DB-only)"
echo "  - Run Experiment 2-4 manually per experiment_results.md instructions"
echo "  - Experiment 5 (WAN): requires Linux tc netem — see experiment_results.md"
echo "  - Experiment 6 (Crypto): run crypto-benchmark.html in browser"
