# PangoChain — Feature Status

> IEEE Access manuscript Access-2026-02049 · Stack: React 18 + Spring Boot 3 + PostgreSQL 16 + Hyperledger Fabric 2.4 + IPFS Kubo

---

## 🔑 Demo Logins (seeded)

All accounts are seeded by `DataSeeder` on backend startup. On first browser login each
account auto-provisions its E2E keypairs (see *First-login key provisioning*), so document
encryption, signing, and chat all work for any account below.

| Role | Email | Password | Notes |
|------|-------|----------|-------|
| Managing Partner | `admin@pangolawfirm.com` | `Admin123!` | Firm-wide admin; lead on Probate + Pinnacle cases. **MFA required** on login. |
| Senior Associate | `lawyer@pangolawfirm.com` | `Lawyer123!` | James Harrington — lead on *Chen v. Meridian*; supervises Associates A–D. |
| Paralegal | `paralegal@pangolawfirm.com` | `Paralegal123!` | On the Chen v. Meridian team. |
| Associate A | `a@pangolawfirm.com` | `Assoc123!` | Aaron Avers — subordinate on Chen v. Meridian (delegation demo). |
| Associate B | `b@pangolawfirm.com` | `Assoc123!` | Bianca Bose — subordinate. |
| Associate C | `c@pangolawfirm.com` | `Assoc123!` | Carlos Cruz — subordinate. |
| Associate D | `d@pangolawfirm.com` | `Assoc123!` | Dana Diaz — subordinate. |
| Client (primary) | `client@demo.com` | `Client123!` | Marcus Chen — client on Chen v. Meridian. |
| Client (secondary) | `client2@demo.com` | `Client123!` | Sofia Delgado — client on Delgado Estate. |

**Seeded to demonstrate features:** 3 cases, hearings + reminders, case timelines, a staffed
case team (lawyer + Associates A–D + paralegal + client on Chen v. Meridian), and starter
**chat** messages in the Chen v. Meridian case channel and the firm-wide channel.

> Try real-time chat: log in as `lawyer@…` in one browser and `a@…` in another (or an
> incognito window), open **Messages**, and send in the Chen v. Meridian channel — it
> appears live in both.

---

## ✅ Done — Production Hardening (Opus polish pass · Wave 1)

| Area | Details |
|------|---------|
| **DB connection discipline** | HikariCP tuned (pool 30, 60s leak detection); JDBC batching (`batch_size: 30`, ordered inserts/updates). *(`open-in-view: false` is the production target but is deferred until controllers stop touching LAZY associations outside a transaction — see the backend fetch-boundary wave.)* |
| **Tomcat thread pool** | Explicit `max: 200`, `min-spare: 20`, `max-connections: 8192`, `accept-count: 100`. |
| **Consistent error envelope** | `GlobalExceptionHandler` enriches every `ProblemDetail` with `error` code, ISO-8601 `timestamp`, and request `path`; adds `FabricException`→503, `IpfsException`→503, `DataIntegrityViolationException`→409; never leaks raw exception text on 500. |
| **HTTP security headers** | CSP, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy` on every response. |
| **Performance indexes** | Liquibase `005-performance-indexes.sql` — `audit_log(event_type)`, `documents(category)`, `case_clients(client_id)`, `messages(sender_id)`, `messages(recipient_id, read_at)`, `hearings(case_id, hearing_date)`. |
| **Resilient API client** | Single-flight token refresh (concurrent 401s → one `/auth/refresh`); 30s timeout; distinct toasts for network-down vs timeout; 403 redirect; 503 deferred to page-level Fabric banner. |
| **Fabric circuit breaker** | Resilience4j `@CircuitBreaker` + `@Retry` on Fabric submit/evaluate. Opens after ≥50% failures in a 10s window (min 5 calls), stays open 30s, then 3 half-open trial calls. While open, the DB/ACL fallback (`ACL_FABRIC_FALLBACK`) fires immediately instead of waiting for each call to time out. |
| **Rate limiting** | Per-IP in-memory token buckets on auth endpoints: login 10/min, refresh 20/min, MFA 5/min → `429` + `Retry-After`. |
| **Auth store hydration** | `hasHydrated` flag gates route redirects (no login-page flash on reload); tokens persisted to **sessionStorage** (PBKDF2-wrapped keys stay in localStorage by design); specific selectors replace whole-store subscriptions. |
| **Shared UI primitives** | `Skeleton` (+ Stat/TableRow/CaseCard/Page variants) and canonical `StatusBadge` component. |

> Deferred to later waves (not yet implemented): full React Query migration of all pages,
> Resilience4j circuit breaker + `@Async` Fabric executor, Bucket4j rate limiting, IPFS
> streaming uploads, the SecureDownloadModal stage-timing redesign, and the per-page
> empty-state / form-validation / mobile pass.

---

## ✅ Done — Core Security Infrastructure

| Feature | Details |
|---------|---------|
| **AES-256-GCM browser encryption** | Plaintext never leaves the browser. IV (12 bytes) prepended to ciphertext before IPFS upload. |
| **ECIES P-256 key wrapping** | Per-user document key wrapped with recipient's public key for secure multi-party access. |
| **PBKDF2 key derivation** | 600,000 iterations SHA-256. Private key encrypted in localStorage, unlocked by password in-browser only. |
| **WebCrypto API integration** | All crypto operations via `window.crypto.subtle` — no third-party crypto libs. |
| **Append-only audit log** | PostgreSQL `audit_log` table with INSERT-only trigger — UPDATE/DELETE blocked at DB level. |
| **JWT authentication** | Access token + refresh token. Spring Security filter chain. |
| **PBKDF2 password hashing** | Server-side PBKDF2 hash for login credential verification (separate from key derivation). |

---

## ✅ Done — Hyperledger Fabric Network

| Feature | Details |
|---------|---------|
| **3-org Fabric network** | FirmA, FirmB, Regulator — 3-node Raft orderer cluster (CFT), CouchDB state DB |
| **3-node Raft orderer cluster** | orderer1/2/3.pangochain.com — crash-fault-tolerant (1 node can fail, quorum maintained). Verified by stopping a node and confirming transaction commit continues. |
| **`legalcc` chaincode (Go)** | 10 functions: RegisterDocument, GrantAccess, RevokeAccess, CheckAccess, GetDocumentHistory, UpdateDocument, RegisterCase, LogAuditEvent, RevokeUserCertificate, logAuditInternal |
| **Chaincode event listener** | Spring Boot `FabricEventHandler` subscribes to chaincode events |
| **FabricGatewayService** | Spring Boot gateway service — submits/evaluates transactions via Fabric Gateway SDK |
| **Two-layer ACL** | JWT (Spring Security) + `CheckAccess` chaincode. Graceful fallback to DB if Fabric unreachable |
| **Containerised network setup** | `make up/chaincode/smoke/down` — no local Fabric binaries needed (works on Windows via Docker) |
| **Blockchain document anchoring** | Every uploaded document registered on Fabric ledger with SHA-256 hash |
| **Blockchain case anchoring** | Case creation anchored via `RegisterCase` chaincode |

---

## ✅ Done — Document Management

| Feature | Details |
|---------|---------|
| **Secure document upload** | Browser encrypts → IV+ciphertext → IPFS → RegisterDocument chaincode |
| **Secure document download** | Fetch from IPFS → unwrap AES key via ECIES → AES-GCM decrypt → SHA-256 integrity verify |
| **SecureDownloadModal** | 4-stage progress UI: Fetch → Unwrap key → Decrypt → Verify integrity |
| **Document categories** | GENERAL, EVIDENCE, CONTRACT, CORRESPONDENCE, CONFESSION, MEDICAL, FINANCIAL |
| **Confidential flag** | CONFIDENTIAL badge + red styling for sensitive documents |
| **Document versioning** | `previous_version_id` chain in DB, `UpdateDocument` chaincode |
| **Per-document ACL** | `document_access` table tracks capability (owner/write/read), expiry, revocation |
| **TeamAccessPanel** | Per-document access management UI — grant (ECIES key wrap), revoke, expiry date |
| **IPFS storage** | Encrypted ciphertext stored on 2-node private IPFS swarm with cross-pinning (each node pins all CIDs from the other — single-node failure loses no data) |

---

## ✅ Done — Client Portal

| Feature | Details |
|---------|---------|
| **Client dashboard** | Next hearing countdown, unread reminders, document/message/audit stats |
| **Next hearing countdown** | Days/hours remaining displayed prominently |
| **Secure document vault** | Client uploads with category + confidential flag; full encrypt → IPFS pipeline |
| **My Case view** | Hearings list (past/today/future colour-coded), case selector for multiple cases |
| **Privacy rights panel** | 5-point client rights checklist |
| **Encryption status panel** | Live display of AES-256-GCM / ECIES P-256 / PBKDF2 / Fabric 2.4 status |
| **Blockchain audit trail** | Case event timeline with Fabric tx IDs visible to client |
| **Client-case association** | `case_clients` table + `POST /api/cases/{id}/clients` + `GET /api/cases/my-cases` |
| **Role-based navigation** | Clients see simplified sidebar (Portal / Document Vault / My Case / Messages) |

---

## ✅ Done — Lawyer / Legal Professional Portal

| Feature | Details |
|---------|---------|
| **Case management** | Create, list, search, close cases — Fabric-anchored |
| **Case detail (4 tabs)** | Documents · Hearings · Team Access · Timeline |
| **Case Journey tree** | Milestone graph for case progress. Milestones are lawyer-authored planning/progress nodes; hearings and filings can merge branches and the tree can continue after the hearing. This differs from the Events Feed, which is the immutable audit/ledger chronology of system actions. |
| **Hearing scheduler** | Create hearings (type, court, location, datetime, notes), delete |
| **Send reminders to clients** | Email lookup → `POST /api/reminders` with priority (HIGH/NORMAL) |
| **HearingManager page** | Calendar-style date badges, upcoming/past separation |
| **Document access grants** | TeamAccessPanel: grant ECIES-wrapped access, set expiry, revoke |
| **Audit Trail page** | Paginated real audit log with eventType/resourceId filters |
| **LedgerExplorer page** | Blockchain audit browser — expandable rows with Fabric tx IDs and context JSON |
| **Dashboard stats** | Active cases, total documents, next hearing, unread reminders |

---

## ✅ Done — Secure Messaging

| Feature | Details |
|---------|---------|
| **E2E encrypted messages** | AES-256-GCM + ECIES P-256 — plaintext never stored or transmitted |
| **In-browser encryption** | Compose: encrypt in browser → wrap key with recipient's ECIES pubkey → POST ciphertext |
| **In-browser decryption** | Unlock private key with password (PBKDF2) → ECIES unwrap → AES-GCM decrypt → display |
| **Conversation threads** | Messages grouped by sender/recipient, expandable |
| **Unread count** | Badge in sidebar, `GET /api/messages/unread-count` |
| **Client ↔ Lawyer messaging** | Both roles share the same Messages page — any user can message any other |

---

## ✅ Done — Admin Features

| Feature | Details |
|---------|---------|
| **Admin panel** | User management table with role/status display |
| **Activate / Suspend users** | `POST /api/admin/users/{id}/activate` and `/suspend` |
| **Role-based access** | MANAGING_PARTNER, IT_ADMIN, REGULATOR roles see admin nav |
| **MFA enforcement** | MANAGING_PARTNER and IT_ADMIN must enroll in TOTP MFA before first login. Login issues HTTP 403 with `requiresMfaSetup=true` if unenrolled; HTTP 202 with challenge token for enrolled users. Opt-in for all other roles. |
| **Key rotation UI** | Profile page shows key status (public key fingerprint) |

---

## ✅ Done — Site-Wide Particle Background (Phase 2)

| Feature | Details |
|---------|---------|
| **Global fixed canvas** | `ParticleBackground` component: `position: fixed`, `z-index: 0`, `pointer-events: none` — mounted once in App.tsx above all routes |
| **Reduced-motion support** | Returns null when `prefers-reduced-motion: reduce` is set — no animation for users who opt out |
| **Accessibility** | `aria-hidden="true"` on the particle container — decorative only, excluded from screen readers |
| **Performance** | Wrapped in `React.memo` + `React.lazy` to prevent re-renders; 3 canvas variants: vivid (landing), auth (login), app (dashboard) |
| **Page transparency** | Auth pages (`Login`, `Register`) use `bg-surface/90`; MainLayout uses `bg-surface/80` — particles show through from the fixed layer |

---

## ✅ Done — Frontend Hardening (Phase 3)

| Feature | Details |
|---------|---------|
| **Error Boundary** | `ErrorBoundary` class component wraps entire app; on uncaught render error shows "Something went wrong" with AlertTriangle icon and "Go to Dashboard" link |
| **ACL Fabric Fallback highlight** | AuditTrail page: `ACL_FABRIC_FALLBACK` events rendered with amber badge and amber row background — immediately visible to auditors |
| **Dashboard next hearing card** | Fetches `GET /dashboard/lawyer` on load; displays countdown in days/hours (amber for today/tomorrow, teal for future); "No upcoming hearings" when null |
| **Fabric tx ID in activity feed** | Dashboard Recent Activity shows first 8 chars + `…` of each entry's Fabric tx ID in monospace |
| **Sidebar unread badge** | Messages nav link shows teal circular badge with count; fetches `/dashboard/stats` on mount; hidden when count is 0 |
| **Mobile hamburger** | Sidebar hidden on small screens; hamburger `<Menu>` button in sticky mobile header toggles full-screen overlay drawer with backdrop + close button |
| **Document category filter** | Documents page: filter chips for ALL / GENERAL / CONTRACT / EVIDENCE / PLEADING / CORRESPONDENCE; passes `?category=` to API |

---

## ✅ Done — Developer & Ops

| Feature | Details |
|---------|---------|
| **DataSeeder** | On startup seeds 4 users, 3 cases, 5 hearings, 4 reminders, timeline events |
| **Liquibase migrations** | `001–004-*.sql` — reproducible DB setup including ECDSA signing key columns |
| **Docker Compose** | `postgres`, `ipfs` services — `docker compose up postgres ipfs -d` (requires Compose plugin v2, not legacy `docker-compose`) |
| **Fabric Makefile** | `make up/chaincode/smoke/down/clean` |
| **TypeScript strict** | Zero TS errors (`npx tsc --noEmit` clean) |

---

## ✅ Done — Digital Signatures (ECDSA P-256)

| Feature | Details |
|---------|---------|
| **ECDSA P-256 keypair generation** | Separate signing keypair generated at registration (alongside ECIES keypair). Private key AES-256-GCM wrapped under PBKDF2, stored in localStorage. Public key persisted on server. |
| **Browser-side ECDSA signing** | `SignDocumentModal` uses WebCrypto `sign({name:'ECDSA', hash:{name:'SHA-256'}})` to produce an IEEE P1363 signature over the document SHA-256 hash. Password unlocks the signing key (not the encryption key). |
| **Server-side ECDSA verification** | `EcdsaVerifier` uses Java's `SHA256withECDSAinP1363Format` (SunEC, Java 17+) with the signer's registered JWK public key. POST `/api/signatures/{docId}/sign` returns HTTP 400 if signature invalid. |
| **Signature Fabric anchoring** | Verified signatures anchored via `LogAuditEvent` on `legal-channel` before DB persist. |
| **Verification status** | `esignatures.verification_status` = `VERIFIED` for all ECDSA-verified records. |

---

## 🔲 Planned — Future Features

| Feature | Priority | Notes |
|---------|----------|-------|
| **Message reply threading** | Medium | Quick-reply box in conversation — pre-fills composeTo. Full thread reply needs `parent_id` on messages table |
| **Real-time notifications** | Medium | WebSocket / SSE push for new messages and reminders (currently poll on page load) |
| **Document versioning UI** | Medium | Show version history chain in CaseDetail Documents tab |
| **Bulk document operations** | Low | Select multiple → bulk grant access / bulk download |
| **Billing matters UI** | Low | `billing_matters` table exists — no frontend yet |
| **Regulator read-only portal** | Low | Regulator role can query any case's Fabric audit log for oversight |
| **Key rotation workflow** | Low | Generate new ECIES keypair, re-wrap all document keys with new public key |
| **Caliper CI integration** | Low | Run benchmarks automatically in CI on Fabric changes |



> **Note:** These accounts are created by the DataSeeder on first backend startup. All accounts are set to `ACTIVE` status — no approval step needed for demo.

---

## How to Run

```bash
# 1. Start PostgreSQL + IPFS
# Requires Docker Compose plugin (docker compose, not docker-compose)
docker compose up postgres ipfs -d

# 2. Start Spring Boot backend (seeds data on first run)
cd pangochain-backend
./mvnw spring-boot:run

# 3. Start React frontend
cd pangochain-frontend
npm install
npm run dev
# → http://localhost:5173

# 4. (Optional) Start Fabric network — requires WSL2 / Git Bash + Docker Desktop
cd pangochain-fabric
make up          # ~3 min — crypto + channel + peers
make chaincode   # ~2 min — build, package, install, approve, commit
make smoke       # verify
```

### Environment variables (`.env` or system)

```
DB_PASSWORD=pangochain_secret
JWT_SECRET=<any 256-bit base64 string>
IPFS_API_HOST=http://localhost
# Fabric (only if running Fabric network):
FABRIC_PEER_ENDPOINT=peer0.firma.pangochain.com:7051
FABRIC_MSP_ID=FirmAMSP
FABRIC_CERT_PATH=config/fabric/crypto/admin-cert.pem
FABRIC_KEY_PATH=config/fabric/crypto/admin-key.pem
FABRIC_TLS_CERT_PATH=config/fabric/crypto/tls-ca-cert.pem
FABRIC_CHANNEL=legal-channel
FABRIC_CHAINCODE=legalcc
```

> Without Fabric running, the app degrades gracefully — document uploads skip blockchain anchoring, downloads use DB-only ACL check. All other features work normally.
