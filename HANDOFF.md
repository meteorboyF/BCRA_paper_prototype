# PangoChain — Handoff Guide
**IEEE Access Manuscript Access-2026-02049**
*Last updated: 2026-05-19 — Phase 7 complete. All 4 hardening implementations done. All 7 experiments done.*

---

## What This Project Is

PangoChain is a secure legal document management system built for an IEEE Access paper. Stack:

- **Frontend:** React 18 + TypeScript + Vite + Tailwind (`pangochain-frontend/`)
- **Backend:** Spring Boot 3.2.5 + Java 17 + PostgreSQL 16 + Liquibase (`pangochain-backend/`)
- **Blockchain:** Hyperledger Fabric 2.4 — 3-org, **3-node Raft orderer** cluster, CouchDB state DB (`pangochain-fabric/`)
- **Storage:** IPFS Kubo — **2-node private swarm** with cross-pinning
- **Chaincode:** Go (`pangochain-chaincode/legalcc/`)

---

## Current State — Everything Complete

### Implementations Done (Phase 7)

| # | Feature | Status |
|---|---------|--------|
| 1 | **3-node Raft orderer cluster** | ✅ CFT verified — orderer1/2/3.pangochain.com |
| 2 | **2-node IPFS private swarm** | ✅ Cross-pinning confirmed — ipfs + ipfs2 |
| 3 | **MFA enforcement** | ✅ MANAGING_PARTNER + IT_ADMIN blocked at login if not enrolled |
| 4 | **ECDSA P-256 digital signatures** | ✅ Server-side verification with SHA256withECDSAinP1363Format |

### Experiments Done

| Exp | Description | Result | Commit |
|-----|-------------|--------|--------|
| 1 | Caliper scalability (TPS) | Peak 26.7 TPS (Linux x86_64) | `62e0800` |
| 2 | Function-level latency | RegisterDocument P50 = 2147ms | (Linux) |
| 3 | File size impact | Fabric commit ΔP50 ≈ 0ms (IPFS-dominated) | `d23636f` |
| 4 | Audit verification efficiency | PostgreSQL 44ms P50 vs manual 100ms | `0f29e50` |
| 5 | WAN latency simulation | P50 = 2556ms at 150ms RTT | `c1f5799` |
| 6 | Crypto benchmark | PBKDF2 83ms, AES-GCM 56ms, ECIES 51.2% smaller than RSA | `af7cc5e` |
| 7 | GetHistoryForKey at scale | Mean 132.4ms, P50 133.5ms at 106 history entries | `4eab7b7` |

All results are in `experiment_results.md`.

---

## Architecture Quick Reference

### Security invariants (NEVER violate)
1. Plaintext never leaves the browser — AES-256-GCM in browser, server receives ciphertext only
2. Every document download invokes `CheckAccess` chaincode (two-layer ACL); DB-only fallback only if Fabric unreachable
3. ECIES P-256 for key wrapping (not RSA-OAEP)
4. PBKDF2 600,000 iterations SHA-256 for password-based key derivation
5. PostgreSQL `audit_log` is append-only — INSERT-only trigger blocks UPDATE/DELETE at DB level
6. IV (12 bytes) always prepended to ciphertext before IPFS; download always splits `bytes[0:12]` as IV

### Key design decisions
- **ECDSA signing key** — separate from ECIES encryption key. Both generated at registration, both PBKDF2-wrapped in localStorage.
- **MFA flow** — login returns HTTP 202 + `challengeToken` (5min JWT) if enrolled; HTTP 403 + `requiresMfaSetup=true` if not. Challenge token consumed at `POST /api/auth/mfa/challenge`.
- **3-node Raft** — all invocations must target all 3 peers with `--peerAddresses` flags (endorsement policy = majority). Single-peer invocations will get `ENDORSEMENT_POLICY_FAILURE` at commit.
- **IPFS cross-pinning** — `IpfsService.add()` uploads to primary, pins on secondary. `cat()` falls back to secondary.

---

## Fabric Network — Critical Notes

### Invoking chaincode (MUST use all 3 peers)
```bash
ORDERER_CA="/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/pangochain.com/orderers/orderer1.pangochain.com/tls/ca.crt"
CRYPTO_BASE="/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto"

docker exec fabric-cli peer chaincode invoke \
  --channelID legal-channel --name legalcc \
  --tls --cafile "$ORDERER_CA" \
  -o orderer1.pangochain.com:7050 \
  --waitForEvent \
  --peerAddresses peer0.firma.pangochain.com:7051 \
  --tlsRootCertFiles ${CRYPTO_BASE}/peerOrganizations/firma.pangochain.com/peers/peer0.firma.pangochain.com/tls/ca.crt \
  --peerAddresses peer0.firmb.pangochain.com:8051 \
  --tlsRootCertFiles ${CRYPTO_BASE}/peerOrganizations/firmb.pangochain.com/peers/peer0.firmb.pangochain.com/tls/ca.crt \
  --peerAddresses peer0.regulator.pangochain.com:9051 \
  --tlsRootCertFiles ${CRYPTO_BASE}/peerOrganizations/regulator.pangochain.com/peers/peer0.regulator.pangochain.com/tls/ca.crt \
  -c '{"function":"...","Args":[...]}'
```

### Rapid concurrent invocations cause MVCC conflicts
If multiple transactions modify the same key in the same block, all but one will be invalidated (ENDORSEMENT_POLICY_FAILURE at commit, even though endorsement returns status:200). Use `--waitForEvent` for sequential state writes to the same key.

---

## Starting the Full Stack

**Terminal 1 — Postgres + IPFS (both nodes):**
```bash
docker compose up postgres ipfs ipfs2 -d
```

**Terminal 2 — Fabric network:**
```bash
cd pangochain-fabric
make up        # generates crypto, starts orderer1/2/3 + peers + CouchDB + CAs
make chaincode # builds legalcc, packages, installs on all peers, commits
make smoke     # quick verify
```

**Terminal 3 — Backend:**
```bash
cd pangochain-backend
./mvnw spring-boot:run
# Wait for: "Started PangochainBackendApplication"
```

**Terminal 4 — Frontend:**
```bash
cd pangochain-frontend
npm install
npm run dev
# → http://localhost:5173
```

### Environment variables (`.env` or system)
```
DB_PASSWORD=pangochain_secret
JWT_SECRET=<any 256-bit base64 string>
IPFS_API_HOST=http://localhost
IPFS_API_PORT=5001
IPFS_API_HOST2=http://localhost
IPFS_API_PORT2=5002
FABRIC_PEER_ENDPOINT=peer0.firma.pangochain.com:7051
FABRIC_PEER_HOST_OVERRIDE=peer0.firma.pangochain.com
FABRIC_MSP_ID=FirmAMSP
FABRIC_CERT_PATH=config/fabric/crypto/admin-cert.pem
FABRIC_KEY_PATH=config/fabric/crypto/admin-key.pem
FABRIC_TLS_CERT_PATH=config/fabric/crypto/tls-ca-cert.pem
FABRIC_CHANNEL=legal-channel
FABRIC_CHAINCODE=legalcc
```

### Smoke test
```bash
JWT=$(curl -s -X POST http://localhost:8080/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@pangolawfirm.com","password":"Admin123!"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['accessToken'])")
curl -s -H "Authorization: Bearer $JWT" http://localhost:8080/api/dashboard/stats | python3 -m json.tool
```

---

## DB Migrations

| File | Contents |
|------|----------|
| `001-initial-schema.sql` | All base tables: users, firms, cases, documents, document_access, esignatures, messages, audit_log, notifications, billing_matters |
| `002-client-features.sql` | hearings, reminders, case_events, case_clients; documents.category + documents.confidential |
| `003-key-rotation.sql` | documents.key_rotation_pending, document_access.token_obsolete, esignatures.document_hash |
| `004-signing-key.sql` | users.signing_public_key; esignatures.signature_b64 / document_hash_b64 / signing_public_key / verification_status; signature_hash made nullable |

---

## Key Files

| File | Purpose |
|------|---------|
| `context.md` | Full architecture, design decisions, API endpoints, phase history |
| `FEATURES.md` | Feature list with implementation status |
| `experiment_results.md` | All 7 experiment results + known gaps table |
| `pangochain-fabric/docker-compose.fabric.yml` | Fabric containers (orderer1/2/3, 3 peers, CouchDB, CAs) |
| `pangochain-fabric/scripts/start-network.sh` | Network startup |
| `pangochain-fabric/scripts/deploy-chaincode.sh` | Chaincode deployment (targets all 3 peers) |
| `pangochain-chaincode/legalcc/chaincode.go` | Go chaincode — 10 functions |
| `pangochain-backend/src/main/java/.../esignature/EcdsaVerifier.java` | ECDSA P-256 server-side verification |
| `pangochain-frontend/src/lib/crypto.ts` | All WebCrypto functions (ECIES, ECDSA, AES-GCM, PBKDF2) |

---

## Known Gaps (for paper's Framework vs. Prototype table)

| Gap | Impact |
|-----|--------|
| Custodial Fabric wallets | Admin identity used for all Fabric txns — production needs per-user X.509 in HSM |
| Key rotation server-side impossible | Owner browser required for re-encryption; server sets `key_rotation_pending=true` |
| TOTP recovery codes not implemented | No recovery if authenticator lost |
| ECDSA signing key in localStorage | PBKDF2-wrapped, not in HSM/WebAuthn |
| Real-time notifications via polling | WebSocket/SSE not implemented |

---

## Recent Commits
```
4eab7b7 docs: update FEATURES.md, context.md, experiment_results.md after Phase 7
beab4a0 impl(esignature): replace key-possession proof with ECDSA P-256 digital signatures
42af0be impl(mfa): enforce TOTP for MANAGING_PARTNER and IT_ADMIN on login
(earlier) impl(ipfs): 2-node private swarm with cross-pinning
(earlier) impl(fabric): 3-node Raft orderer cluster (CFT)
97db3b1 results: all 6 experiments complete after restart recovery
```
