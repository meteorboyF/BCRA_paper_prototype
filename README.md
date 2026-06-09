# PangoChain

**AI-Powered Blockchain Legal Platform**

> Secure, transparent, and intelligent legal case management — powered by Hyperledger Fabric, IPFS, end-to-end encryption, and OpenAI.

*Submitted to: Codex Dhaka Meetup — Dev Change Makers Community*

---

## The Problem

Legal professionals manage thousands of sensitive documents across fragmented, insecure systems:

- **No tamper-proof record.** Traditional systems cannot prove a document's integrity in court — anyone with database access can silently alter records.
- **Broken client communication.** Clients have no transparent view of their own case. Legal jargon is inaccessible. Secure messaging between lawyers and clients is non-existent in most firms.
- **Manual, error-prone classification.** Paralegals spend hours categorizing and reviewing documents — a task AI can handle in seconds.
- **Compliance without proof.** Audit logs exist, but they are mutable. There is no cryptographic proof that the log itself has not been tampered with.

---

## The Solution

**PangoChain** is a full-stack legal document management platform where:

1. Every document is **encrypted in the browser** (AES-256-GCM) before it ever leaves the client — the server never sees plaintext.
2. Encrypted blobs are stored on **IPFS** (InterPlanetary File System) across a private 2-node swarm.
3. Every document, case, and access event is **anchored on a Hyperledger Fabric blockchain** — immutable, auditable, and court-admissible.
4. Access control is enforced **on-chain** via chaincode — even the server administrator cannot read a document without a valid capability grant recorded on the ledger.
5. An **OpenAI GPT-4o layer** adds intelligence: document analysis, legal assistant chat, smart classification, and plain-language summaries for clients.

---

## OpenAI Integration

| Feature | Implementation | OpenAI Capability Used |
|---|---|---|
| **AI Legal Assistant** | RAG pipeline over case documents; lawyers chat with their files | GPT-4o + Assistants API (file threading, document retrieval) |
| **Client Assistant** | Translates legal filings into plain English for clients | GPT-4o (instruction-following, tone adaptation) |
| **Smart Document Classification** | Auto-categorizes uploads as CONTRACT, EVIDENCE, MEDICAL, FINANCIAL, etc. | GPT-4o function-calling (structured JSON output) |
| **Case Insights** | AI-generated risk summary and outcome assessment per case | GPT-4o (legal reasoning, chain-of-thought) |

**Why GPT-4o?**
Legal document understanding requires nuanced reasoning over long, dense text. GPT-4o's 128k context window handles full contracts, the Assistants API's file threading enables multi-document RAG without preprocessing, and function-calling produces reliable structured output for classification pipelines. No other model matches this combination for legal workflows.

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│              Browser (React 18 + TypeScript)         │
│         WebCrypto: AES-256-GCM + ECIES P-256        │
│    Plaintext never leaves the client unencrypted    │
└──────────────────────┬──────────────────────────────┘
                       │ HTTPS / WebSocket (STOMP)
                       ▼
┌─────────────────────────────────────────────────────┐
│            Spring Boot 3.2.5 API (Java 17)           │
│  ┌──────────────┬──────────────┬───────────────────┐ │
│  │ PostgreSQL 16│  IPFS Kubo   │ Hyperledger Fabric│ │
│  │ (metadata,   │  2-node swarm│ 2.4 (chaincode    │ │
│  │  audit log)  │  (enc blobs) │  ACL + anchoring) │ │
│  └──────────────┴──────────────┴───────────────────┘ │
│  ┌─────────────────────────────────────────────────┐ │
│  │          OpenAI API (GPT-4o)                    │ │
│  │  Document analysis · RAG · Classification       │ │
│  └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

---

## Key Features

### Blockchain & Security
- **Document anchoring** — SHA-256 hash of every document registered on Fabric at upload; download verifies integrity
- **On-chain access control** — Fabric chaincode enforces `CheckAccess` before any download; `GrantAccess` / `RevokeAccess` recorded immutably
- **Chain of custody** — every hand-off logged on-chain with timestamps
- **Immutable audit log** — PostgreSQL INSERT-only trigger + Fabric `LogAuditEvent` chaincode function
- **End-to-end encryption** — AES-256-GCM (document), ECIES P-256 (key wrapping for multi-party access), ECDSA P-256 (digital signatures)
- **PBKDF2 key derivation** — 600,000 iterations; encryption keys never stored in plaintext
- **MFA (TOTP)** with recovery codes for privileged roles
- **Rate limiting** — per-IP token buckets (10/min login, 20/min refresh)
- **Anomaly detection** — alerts on suspicious login patterns and bulk document downloads

### Legal Operations
- **Case management** — create, search, close cases; conflict checking against existing clients
- **Case journey** — milestone + hearing merging into a visual timeline
- **Hearing scheduler** — court, location, date/time; automatic reminders to clients (HIGH / NORMAL priority)
- **Document versioning** — full history chain with SHA-256 links
- **Document redaction** — PII masking with server-side validation
- **Document annotations** — highlights and notes per document
- **Multi-party signing workflows** — orchestrated ECDSA signature collection
- **Settlement offers** — structured offer/accept/reject between parties
- **Billing** — time entries and invoice generation
- **Template engine** — generate standard legal documents from templates

### AI (OpenAI-Powered)
- **AI Legal Assistant** (`/ai-assistant`) — RAG over case documents; supports multi-turn legal Q&A
- **Client Assistant** (`/client/assistant`) — plain-language explanations of case filings and hearings
- **Smart Classification** — automatic document categorization on upload
- **Case Insights** — risk assessment and pattern analysis per case

### Portals
- **Lawyer portal** — full case/document/hearing management, ledger explorer, audit trail
- **Client portal** — secure document vault, next-hearing countdown, AI assistant, privacy rights
- **Regulator view** — read-only oversight with full audit access
- **Admin panel** — user/role management, MFA enforcement, key rotation

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript 5 + Vite + Tailwind CSS + Zustand |
| Backend | Spring Boot 3.2.5 + Java 17 + Spring Security + Spring Data JPA |
| Database | PostgreSQL 16 + Liquibase (23 migrations) |
| Blockchain | Hyperledger Fabric 2.4 (Go chaincode, Raft orderer, 3 orgs) |
| Storage | IPFS Kubo 0.27.0 (2-node private swarm with cross-pinning) |
| AI | OpenAI GPT-4o (Assistants API, function-calling) |
| Cryptography | WebCrypto API — AES-256-GCM, ECIES P-256, ECDSA P-256, PBKDF2 |
| Messaging | WebSocket (STOMP) — E2E encrypted real-time chat |
| Infrastructure | Docker + Docker Compose, IPFS, Hyperledger Fabric network |

---

## Project Structure

```
pangochain/
├── pangochain-backend/        # Spring Boot API (190 Java files, 35 modules)
├── pangochain-frontend/       # React app (74 TS/TSX files, 26 pages)
├── pangochain-chaincode/      # Hyperledger Fabric Go chaincode
├── pangochain-fabric/         # Fabric network config (3-org Raft)
├── scripts/                   # One-command dev launcher
├── docker-compose.yml         # PostgreSQL + IPFS stack
└── README.md
```

---

## Quick Start

```bash
# 1. Start infrastructure (PostgreSQL + IPFS)
docker compose up postgres ipfs -d

# 2. Start backend
cd pangochain-backend && ./mvnw spring-boot:run

# 3. Start frontend
cd pangochain-frontend && npm install && npm run dev
```

Or use the one-command launcher:
```bash
bash scripts/dev.sh
```

See [SETUP.md](SETUP.md) for full environment setup including Fabric network.

**Demo users seeded on first startup:**
- `admin@firmA.com` / `Admin123!` — Managing Partner (MFA required)
- `lawyer@firmA.com` / `Lawyer123!` — Lawyer
- `client@example.com` / `Client123!` — Client

---

## Impact

**Who benefits:**
- **Law firms** — automated document review saves hours per case; blockchain audit trail satisfies compliance requirements without extra overhead
- **Clients** — transparent case visibility, secure communication, AI-powered plain-language explanations reduce client anxiety and support calls
- **Courts & regulators** — cryptographically-provable chain of custody and immutable audit logs are court-admissible
- **Legal aid organizations** — the client AI assistant lowers the barrier for non-English-speaking or legally unsophisticated clients

**Potential impact:**
- Reduces document review time for classification and summarization significantly
- Eliminates the risk of silent document tampering — a real concern in high-stakes litigation
- Extends access to legal intelligence to clients who cannot afford extensive lawyer consultation time

---

## OpenAI Usage Summary (Hackathon Submission)

- **Models used:** GPT-4o via OpenAI API
- **Platform features:** Assistants API (file threading for RAG), function-calling (structured classification output), chat completions (case insights, client assistant)
- **Integration points:** `AiAssistant` page (lawyer RAG chat), `ClientAssistant` page (plain-language client portal), `classification` backend module (auto-categorization on upload), `CaseInsights` page (risk analysis)
- **Why these capabilities:** GPT-4o's long context handles full legal contracts; Assistants API eliminates custom RAG infrastructure; function-calling ensures reliable structured output for document classification pipelines

---

## Submission Info

- **Project Name:** PangoChain
- **Team:** Fardeen Jahangir
- **GitHub:** https://github.com/meteorboyF/Fardeen_Codex_Dhaka_Meetup_Hackathon
- **Hackathon:** Codex Dhaka Meetup — Dev Change Makers Community
