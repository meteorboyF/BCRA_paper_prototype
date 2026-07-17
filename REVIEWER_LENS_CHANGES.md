# Reviewer-Lens Pass — Applied Changes Record (2026-07-17)

Companion to `REVIEWER_LENS_FINDINGS.md`. Every edit applied to
`bra_submission/main.tex` in resolving the reviewer-lens findings,
recorded per ID. Wave 1 (V1–V3) landed in commit 0caac55; everything
below it landed together in the wave-2 commit. Locations are
descriptive (section/anchor), since line numbers shifted throughout.

Net effect of wave 2: 108 → 103 pages, overfull 26 → 23,
−~290 source lines, zero undefined/multiply-defined references,
1 pre-existing documented bibtex warning unchanged.

## Wave 1 — factual fixes (commit 0caac55)

- **V1** (Conclusion): "nine-experiment evaluation" → "fifteen-experiment
  evaluation" (contradicted the four "fifteen experiments" statements).
- **V2** (Exp 2 intro): deleted "and resolving the baseline
  inconsistency cited in prior review" (draft-history leak).
- **V3** (WAN limitations): `16.7,TPS` → `16.7\,TPS`.

## Wave 2 — approved set + batches A–F

### Cuts (whole blocks removed)

- **N1**: Fig. "Hierarchy.pdf" role-hierarchy org chart + its intro
  reference clause ("as illustrated in Fig.~X") — referenced once,
  generic content.
- **N2**: subsection "Demonstration of Core System Workflows" (3
  sequence/activity figures + prose, ~57 lines; all flows already
  diagrammed in Section 3). Rehomed its one non-duplicated fact into
  Prototype Scope: "The upload path's parallel IPFS-storage and
  ledger-anchoring fork/join thread model is a framework-design detail
  not independently validated in the experiment campaign."
- **N4**: table `tab:security_claims` ("compact security argument
  sketch", 38 lines — row-by-row repeat of `tab:threat_model`) + its
  summary sentence; the S3 trace now cites Table threat_model only.
- **R1** (=H3): the "SmartBFT migration boundary" paragraph (v3.0 /
  V3_0 capability / 3f+1 sizing / no-throughput-projection); the
  consensus-section repeat sentence ("It does not provide
  Byzantine-fault tolerance…"); limitations CFT-vs-BFT subsection
  compressed from 13 lines to 2 sentences pointing at the out-of-scope
  analysis. SmartBFT treatment now lives in the threat model + table
  rows only.
- **H4**: the standalone "To evaluate operational viability, we
  establish a synthetic steady-state baseline 1000/60 ≈ 16.7 TPS…"
  paragraph in Exp 1 (its content merged into the W1 rewrite).
- **H5**: three of five "not a formal proof / no new reduction"
  statements — the crypto-section repeat at the standard-assumptions
  paragraph, and the first + last sentences of the "Cryptographic
  security properties" paragraph. Kept: crypto §3.3 composition
  disclaimer, threat-table caption.
- **R2** (=H2) custodial-identity trims (kept: Prototype Scope, P4,
  framework-vs-prototype table, legacy-integration (b), future work,
  Discussion boundary):
  - Registration: "…rather than per-user Fabric certificates; per-user
    X.509 enrollment is the production path" → "(custodial-identity
    caveat, Section 5.1)".
  - Upload: "Fabric transaction-level non-repudiation also remains
    custodial because…" → "Transaction-level attribution remains
    custodial (Section 5.1)."
  - Crypto layer: "…should therefore be interpreted separately
    because…" → "…are therefore distinct (custodial-identity caveat,
    Section 5.1)."
  - Key-management recap: 6-line "Two prototype limitations remain…"
    → one sentence pointing at the table (citations preserved).
  - Security-arch intro: "…but still includes server-managed Fabric
    MSP credentials and localStorage-based signing keys as residual
    prototype limitations" → "…; its residual key-custody limitations
    are cataloged in Section 5.1."
  - Tech stack: custodial-wallet sentence deleted outright
    (drops sole cite of fabricSdkNode_wallet from the bibliography).
- **R3** (=H1) "other paths fail-closed by design but not
  independently outage-tested" — deleted the identical sentence at the
  workflows, ACL, and threat-model sites; Discussion version → "The
  remaining Fabric-gateway paths share the same fail-closed design
  (Section 7)." Kept: the intro's first scoping and the full
  limitations treatment.
- **N6**: "These figures do not prove that audit logs were altered.
  They do, however, motivate…" → "These figures motivate…".
- **R4** (Exp 2): merged the double-stated significance conclusion into
  one sentence ("The 0.65 ms median difference is well within HTTP
  round-trip noise and meets the RQ2 50 ms read-overhead threshold…").
- **R5** (Exp 2): dropped the second no-PG-write-baseline
  justification; the sentence now ends at "(2,084 ms P50 vs. the 5 s
  threshold)."
- **R7** (Limitations): "Identity Database Public Key Integrity" body
  compressed from ~15 lines (full S3 retelling) to 3 lines pointing at
  Scenario S3.
- **R8** (Discussion opening): deleted the third full "not a new
  access-control primitive / not BFT / not production-ready" telling;
  contributions + conclusion keep the pair.

### Rewrites

- **C1** (evaluation intro): "along the axes reviewers of
  permissioned-blockchain systems most often probe" → "along axes the
  core campaign leaves open".
- **C2 + H7** (Discussion): RQ1 restatement aligned with the
  Introduction's RQ1 wording; "The answer is affirmative within the
  evaluated scope. … This result has two important boundaries." →
  "The answer is affirmative, with two boundaries."
- **C3** (S3): "This scenario is promoted from the
  prototype-limitations discussion because it is the sharpest residual
  risk." → "This is the sharpest residual risk in the prototype."
- **W1** (Exp 1): 55-word results sentence split; zero-error claim now
  attaches to the gateway, and the baseline is cited as "the 16.7 TPS
  baseline of RQ3".
- **W2** (Topology): OrdererOrg-CA paragraph rewritten fact-first —
  shared-CA simplification stated once, production requirement stated
  once (~8 lines saved; conditional-voice sentences removed).
- **W3** (Consensus): split into three paragraphs (config/CFT ·
  governance · validation+endorsement); the CA caveat deduplicated to
  a parenthetical pointing at the topology section.
- **W4** (×3): "This prevents new document releases through the
  evaluated path during the tested Fabric outage" (intro, workflows,
  ACL variants) → "During Fabric unavailability, no new documents are
  released through this path" (+ each site's bypass clause preserved).
- **W5** (Conclusion): "The negligible read overhead… confirms…
  negligible interactive overhead" → "The measured read overhead
  (6.51 vs. 7.16 ms P50, n=100) confirms that this architectural
  choice imposes no practical interactive cost."
- **W6**: Layer-2 access-control paragraph split before the MVCC /
  eventual-consistency half (text unchanged).
- **W7** (Lit review): 60-word Alkhatib sentence split at "…open
  deployment challenges."
- **W8** (Exp 4): methods paragraph split before the seeding sentence;
  colon-chained "a computational lower bound" → new sentence.
- **R6** (Chaincode design): CheckAccess item now points at Listing 4
  for the MVCC detail; CleanExpiredTokens item → "asynchronous
  world-state cleanup of expired grants; eventual-consistency model in
  Section 3.4" (kept the concurrent-write-back caveat).
- **D1** (Exp 9): single ~200-word paragraph split into
  setup/results/denials.
- **D2** (GDPR): paragraphs 2–3 merged; pseudonymization caveat stated
  once; double-listing of residual metadata removed; 60-word final
  sentence of the closing paragraph split ("; this risk assessment is
  consistent with EDPB guidance…").
- **D3** (IPFS timeout): paragraph split before the Exp 9 scope caveat
  (caveat text kept — it is the designated load-bearing site).
- **H6**: dropped "deliberately" in "(stated in text, not plotted)"
  and "are not hardware-normalized".

### Additions (reviewer pre-emption, section H #4/#5)

- Evaluation setup: "The load generator ran co-located with the
  network containers on the single evaluation host; generator CPU was
  recorded to detect client-side saturation and remained far below it
  in the sensitivity runs (2–14 %, Experiment 8)."
- Exp 11: "The 20 ms Caliper average and Experiment 2's 6.51 ms P50
  measure different regimes — 600 concurrent in-flight transactions on
  the direct peer-gateway path versus a single sequential client
  through the REST gateway — and are complementary rather than
  conflicting."

## Not applied (still open)

- **N3** (compress UI showcase to one paragraph + supplementary
  pointer), **N5** (merge key-lifecycle figures 1–4, keep design-only
  Phase 5), and the optional "cross-organization" qualifier in the
  abstract's access-check sentence (synthesis #6). None were ruled on.

## Verification

Docker texlive full cycle (pdflatex ×3 + bibtex): 103 pages, zero
errors, no undefined or multiply-defined references, overfull 23 — all
three surviving large overfulls (72.5/67.2/67.0 pt) are pre-existing at
identical widths in the 759ee40 baseline log (long `\texttt` API paths
and `window.crypto.getRandomValues`), not introduced by this pass.
