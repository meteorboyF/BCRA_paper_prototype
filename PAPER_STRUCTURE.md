# Paper structure — *Blockchain: Research and Applications* (Elsevier/KeAi)

Outline only. Ordering is driven by the reviewer report: lead with what is
**measured**, and keep every claim inside what the evidence supports.

**Format notes:** single column (`\columnwidth` is full text width; `figure*` is
unnecessary). Build with the `texlive/texlive` Docker image — the host
`pdflatex` fails on a Polish diacritic in the bibliography. Elsevier/KeAi
commonly cap the abstract near **250 words**; the old one was 261 — verify
against BCRA's current guide for authors.

---

## Front matter

- **Title** — should carry "on the release path" or equivalent. The novelty is
  *where* enforcement sits, not that Fabric + IPFS were combined.
- **Abstract** (~250 w). Must contain, in this order: the relocation claim
  **scoped to reads**; the asymmetric failure result (fail-closed reads vs
  availability-first writes, divergence bounded, median 15.9 s); the measured
  read-path cost (+4.0–4.4 ms, inside the 50 ms budget); the scale result. Do
  **not** reuse "statistically indistinguishable".
- **Keywords**
- **Highlights** (KeAi wants 3–5 bullets, ≤85 chars each)

## 1. Introduction

1.1 Problem — administrator-mutable authorization in legal document custody
1.2 Why anchoring alone is insufficient (motivates on-path enforcement)
1.3 Research questions
  - RQ1 enforcement relocation and its verifiability
  - RQ2 interactive cost (50 ms threshold — state it as a *conservative half* of Nielsen's 100 ms; review item 34)
  - RQ3 behaviour under ledger unavailability
  - RQ4 scale
1.4 Contributions — **four, all measurement results** (review item 15):
  1. Measured relocation of release-path authorization, **scoped to the read path**
  2. **Measured asymmetric failure behaviour** — the strongest and most novel result
  3. Scale characterization (10³–10⁶ docs, 2–7 orgs, per-document *and per-time* storage)
  4. End-to-end price against a **durable** audit-log baseline
  - Do **not** reinstate "cryptographic integration" as a contribution — standard primitives, dilutes the rest
1.5 Paper organization

## 2. Background and related work

2.1 Hyperledger Fabric — endorsement, ordering, world state, channels, PDCs
2.2 Content-addressed off-chain storage (IPFS)
2.3 Related systems
  - 2.3.1 Integrity-only / anchoring systems
  - 2.3.2 Hybrid blockchain–IPFS storage
  - 2.3.3 Multi-party and Fabric-based evidence systems
  - 2.3.4 Access-control-centric systems — **must include Steichen et al. 2018**, the architectural ancestor (smart-contract-gated IPFS retrieval)
2.4 **Table 1** — comparison. Column is *"Ledger-evaluated authorization on the release path"*, defined precisely; network-level partitioning (channel membership) scores **P**, not Y
2.5 Research gaps

## 3. Threat model, assumptions, and scope

3.1 Assumptions A1–A7 (state the custodial-identity assumption plainly)
3.2 Adversary classes
3.3 Scenarios S1–S5 — including **S3 public-key substitution** as the sharpest residual risk
3.4 **Scope: framework vs measured prototype** — keep this explicit and early; it is what makes the narrow claims credible rather than evasive

## 4. System architecture

4.1 Overview and component topology → `fabric_topology4.pdf`
4.2 Roles and identity → `Hierarchy.pdf`
4.3 Two-layer authorization → `rbac_acl_pipeline.pdf` ⚠️ **redraw: no org-ownership shortcut**
4.4 Release path and fail-closed semantics → `access_and_decryption.pdf` ⚠️
4.5 Grant, expiry, and revocation → `access_grant.pdf` ⚠️
4.6 Time anchor — clock trust for expiry, and its standing storage cost
4.7 Write path: availability-first, durable outbox, reconciliation → `write_path_reconciliation.pdf`

## 5. Cryptographic design

5.1 Notation
5.2 Document encryption (AES-256-GCM) → `document_encryption.pdf` ⚠️
5.3 Per-recipient key wrapping — **"ECDH-HKDF-AES-GCM hybrid wrap"**, never "ECIES", no Shoup/IND-CCA2 claim
5.4 **Table 2** — 125-byte token format; AAD binds recipient identity; docID *not* bound and why
5.5 Signatures and integrity → `integrity_check_flow.pdf`
5.6 Key lifecycle → `key_gen_and_storage.pdf`, `key_rotation_and_recovery.pdf` ⚠️
5.7 Security properties — what is claimed, and explicitly what is not

## 6. Implementation

6.1 Chaincode (`legalcc`), functions, and lifecycle
6.2 Backend gateway
6.3 Browser client
6.4 Deployment / reproducibility — pin chaincode version and sequence

## 7. Evaluation

7.1 Testbed, workload, and statistical method
  - bootstrap percentile CIs (10,000 resamples, seed 7); Mann-Whitney; **TOST against the pre-specified ±50 ms margin** — non-significance is not equivalence (review item 6)
  - **State the host-quiescence requirement.** Latency figures are invalid on a swapping host; report the bracketed A/B/A design as method, not apology
7.2 **Read-path cost** → `fig2_latency.pdf` ✅ (+4.0–4.4 ms; disjoint CIs; freshness read *not* the cause)
7.3 Throughput and batch sensitivity → `fig1_scalability.pdf`, `fig8_sensitivity.pdf`
7.4 Upload path and file size → `fig3_filesize.pdf`
7.5 Audit verification → `fig4_audit.pdf`
7.6 History depth → `fig7_gethistory.pdf`
7.7 Cryptographic cost → `fig6_crypto.pdf` ⚠️ **regenerate: relabel, add HPKE**
7.8 **Fail-closed under outage** → `fig9_failclosed_outage.pdf` ✅
7.9 **Write-side divergence and durable reconciliation** → `write_path_reconciliation.pdf` ✅ — *the headline novelty; give it room*
7.10 Scale: document volume and storage → `fig12_ledger_growth.pdf` ⚠️ **add the time term**
7.11 Scale: organizations → `fig13_network_scaling.pdf` ⚠️ re-run or scope
7.12 Standard-instrument benchmark → `fig11_caliper.pdf` ⚠️ re-run or scope
7.13 **Price of on-path enforcement vs a durable baseline** → `fig14b_durable_baseline.pdf` ✅
7.14 Adversarial: database mutation, forged grants, denial anchoring
7.15 Consolidated evidence table with CIs
7.16 WAN sensitivity → `fig5_wan.pdf`; IPFS cost → `fig10_ipfs_cost.pdf`

> **Renumber the experiments.** The `12b/14b/16b/17b/6b` suffixes are accreted
> history, and "sixteen experiments" is already wrong (review item 32). Pick a
> clean sequence and fix the count everywhere.

## 8. Discussion

8.1 What the measurements do and do not establish
8.2 **Access-graph disclosure** — named, litigation-specific: expert retention, review-team composition, production scope, ethical-wall inversion. Frame as a *design tension*: the visibility that discloses the graph is the visibility that makes authorization verifiable; PDC migration narrows verification, so it is a trade
8.3 Time-anchor storage cost as the standing price of clock trust, and the interval as a tunable
8.4 Residual risks — S3 and the `RegisterIdentity` mitigation path
8.5 Limitations — custodial identities, CFT not BFT, 3-org single-host, Node WebCrypto not browser, legacy unbound tokens
8.6 Threats to validity

## 9. Conclusion and future work

---

## Non-negotiables carried from the review

1. **Never** claim ledger and database checks are "statistically indistinguishable."
2. **Scope enforcement to the read path.** Writes are availability-first; Experiment 16 is your own contrary evidence.
3. **Never** call the wrap ECIES, and claim no IND-CCA2 property.
4. AAD binds recipient identity only — it does **not** mitigate S3.
5. Storage grows in documents **and in time**.
6. Cross-experiment latency absolutes are not comparable across builds; only paired within-run differences transfer.
7. A narrower true claim is publishable at BCRA. A broad claim contradicted by your own Experiment 16 is not.
