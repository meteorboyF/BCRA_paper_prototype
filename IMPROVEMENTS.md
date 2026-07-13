# IMPROVEMENTS.md — Plan to raise acceptance odds at Blockchain: Research and Applications

Written 2026-07-13, after the template conversion (`bra_submission/`). No manuscript
edits were made for any item below; this is the work plan for later sessions.

## What BRA publishes (research basis)

Scanned BRA issues Vol 5 (2024) through Vol 7 (2026) and in-journal search results.
BRA is an applied journal: it regularly publishes system papers with a concrete
domain (healthcare records, land records, digital wills, evidence management,
government approval workflows, supply chains) built on permissioned chains, and it
publishes evaluation-methodology papers (e.g., "Fault tolerance testing and tuning
for consortium blockchain", June 2025; "SimBlockLink" middleware for performance
evaluation, 2025). Directly adjacent recent titles:

- A Blockchain-Based Traceable Access Control Scheme for IPFS (BRA, online June 2026)
- Zero trust-driven access control delegation using blockchain (BRA 7(1), Feb 2026)
- Decentralized Trust: NFT and blockchain-enabled evidence system using fog computing (BRA 7(1), 2026)
- An Adaptive Blockchain-Enabled Access Control Framework for Secure and Privacy-Preserving E-Health Data Sharing (BRA, online Apr 2026)
- Trusted wills for digital assets using blockchain: a practical case (BRA, Sept 2025)
- Blockchain-enabled secure land record management system (BRA, online July 2026)
- MrC: A medical-record chain system based on blockchain (BRA, June 2026)
- Unlocking the potential of data: blockchain-based health data governance framework (BRA 7(1), 2026)

Pattern in their evaluation sections: throughput/latency curves under varying load
(often Hyperledger Caliper), scaling with network parameters, at least one baseline
or comparative configuration, and an explicit threat/trust analysis. Novelty is
framed as a capability delta over named prior systems, usually with a comparison
table. Our manuscript already fits this genre better than it fit IEEE Access; the
gaps below are about sharpening that fit.

---

## 1. Novelty framing (impact: HIGH, effort: 2-3 days)

Fabric + IPFS document storage is a crowded pattern; the paper's actual
differentiator is (a) chaincode access check on the live release path with
(b) measured fail-closed behavior and (c) the measured latency cost of on-path
enforcement. The current lit-review table (tab:literature_review) is good but
should be recut against the *closest current* systems, including BRA's own.

Candidate closest systems for the comparison table (verify metadata before citing):

1. Liu & Zheng 2024 — judicial evidence preservation, on-chain anchoring +
   off-chain storage (already cited as `liu2024blockchain`).
2. N. Liu, S. Lu, W. Ren, "A Blockchain-Based Traceable Access Control Scheme for
   IPFS", Blockchain: Research and Applications, in press (2026). Closest single
   competitor; must be discussed.
3. R. Mukta, S. Pal, et al., "Zero trust-driven access control delegation using
   blockchain", Blockchain: Research and Applications 7(1), 2026.
4. M. S. Peelam et al., "Decentralized Trust: NFT and blockchain-enabled evidence
   system using fog computing", Blockchain: Research and Applications 7(1), 2026.
5. FileWallet: A File Management System Based on IPFS and Hyperledger Fabric,
   CMES 2022 (generic Fabric+IPFS file manager, no on-path enforcement claim).
6. J. Hernando-Corrochano et al., "Trusted wills for digital assets using
   blockchain: a practical case", BRA, Sept 2025 (legal-domain applied paper —
   frames what BRA considers a good legal case study).
7. (Optional) Zohre Notash et al., adaptive blockchain access-control framework for
   e-health sharing, BRA 2026 — same architecture class, different domain.

Draft comparison-table skeleton (columns = capabilities we measured; the point is
that no prior row has all of the last four):

| System | Off-chain encrypted storage | On-path chaincode ACL at release time | Fail-closed under ledger outage (measured) | On-path latency cost quantified | Time-bounded grants + revocation on ledger | User-level signature binding | Legal-domain workflow mapping |
|---|---|---|---|---|---|---|---|
| Liu & Zheng 2024 | Y | N (audit anchor) | N | N | P | N | P (judicial) |
| Liu/Lu/Ren BRA 2026 (IPFS ACL) | Y | P (scheme-level, not measured on release path) | N | N | Y (traceable) | N | N |
| Mukta et al. BRA 2026 (zero trust) | N/A | P (delegation logic) | N | P | Y | P | N |
| Peelam et al. BRA 2026 (evidence/fog) | Y | N | N | N | N | P | P (evidence) |
| FileWallet CMES 2022 | Y | P | N | N | N | N | N |
| **This work** | **Y** | **Y (CheckAccess on download)** | **Y (Exp 9)** | **Y (Exp 2: 6.51 vs 7.16 ms P50)** | **Y** | **Y (ECDSA P-256)** | **Y** |

Action items:
- Pull PDFs of #2, #3, #4; verify what they actually claim/measure; fill P/N cells
  honestly (a reviewer of a BRA paper may literally be one of these authors).
- Rewrite the "Identified Research Gaps" subsection so the gap statement names
  these systems rather than review articles.
- Add one sentence to the abstract and intro that states the delta in one breath:
  "prior Fabric+IPFS systems anchor or log access decisions; none measures the
  cost of enforcing them on the release path, nor demonstrates fail-closed
  behavior under ledger outage."

## 2. Legal-domain grounding (impact: HIGH, effort: 2-4 days)

BRA rewards applied papers with a real domain (wills, land records, health
records above). Our legal angle is currently asserted more than demonstrated.
No new experiments needed; this is a writing + evidence task.

Proposed additions (outline only):

- **Motivating scenario section (~1 page)**: a cross-firm e-discovery exchange.
  FirmA produces privileged-reviewed documents to FirmB under a protective order
  with an expiry date; the regulator audits afterwards. Walk the scenario through
  the existing workflows (upload -> grant with ExpiresAt -> download via
  CheckAccess -> revocation -> audit). Every feature used already exists in the
  prototype, so the section costs prose, not code.
- **Feature-to-workflow mapping table**: rows = legal requirements, columns =
  framework mechanism + evidence:
  - Chain of custody (US FRE 901/902(13)-(14) authentication; UK equivalents) ->
    on-chain hash anchoring + GetHistoryForKey (Exp 7).
  - E-discovery / disclosure (FRCP 26/34, EDRM stages) -> time-bounded grants,
    org-prefix ACL, audit export.
  - Client confidentiality (ABA Model Rule 1.6; attorney-client privilege) ->
    browser-side AES-256-GCM, per-recipient key wrapping.
  - Retention & deletion (GDPR Art. 5(1)(e), Art. 17; legal-hold interplay) ->
    off-chain ciphertext deletion + on-chain metadata limitation (already in
    the GDPR limitations subsection; promote from limitation to design discussion).
  - Regulator access (e.g., SRA / bar audits) -> regulator org in consortium +
    ordering-node participation.
- **References to acquire**: EDRM model documentation, FRE 902(13)-(14) advisory
  notes on self-authenticating electronic records, ABA Formal Opinion 477R/483
  (lawyer cybersecurity duties), one EU e-evidence regulation source, and one
  practitioner source on legal DMS adoption (ILTA tech survey, already cited).
- Rename/expand Section "Operational Workflows" intro paragraph to tie each
  workflow to the scenario.

## 3. Evaluation depth (impact: HIGH — this is what IEEE rejected on; effort: 1-2 weeks)

What we already have (keep and cite in the response-to-reviewers narrative):
Exp 1 throughput/latency 50-600 clients; Exp 2 function-level latency incl.
Fabric-vs-PostgreSQL ACL check (n=100); Exp 3 file-size independence to 50 MB;
Exp 4 audit query cost; Exp 5 synthetic WAN latency; Exp 6 crypto primitive
benchmark; Exp 7 ledger history depth; Exp 8 BatchTimeout sensitivity (193 TPS);
Exp 9 fail-closed outage. That is nine experiments, but they share one topology.

What a BRA reviewer will ask for, in priority order:

1. **Standard-tool benchmark (Caliper)**: rerun the throughput/latency matrix
   with Hyperledger Caliper alongside the custom REST-gateway load generator, or
   justify explicitly why the gateway workload is the right instrument (we
   already argue application-path realism; add a Caliper run to anchor
   comparability with other papers' numbers). BRA papers routinely report
   Caliper. Effort: 2-3 days. Missing entirely today.
2. **Scalability with network size**: vary organizations/peers (2, 3, 5, 7 orgs;
   1-2 peers each) and endorsement policy (single-org vs majority). Today the
   topology is fixed at 3 orgs. This is the single biggest "depth" gap. Effort:
   3-4 days incl. automation.
3. **Scalability with document volume / ledger growth**: preload 10^4-10^6
   document records; measure CheckAccess and GetHistoryForKey latency vs world-
   state size, plus block-store disk growth per document. Exp 7 touches history
   depth (107 entries) but not world-state scale. Effort: 2 days.
4. **IPFS storage/retrieval cost analysis**: retrieval latency vs file size under
   concurrent load, replication factor cost (2-node vs 3-node pinning), storage
   overhead of ciphertext + CID metadata, and behavior when one IPFS node is
   down (complements Exp 9 which only kills Fabric). Exp 3 covers upload-path
   size independence only. Effort: 2-3 days.
5. **Baseline comparison**: at least one architectural baseline beyond the
   PostgreSQL-only ACL: (a) Fabric-as-passive-audit-log (the design we argue
   against) measured on the same workload — quantifies the price of on-path
   enforcement end-to-end, and (b) a numbers-level comparison table against
   reported TPS/latency of the closest published systems (from item 1), with the
   usual caveats about hardware. Effort: 2-3 days for (a), 1 day for (b).
6. **Statistical presentation**: keep the existing n/median/P50 discipline;
   add confidence intervals to the headline plots and a table consolidating all
   nine experiments' key numbers (reviewers of the IEEE version complained about
   depth; a consolidated evidence table counters the "thin evaluation" reading).
   Effort: 1 day.

## 4. Security treatment (impact: MEDIUM-HIGH, effort: 3-5 days)

The paper already has an operational threat model table (adversary classes,
defenses, residual risk) and a governance section — stronger than typical. To
meet "formal threat model" expectations at BRA:

- Restructure into: (i) trust assumptions per component (Fabric ordering CFT
  assumption, IPFS pinning honesty, PostgreSQL admin trust for identity table,
  browser/endpoint trust); (ii) adversary capability matrix (network, insider
  DB admin, malicious peer, colluding orderers, compromised client); (iii)
  attack scenarios traced to design elements (each scenario -> mitigating
  mechanism -> experiment or argument); (iv) explicitly out-of-scope attacks.
  Much of this text exists; the work is reorganization plus 3-4 new attack
  walk-throughs (key-substitution attack is already written in Limitations —
  promote it into the threat model).
- Add security *properties* stated precisely (e.g., "no ciphertext release
  without a ledger-evaluated grant, under assumption A1-A3") and argue each
  informally; full formal verification stays future work but state the property
  set now.
- Optional stretch: model the ECIES-style wrapping + grant protocol in Tamarin or
  ProVerif (effort: +1 week; medium impact — BRA does not require it, but it
  directly answers "insufficient technical depth").

## 5. Smaller wins (impact: MEDIUM, effort: hours each)

- **Abstract**: fix the broken sentence "Fabric-based add no statistically
  significant interactive delay" -> "Fabric-based access checks add no ..."
  (grammar bug carried over from the IEEE source; left untouched in the
  conversion because Phase 2 was format-only). Tighten to <= 200 words and end
  with the capability-delta sentence from item 1.
- **Keywords**: journal cap is 6 (IEEE version had 8; the conversion kept
  Blockchain, Hyperledger Fabric, Legal document management, Data integrity,
  Access control, Digital forensics). Consider swapping "Digital forensics" for
  "IPFS" — reviewers/readers search IPFS far more, and forensics is peripheral.
- **Figure quality**: several workflow diagrams embed em dashes and small fonts
  in the vector text (pages 15-16 of the compiled PDF); regenerate at some point
  for consistency with the no-em-dash style rule (text layer of figures is
  outside this conversion's scope). UI screenshots (PNG) should be checked
  against Elsevier's 300 dpi halftone guidance; indicate 1/1.5/2-column sizing
  per figure at submission.
- **References to repair** (flagged during conversion):
  - `macaroons2014` — missing pages (bibtex warning).
  - `zanzibar2019` — missing pages (bibtex warning).
  - `seoBlockchain2024` — bib comment says "verify final metadata"; confirm the
    ICTACS 2023 details and that the citation is still wanted (it was a
    reviewer-requested reference at IEEE; BRA reviewers did not request it).
  - Web references: BRA requires last-accessed dates for URL-only refs — audit
    the `note=`/`url` fields.
- **Data availability**: replace the placeholder with a real choice; BRA
  encourages repository deposit. Publishing the load-generator scripts +
  measurement CSVs (even without the full platform) materially helps the
  "evaluation depth" narrative. Effort: half a day; impact: medium-high for
  reviewer goodwill.
- **CRediT roles**: fill the skeleton in `bra_submission/main.tex` before
  submission (blocked on authors).
- **Highlights**: 5 draft bullets exist in `bra_submission/highlights.tex`;
  revisit wording after the abstract rewrite.
- **Graphical abstract (optional)**: a single-panel version of the architecture
  figure would satisfy BRA's "encouraged" graphical abstract at ~2 hours effort.

## Priority order (if time-boxed)

1. Evaluation depth items 3.1-3.3 (Caliper + network-size + volume scaling) — HIGH/1 week
2. Novelty recut + comparison table vs the 2026 BRA papers — HIGH/2-3 days
3. Legal scenario + workflow mapping section — HIGH/2-4 days
4. Threat-model restructure with stated properties — MED-HIGH/3-5 days
5. Abstract/keywords/reference repairs + data availability — MED/1 day total
