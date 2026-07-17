# RISKS — reviewer attack surface (BRA submission, 2026-07-17)

For each risk: the likely reviewer objection, where the paper is currently
exposed, and the minimum fix. Ordered by expected severity. This extends (and
where noted, supersedes) the earlier `REVIEWER_LENS_FINDINGS.md` §H synthesis;
items already fixed there are not repeated.

## R1. Novelty: "Fabric + IPFS document storage is a crowded pattern" — LARGELY DEFENDED, residual exposure

**Objection.** "Dozens of Fabric+IPFS document/evidence systems exist,
including two 2026 papers in this very journal. What is new?"

**Current state.** This is no longer the desk-reject risk it was at IEEE
Access. The paper now (a) has a 13-row capability comparison
(`tab:literature_review`) including the closest 2026 BRA systems (RBAC-IPFS,
zero-trust delegation, NFT-evidence, adaptive e-health), (b) states the delta
in one breath in the abstract and contributions ("none reports measured
fail-closed behavior under ledger outage or the end-to-end premium of on-path
enforcement over the audit-log architecture it replaces"), and (c) backs the
delta with Experiments 9 and 14 plus a numbers-level positioning table
(`tab:numbers_comparison`).

**Residual exposure.**
1. The RBAC-IPFS row concedes prior on-path authorization *with measurement*
   (146–156 ms e2e) — the novelty rests on the *remaining* unmeasured pair
   (outage behavior + enforcement premium vs. an architectural baseline) plus
   the legal-domain mechanisms. A reviewer hostile to "measurement-scope
   novelty" can still push. The RBAC-IPFS numbers cited are from an
   uncorrected proof (already flagged in `MANUSCRIPT_TODO.md`).
2. A reviewer may be an author of one of the compared 2026 systems; any
   mischaracterized cell is dangerous. Cells were set from the authors' PDF
   verification pass (`experiments/comparison/COMPARISON_TABLE.md`), which is
   good, but re-verify at camera-ready.

**Minimum fix.** None required for submission. Recommended: one sentence in
the Contributions naming the two-part delta as the *pairing* ("no prior
system, including RBAC-IPFS, has both"), and camera-ready re-check of the
pre-proof rows.

## R2. Immutability vs. erasure (GDPR / legal retention) — ADDRESSED, keep intact

**Objection.** "A legal-records system on an immutable ledger violates the
right to erasure / retention-destruction duties."

**Current state.** The design stores only hashes/CIDs/timestamps on-chain
with erasable off-chain ciphertext (unpin + GC); §"GDPR and Regulatory
Compliance" concedes the pseudonymization problem for on-chain hashes with
EDPB/Finck citations, treats the ledger as "evidentiary rather than
dispositive", discusses redactable-chameleon-hash directions, and the
legal-mapping table has a dedicated retention/erasure row. This is stronger
than typical BRA submissions.

**Residual exposure.** The abstract/intro do not mention erasure at all — a
GDPR-minded reviewer meets the design decomposition only in §7. Minimum fix
(optional): half a sentence in the introduction's architecture paragraph
("only hashes and content identifiers are anchored on-chain; ciphertext
remains erasable off-chain"), pointing to §7. Do not claim GDPR compliance
anywhere — the current "partially resolves / deployment-specific legal basis"
framing is the right level.

## R3. Proprietary AI (GPT-4o) dependency — RESOLVED BY OMISSION, but guard the artifact link

**Objection.** "Reproducibility/confidentiality of sending legal text to a
closed third-party model."

**Current state.** The manuscript contains **zero** mention of the prototype
repo's OpenAI GPT-4o layer; no claim depends on it. Correct call for a
blockchain venue: the AI layer is auxiliary and unevaluated.

**Residual exposure.** The active Data-availability variant links the public
repo, which *does* contain the GPT-4o integration, the "PangoChain" name, and
hackathon-era docs. A reviewer who clicks through meets (a) a system name the
paper never uses, (b) an AI feature the paper never discloses, and (c) a
hackathon provenance framing. This is the single most likely way R3 (and
name-consistency questions) enters review.

**Minimum fix (author decision, flagged in the .tex).** Before submission:
mirror the measurement artifacts (`results/`, `experiments/`, generators,
scripts) into a neutral-named, curated repository or Zenodo deposit (Variant
B2), excluding the AI demo layer, or activate Variant B3
("available on reasonable request"). Do not link the hackathon repo as-is.

## R4. Evaluation rigor — STRONG (this is what IEEE rejected on; now the paper's best asset), residual: testbed realism

**Current state.** Fifteen experiments: baseline comparison (Exp 14
architectural baseline + PostgreSQL references), scalability in network size
(Exp 13: 2–7 orgs × endorsement policy), document volume (Exp 12: 10⁶ docs),
concurrent load (Exp 1/8/11), standard instrument (Caliper, Exp 11), IPFS
storage/retrieval/replication/failure (Exp 10), repeated runs with 95 % CIs
throughout and a 37-metric consolidated table. Honest-reporting notes (outlier
rerun, @Async defect disclosure) are unusually good.

**Residual exposure, in likely order of attack:**
1. **Single 8 GB host, generator co-located** — disclosed (evaluation setup +
   Exp 13 "ratios not absolutes"), but a reviewer can still ask for one
   multi-host datapoint. Minimum fix: none for submission; a one-run
   two-host validation would neutralize it entirely (see ACCEPTANCE_NOTES).
2. **Custodial MSP identity in all measurements** — disclosed ~7 times;
   a reviewer may argue per-user X.509 would change the latency picture.
   Minimum fix: one sentence noting the added cost path (client-side signing,
   no extra ordering round-trip) is bounded by Exp 6's sub-ms signing.
3. **M1 auxiliary numbers not in the released artifact** (2,147 ms; Table 8
   column) — either add the raw CSV or keep clearly labeled auxiliary.
4. The 16.7 TPS workload model is synthetic — repeatedly and properly
   hedged; no further action.

## R5. Threat model — ADDRESSED (assumptions A1–A6, properties P1–P4, scenarios S1–S4, explicit out-of-scope)

**Residual exposure.** No machine-checked verification; the paper says so and
fixes the property set as the target (right call). CFT-not-BFT is disclosed
with the SmartBFT path. A formalist reviewer may still ask for a
ProVerif/Tamarin model of the wrapping+grant protocol — the paper's "future
work with a fixed property set" framing is the accepted answer at BRA level.
Minimum fix: none.

## R6. Key management and IPFS availability — ACKNOWLEDGED

Key loss = data loss is stated (localStorage clearing "is permanent without a
backup procedure"); Phase-5 escrow design is explicitly marked unimplemented;
the 2-node application swarm's availability limits are disclosed and the
3-node bench (Exp 10) measures replica-failure behavior, including
total-loss clean timeouts. The S3 public-key-substitution residual risk is
promoted into the threat model with a mitigation path. Minimum fix: none;
this is now a strength.

## R7. Legal claims — MOSTLY GROUNDED; two spots to watch

**Current state.** Court-admissibility material is citation-anchored (FRE
901/902(13)–(14), FRCP 26/34/26(b)(5)(B), ABA Rule 1.6 + Opinions 477R/483,
EDRM, EU e-evidence Reg. 2023/1543) and framed as "materially supported" /
"design goal", not as legal fact. The legal-mapping table routes each duty to
a mechanism and an experiment.

**Watch:**
1. §Scenario: "the ledger supplies **precisely** the process record and
   'digital identification' those rules contemplate" — the strongest legal
   sentence in the paper. If a law-savvy reviewer pushes, soften "precisely"
   to "a candidate for". Left unchanged (author's voice); flag only.
2. No statement anywhere claims the system *is* court-admissible — keep it
   that way in any revision.

## R8. Presentation risks fixed in this pass (for the record)

- Float catastrophe (all experiment figures 20–43 pages from their text) —
  fixed; see CHANGELOG §1. This alone read as "carelessly prepared".
- "68–70 TPS" contradicted the paper's own Fig. 16 and consolidated table —
  fixed to the measured 66–70/62–70 split.
- Denial-rate range and Exp 7 σ corrected to raw data.
- "fifteen experiments" vs. 14 numbered subsections — consolidated section
  now titled Experiment 15 (author may veto; see CHANGELOG F5).

## Top five (if you only read this far)

1. **R3/artifact leak**: do not submit with the hackathon repo URL active in
   Data availability — rename/mirror or switch to Variant B2/B3.
2. **R1 residual**: camera-ready re-verification of the RBAC-IPFS pre-proof
   row; keep the "no prior system has the pairing" line sharp.
3. **R4.1**: single-host co-located testbed — pre-empted in text; one
   two-host run would close it completely.
4. **CRediT skeleton is empty** — submission with `[roles]` placeholders is
   an automatic desk bounce; needs co-author sign-off (author-owned TODO).
5. **R2 abstract-level visibility** of the erasure decomposition — optional
   half-sentence in the introduction.
