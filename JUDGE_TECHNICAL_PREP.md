# PangoChain Technical Prep for Judges

## One-Line Architecture

PangoChain is a Spring Boot + React legal platform where PostgreSQL stores application state, IPFS stores encrypted document bytes, and Hyperledger Fabric stores tamper-evident document hashes, access-control records, case anchors, and audit events.

## High-Level Stack

- Frontend: React + Vite + Tailwind, running on port `3000`.
- Backend: Spring Boot 3.2, Java 17, REST APIs, Spring Security, JPA, Liquibase, WebSocket/STOMP, Spring AI, Fabric Gateway SDK, IPFS WebClient integration.
- Database: PostgreSQL 16 in Docker.
- File storage: two Kubo IPFS nodes in Docker.
- Blockchain: Hyperledger Fabric 2.4 network with Go chaincode.
- AI: OpenAI through Spring AI, using the backend as the controlled API layer.
- Dev launcher: `bash scripts/dev.sh` starts PostgreSQL, IPFS, optional Fabric, backend, and frontend.

## Docker Setup

The root `docker-compose.yml` starts:

- `pangochain-postgres`: PostgreSQL 16, database `pangochain`.
- `pangochain-ipfs`: primary IPFS node, API on `5001`, gateway on `8081`.
- `pangochain-ipfs2`: secondary IPFS node, API on `5002`, gateway on `8082`.
- Optional backend/frontend service profiles for containerized deployment.

The normal demo command is:

```bash
PANGOCHAIN_WITH_FABRIC=0 bash scripts/dev.sh
```

That skips Fabric for faster demos but still runs the backend with document-material fallback. The full Fabric path is:

```bash
bash scripts/dev.sh
```

which runs `make up`, `make chaincode`, and `make smoke` inside `pangochain-fabric`.

## Hyperledger Fabric Network

Fabric configuration lives in `pangochain-fabric/`.

Network shape:

- Ordering service: 3 orderers using Raft / `etcdraft`
  - `orderer1.pangochain.com`
  - `orderer2.pangochain.com`
  - `orderer3.pangochain.com`
- Organizations:
  - `FirmAMSP`
  - `FirmBMSP`
  - `RegulatorMSP`
- Peers:
  - `peer0.firma.pangochain.com`
  - `peer0.firmb.pangochain.com`
  - `peer0.regulator.pangochain.com`
- Peer state DB: CouchDB per peer.
- Channel profile: `LegalChannel`.
- Chaincode: Go smart contract in `pangochain-chaincode/legalcc`.

Why Fabric:

- Permissioned network fits legal-sector trust boundaries.
- Each organization has its own MSP identity.
- Regulators can be represented as a network organization.
- Ledger history gives tamper-evident proof of document and access events.

## What Chaincode Stores

The chaincode does not store raw legal documents. It stores verifiable metadata:

- Document ID.
- Case ID.
- SHA-256 document hash.
- IPFS CID.
- Owner ID and owner organization.
- Version and previous-version reference.
- Document status: `ACTIVE`, `DELETED`, `SUPERSEDED`.
- Access-control list with capabilities: `owner`, `write`, `read`.
- Audit events for document, access, case, and certificate actions.

Main chaincode functions:

- `RegisterDocument`: anchors document hash and IPFS CID.
- `GrantAccess`: writes access capability and wrapped-key reference.
- `RevokeAccess`: revokes grant and emits key-rotation event.
- `CheckAccess`: evaluates whether a user/org can access a document.
- `UpdateDocument`: records a new hash/CID/version after update or re-encryption.
- `RegisterCase`: anchors a case/matter.
- `LogAuditEvent`: records application audit events on-chain.
- `GetDocumentHistory`: retrieves Fabric history for a document key.

## PostgreSQL: What We Store

PostgreSQL stores application and relational state:

- Users, firms, roles, account status, MFA setup, JWT-related auth state.
- Cases/matters, case clients, case members, milestones, deadlines, case journey nodes.
- Document metadata: file name, case, owner, category, version, status, confidentiality flag, IPFS CID, SHA-256 hash, Fabric transaction ID.
- Document access rows: who has read/write/owner access, wrapped-key token/reference, revocation status.
- Audit log rows for fast querying in the UI.
- Chat, messages, notifications, reminders.
- E-signature workflows and signature status.
- Billing, settlement offers, reports, redactions, annotations, privacy/deletion requests, security alerts.
- AI chat history and AI insight records.

Why PostgreSQL:

- The UI needs fast relational queries, filtering, dashboards, and joins.
- It is the operational source of truth for app workflows.
- Fabric is used for tamper-evidence and verification, not as a general-purpose app database.

## IPFS: What We Store

IPFS stores encrypted document bytes, not plaintext.

Flow:

1. User uploads or opens a document.
2. Document content is encrypted before storage.
3. Encrypted bytes are sent to IPFS.
4. IPFS returns a CID.
5. Backend stores the CID in PostgreSQL and anchors the CID plus hash on Fabric.

Why IPFS:

- Content-addressed storage: a CID points to exact bytes.
- If content changes, the CID changes.
- This pairs well with Fabric because the ledger can anchor the CID and document hash.

## Blockchain vs Database vs IPFS

- PostgreSQL: workflow data, users, cases, metadata, fast UI queries.
- IPFS: encrypted document payloads.
- Fabric: immutable/tamper-evident proof of document identity, access changes, and audit history.

A simple judge answer:

"We do not put private documents directly on-chain. We encrypt documents and store the encrypted bytes in IPFS. The blockchain stores the document hash, IPFS CID, access-control state, version history, and audit events. PostgreSQL stores the normal application data needed for the product experience."

## Security Model

- Authentication: Spring Security + JWT.
- Passwords: PBKDF2-based password hashing.
- MFA: TOTP support.
- Document confidentiality: encrypted document material, access grants, wrapped key references.
- Authorization: role-based backend endpoints plus per-document access checks.
- Auditability: app-level audit rows plus Fabric audit events.
- Revocation: chaincode revocation emits `KEY_ROTATION_REQUIRED`, allowing backend workflows to mark documents for re-encryption/key rotation.

## AI Design

AI features are not automatic data dumping. The user controls context.

- AI Legal Chat: lawyer selects a case and specific documents.
- Documents are decrypted in browser memory for user-authorized analysis.
- Backend sends only the chosen text/context to OpenAI.
- AI Document Analysis: summarizes, extracts dates/obligations/risks.
- Case Insights: analyzes timeline and evidence gaps from case metadata.
- Hearing Prep: generates hearing brief/checklist.
- Drafting: creates legal drafts from case facts and lawyer instructions.
- Client Assistant: gives plain-language case guidance.

## Spring Boot / AOOP Talking Points

Architecture follows layered, object-oriented design:

- Controllers expose REST endpoints.
- Services contain business logic.
- Repositories encapsulate database access through Spring Data JPA.
- Entities model domain objects: users, cases, documents, hearings, messages, etc.
- DTOs/records define request/response contracts.
- Configuration classes wire security, WebSocket, AI, IPFS, and Fabric settings.

AOOP/OOP principles:

- Encapsulation: each module owns its domain logic, for example `document`, `access`, `audit`, `ai`, `cases`.
- Abstraction: service interfaces hide storage/network details from controllers.
- Separation of concerns: PostgreSQL, IPFS, Fabric, AI, auth, and UI are separate layers.
- Reusability: shared services like audit, crypto, IPFS, and Fabric gateway are reused across modules.
- Resilience: Fabric calls use retry/circuit-breaker style dependencies; the dev mode can use DB fallback for demo continuity.

## Backend Modules

Major backend packages:

- `auth`: login, JWT, MFA.
- `user`, `admin`: user/firm/admin management.
- `cases`, `caseevent`, `casenode`, `milestone`, `deadline`: case lifecycle.
- `document`, `ipfs`: document metadata, upload/download, IPFS storage.
- `blockchain`: Fabric Gateway integration and ledger calls.
- `access`: document ACL and access-control workflows.
- `crypto`: key derivation and cryptographic helpers.
- `esignature`, `signingworkflow`: signing and signature workflows.
- `chat`, `message`, `notification`, `reminder`: communication features.
- `audit`, `custody`, `report`: audit trail, chain of custody, reporting.
- `ai`, `classification`: OpenAI legal intelligence and document classification.
- `redaction`, `annotation`, `template`, `billing`, `settlement`, `privacy`, `security`: advanced legal workflows.

## Frontend Talking Points

- React single-page app with role-aware routes.
- Lawyer side: cases, documents, AI assistant, templates, hearings, messages, audit/case insights.
- Client side: client portal, document vault, privacy rights, case assistant.
- Managing partner side: admin/audit/security reporting.
- UI demonstrates document encryption/decryption, AI analysis, and ledger/audit visibility.

## Demo Caveat If Fabric Is Skipped

For a fast live demo, Fabric can be skipped with `PANGOCHAIN_WITH_FABRIC=0`. In that mode:

- PostgreSQL and IPFS still run.
- Backend still demonstrates document encryption, upload, download, AI, and app workflows.
- Fabric-dependent material checks use the configured fallback for demo continuity.
- The full Fabric network, chaincode, scripts, and Docker setup remain in the repo and can be launched when needed.

Use this wording:

"For the presentation we may run in fast demo mode, but the project includes a full Fabric network and Go chaincode. The architecture is designed so operational state stays in PostgreSQL, encrypted payloads stay in IPFS, and ledger proofs live in Fabric."

## Likely Judge Questions

### Why not store files directly in PostgreSQL?

Because legal documents can be large and need content-addressing. PostgreSQL is better for metadata and workflow queries. IPFS is better for encrypted file payloads.

### Why not store files directly on blockchain?

Blockchains are not efficient or private for large confidential files. We store only hashes, CIDs, ACL state, and audit events on-chain.

### What proves a document was not changed?

The document plaintext hash and IPFS CID are anchored. If document bytes or plaintext change, the hash/CID no longer match the ledger record.

### How does access control work?

The application enforces role-based access and per-document access grants. Fabric chaincode can also check document ACL state and records grant/revoke events.

### What happens when access is revoked?

The chaincode marks the grant revoked and emits a key-rotation event. The backend can mark the document as requiring key rotation/re-encryption.

### How is AI kept safe?

AI context is user-selected. Documents are decrypted only when the user authorizes it, and the assistant receives only the chosen text/context, not every document automatically.

### What is the role of Liquibase?

Liquibase manages database migrations so schema changes are versioned and reproducible.

### What makes it AOOP/OOP?

The codebase is organized into domain objects and modules, with controllers, services, repositories, entities, DTOs, and reusable infrastructure services. Each class has a clear responsibility.
