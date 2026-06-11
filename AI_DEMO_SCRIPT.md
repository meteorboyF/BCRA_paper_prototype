# PangoChain AI Demo Script

Use this script for a 7-10 minute recording. Start the app with:

```bash
export OPENAI_API_KEY=your-real-openai-api-key
PANGOCHAIN_WITH_FABRIC=0 bash scripts/dev.sh
```

Open: http://localhost:3000

## Demo Accounts

- Lawyer: `lawyer@pangolawfirm.com` / `Lawyer123!`
- Client: `client@demo.com` / `Client123!`
- Managing partner: `admin@pangolawfirm.com` / `Admin123!`

## Opening Narration

"Legal teams handle sensitive documents, client communications, evidence, court dates, and audit obligations across many disconnected tools. That creates risk: documents can be mishandled, chain of custody can be unclear, and lawyers lose time manually reviewing material.

PangoChain is an AI-powered blockchain legal platform. It combines browser-side encryption, IPFS storage, Hyperledger Fabric audit trails, role-based access control, and OpenAI-powered legal intelligence so lawyers can securely manage cases and use AI without losing control of confidential documents."

## Landing Page

Show the landing page and point to the headline: "PangoChain - AI-Powered Blockchain Legal Platform."

Say:
"The landing page frames the product: secure legal workflows, encrypted document handling, immutable audit trails, and AI assistance across lawyer, client, and partner workflows."

## Lawyer Flow

Sign in as:

```text
lawyer@pangolawfirm.com
Lawyer123!
```

Open the `Chen v. Meridian Holdings - Contract Dispute` matter.

### 1. AI Document Analysis

Go to `Documents`.

Use the seeded files:

- `Repair Notice Email Thread.doc`
- `Witness Statement - Maintenance Notice.md`
- `Meridian Supplier Service Agreement.doc`
- `Damages and Mitigation Ledger.md`
- `AI Hearing Prep Fact Pack.md`

Click the AI/sparkle analysis action on `Meridian Supplier Service Agreement.doc`. Enter the lawyer password when prompted.

Say:
"The document is decrypted in the browser only after I authorize it. Then PangoChain sends the readable text to AI for a focused legal analysis."

Expected result:

- Summary of the supplier agreement.
- Risk flags around the 72-hour response window, preservation of portal records, liability cap, confidentiality clause, and one-sided termination rights.
- Suggested follow-up questions or discovery targets.

Prompt to say out loud:
"This is useful because the lawyer can immediately spot risky clauses and connect them to discovery strategy without manually reading every uploaded document."

### 2. AI Chat With Case Context

Go to `AI Assistant`.

Select the Chen matter if there is a case selector. Ask:

```text
What evidence supports Marcus Chen's argument that Meridian had notice before issuing the termination notice? Cite the most important document names.
```

Then ask:

```text
What facts are missing before we file or argue the preliminary injunction?
```

Expected result:

- It should cite notice dates from January 18, January 24, and February 3, 2024.
- It should mention `Repair Notice Email Thread.doc`, `Witness Statement - Maintenance Notice.md`, and the lease/rent ledger.
- It should identify missing portal exports, photos with metadata, invoices, receipts, and maintenance technician records.

Say:
"This shows document-grounded case intelligence. The AI is not just chatting generally; it is working from the matter facts and seeded legal documents."

### 3. AI Case Insights

Go to `Case Insights`.

Select `Chen v. Meridian Holdings - Contract Dispute`.

Run the timeline check.

Say:
"Timeline AI reviews matter metadata, hearings, documents, and milestones to surface sequence issues and preparation risks."

Then run evidence-gap analysis.

Expected result:

- It should highlight missing repair portal logs, photos, invoices, receipts, and technician testimony.
- It should connect the gaps to the preliminary injunction hearing.

### 4. AI Hearing Prep

Go to `Hearings`.

Find `Preliminary Injunction Hearing` for the Chen matter and open the AI hearing prep action.

Expected result:

- Hearing objective.
- Strongest arguments.
- Weaknesses.
- Exhibits to prepare.
- Action items before the hearing.

Say:
"The lawyer can turn the case file into a hearing brief in seconds, while still reviewing and editing the final legal strategy."

### 5. AI Drafting

Go to `Templates`.

Use `AI Draft`.

Case: `Chen v. Meridian Holdings - Contract Dispute`  
Document type: `DEMAND_LETTER`

Instructions:

```text
Draft a demand letter to Meridian Holdings demanding withdrawal of the February 12 termination notice, preservation of all maintenance records, repair of Suite 4B, and rent abatement under the lease.
```

Facts:

```text
Marcus Chen sent written water-intrusion notices on January 18, January 24, and February 3, 2024. Elaine Porter acknowledged the January 18 notice. Meridian issued a termination notice on February 12, 2024. The tenant incurred emergency storage, IT migration, temporary office, and lost meeting damages. Evidence gaps include portal exports, photos with metadata, invoices, and maintenance technician records.
```

Expected result:

- Draft title.
- Demand letter text.
- Review notes.

Say:
"This is not meant to replace counsel. It creates a strong first draft from structured facts so the lawyer spends time reviewing strategy instead of starting from a blank page."

### 6. Secure Upload + AI Classification

Use the upload-ready folder:

```text
/home/angkon/pangochain-ai-upload-demo-docs
```

Upload:

```text
06-contract-with-risky-clauses.doc
```

Expected result:

- Browser-side encryption before upload.
- AI or heuristic classification suggestion, usually `CONTRACT`.
- After upload, analyze it with AI and show one-sided clauses, record preservation risk, liability cap, confidentiality, and termination imbalance.

Say:
"This proves the full loop: local document, browser encryption, secure upload, classification, storage, decryption by an authorized user, and AI analysis."

## Client Flow

Sign out and sign in as:

```text
client@demo.com
Client123!
```

Show the client portal.

Ask the client assistant:

```text
What is happening in my case and what should I prepare before the next hearing?
```

Then ask:

```text
Which documents should I review before approving settlement authority?
```

Expected result:

- Plain-language explanation of the case.
- Reminder to review settlement authority and document uploads.
- Guidance to prepare invoices, photos, and records.

Say:
"The client gets understandable guidance without exposing administrative screens or privileged partner tools."

## Managing Partner Flow

Sign out and sign in as:

```text
admin@pangolawfirm.com
Admin123!
```

Only show the audit/reporting feature.

Go to `Audit Trail` or the admin reporting screen.

Show:

- Case events.
- Document upload and access events.
- AI analysis events.
- Security alert or burst access alert if visible.

Say:
"The managing partner does not need to inspect every document. They need governance: who accessed what, when AI was used, what was shared, and whether suspicious activity occurred. PangoChain preserves that compliance story in one place."

## Closing Narration

"PangoChain turns legal case management into a secure intelligence layer. Lawyers can encrypt and manage documents, clients can understand their matter, and firm leadership can audit activity. AI speeds up review, drafting, hearing prep, and evidence analysis while blockchain-backed records preserve trust."

## Uploaded Demo Files

Additional files for live upload are in:

```text
/home/angkon/pangochain-ai-upload-demo-docs
```

- `01-commercial-lease-risk-scan.md`
- `02-employment-settlement-letter.doc`
- `03-witness-statement-property-damage.md`
- `04-hearing-prep-facts.doc`
- `05-evidence-gap-checklist.md`
- `06-contract-with-risky-clauses.doc`

The `.doc` files are plain-text demo documents with a `.doc` extension so PangoChain can decrypt and analyze them directly in the browser.
