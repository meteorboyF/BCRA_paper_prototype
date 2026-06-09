# PangoChain — Project Brief

**Hackathon:** Codex Dhaka Meetup by Dev Change Makers
**Submitted by:** Fardeen Jahangir
**GitHub:** https://github.com/meteorboyF/Fardeen_Codex_Dhaka_Meetup_Hackathon

---

## What It Is

PangoChain is a secure legal document management platform that combines blockchain immutability, decentralized storage, and OpenAI intelligence. Law firms can upload, share, sign, and audit sensitive case documents with cryptographic proof of integrity — and now with AI that reads those documents for them.

---

## The Problem It Solves

Law firms today use document systems that are:
- **Mutable** — anyone with DB access can alter a record silently
- **Opaque to clients** — clients get no real-time, transparent view of their case
- **Manually intensive** — classifying, summarizing, and extracting key clauses from documents is still done by hand
- **Insecure by design** — sensitive legal files pass through servers in plaintext

---

## How It Works

1. A lawyer uploads a document → the **browser encrypts it** (AES-256-GCM) before any network request
2. The encrypted blob goes to **IPFS** (decentralized storage, 2-node private swarm)
3. The document's SHA-256 hash and access policy are **anchored on Hyperledger Fabric** — immutable, auditable
4. When a user downloads, the chaincode **checks on-chain permissions first** — no valid grant, no file
5. The **OpenAI layer** analyzes decrypted documents client-side: classifies them, summarizes key clauses, powers the AI assistant

---

## OpenAI Integration

| Feature | What It Does |
|---|---|
| **AI Legal Assistant** | Lawyers chat with their case documents using RAG; GPT-4o answers questions grounded in actual case files |
| **Client Assistant** | Translates legal filings into plain English so clients understand their own case |
| **Smart Classification** | GPT-4o function-calling auto-tags uploads as CONTRACT, EVIDENCE, MEDICAL, FINANCIAL, etc. on upload |
| **Case Insights** | AI-generated risk summary and pattern assessment per case |

**Model:** GPT-4o | **APIs:** Assistants API (RAG), function-calling (classification), chat completions

---

## Why This Matters

- A client's right to understand their own legal situation is fundamental — AI bridges the comprehension gap
- Blockchain audit trails are court-admissible; mutable database logs are not
- Legal AI that operates over **actually encrypted documents** (not cloud-stored plaintext) is a meaningful privacy step forward
- Smaller legal aid organizations can now offer AI-assisted services without enterprise budgets

---

## Tech Stack (Summary)

React 18 + TypeScript · Spring Boot 3.2.5 + Java 17 · PostgreSQL 16 · Hyperledger Fabric 2.4 (Go chaincode) · IPFS Kubo · OpenAI GPT-4o · WebCrypto (AES-256-GCM, ECIES P-256, ECDSA P-256)

---

## Status

Core platform (blockchain, IPFS, E2E encryption, case management, document workflows, client portal) is fully implemented. OpenAI integration is actively being wired into existing AI scaffold pages (`AiAssistant`, `ClientAssistant`, `classification` module) using the $50 OpenAI credits awarded by the hackathon.
