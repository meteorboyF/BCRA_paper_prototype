# Future Work — full text (parked)

The BRA version compresses Future Work from 11 subsubsections to two paragraphs
(reviewer-signal reasons; see IMPROVEMENTS.md). The full IEEE-version text is
preserved here verbatim in case any item needs to be restored or expanded later.

## Real-Time Anomaly Detection
The append-only Fabric audit trail enables continuous monitoring for
anomalous access patterns. Future work could integrate machine
learning classifiers trained on `GetHistoryForKey` query
sequences to flag unusual access frequency or bulk downloads. The
append-only `audit_log` table provides a low-latency feed
(3.9 ms P50) suitable for near-real-time
analysis [siddamsetti2024anomaly].

## Privacy-Preserving Access Verification
Future work could investigate privacy-preserving authorization
mechanisms, including zero-knowledge proofs for selected policy
checks [groth2016], together with batching or cover-traffic
mechanisms to reduce timing and frequency leakage [fabricPDCDoc].

## Formal Verification of Chaincode
The `CheckAccess` and `RegisterDocument` chaincode
functions implement security-critical logic. Formal verification
using model-checking or theorem-proving tools would provide
machine-checked guarantees of access-control completeness and
absence of chaincode-level bypasses under the modeled
policy [permenev2020verx].

## Comparative Complexity and Cost Modeling
The present evaluation is empirical and prototype-focused. It compares the
measured Fabric `CheckAccess` path with a PostgreSQL-only ACL read path
and reports absolute write latency for the Fabric-backed registration path,
but it does not provide a formal asymptotic cost model for alternative
architectures. Future work will develop a comparative complexity and cost
analysis of application-only authorization, append-only database authorization,
Fabric-as-audit-log designs, and Fabric-on-path `CheckAccess`
authorization. Such a model should account for endorsement, ordering,
validation, access-check query cost, revocation, audit-history retrieval,
and failure handling across increasing numbers of documents, users,
organizations, and policy updates.

## Decentralized Identity Integration
Replacing the prototype's centralized PostgreSQL identity database
with W3C Decentralized Identifiers (DIDs) [sporny2023did]
would reduce reliance on a single institution's identity store while
preserving consortium governance. Such integration would need to
coexist with Fabric MSP enrollment or be bridged through a DID-to-MSP
credential mapping layer.

## Cross-Network Evidence Collection
Future work could develop interoperability protocols enabling evidence
registered on one consortium's Fabric network to be verified by a
different consortium without shared channel membership, using
cross-chain relay mechanisms or verifiable credential
exchange [sporny2022vc].

## Cross-Version CID Chaining
Future work could investigate explicit cross-version CID chaining for document-version provenance. In the current prototype, document integrity is established through plaintext-hash anchoring, ciphertext/CID anchoring, and Fabric ledger history rather than through a separate CID chain linking successive document versions.

## IPFS Persistence Incentive Mechanism
The 2-node private IPFS swarm relies on contractual obligations for
pinning governance. A formal incentive mechanism for private-swarm
pinning remains future work; in the evaluated consortium setting,
availability is instead governed contractually through node-operation
obligations.

## Hardware Security Module Integration
Full production deployment requires HSM integration at two levels:
HSM-backed Fabric CA enrollment issuing per-user X.509 certificates
with FIPS 140-3-compliant key storage [fips1403, fabricCADoc],
and client-side WebAuthn/FIDO2 hardware authenticators replacing the
current `localStorage` key store. Both upgrades require no
chaincode modification [nist800634, w3cWebAuthnL3, nist800131a].

## Key Recovery and Escrow Governance
The current prototype does not implement production-grade key recovery.
Because client private keys are stored in browser `localStorage`
under password-derived protection, loss of browser storage or the wrapping
password can make the corresponding signing or wrapping key unrecoverable.
Future work will implement a consortium-governed recovery workflow using
KMS/HSM-backed escrow, threshold administrative approval, auditable recovery
requests, and secure re-wrapping of recovered keys. Such a workflow must
avoid giving any single administrator unilateral access to user private keys
and must be evaluated for insider-abuse resistance before production use.

## Regulator-Facing Compliance Interfaces
In the current prototype, the Regulator organization participates only as
an ordering node and a passive channel peer with the same query interface
available to other consortium members. Future work will add
application-layer regulatory audit interfaces, dedicated read-only
compliance dashboards that expose ledger history without granting
document-release authority, and regulator-specific endorsement policies
(e.g., `AND('LawFirmAMSP.peer', 'RegulatorMSP.peer')`) requiring
joint regulator-firm approval for high-value asset transfers. These
extensions require no chaincode redesign, since `CheckAccess` and
`GetHistoryForKey` already support additional endorsement and
query-scope configuration.
