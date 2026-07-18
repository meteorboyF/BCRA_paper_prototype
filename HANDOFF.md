# Manuscript Handoff — BRA Resubmission (as of 2026-07-18)

> **Numbering note (2026-07-18):** the hardening pass on branch
> `hardening-pass` (layout repair: float pile-up fixed, experiment figures
> were landing 20–43 pages from their references; topology figure 2× page
> width; em-dash removal, 31 prose sites; raw-data-verified number
> corrections: 66–70 TPS, denial rate ≈30/s, Exp 7 σ 6.4; Experiment-15
> retitle; CRediT filled; data-availability leak warning + Variant B3;
> details in `CHANGELOG_review.md`, `RISKS.md`, `ACCEPTANCE_NOTES.md`) is
> **pass 5** below. The two Linux-side passes are 6 and 7. All three are
> merged on `hardening-pass` as of 2026-07-18; regenerated title-free
> fig1–fig10 swapped in from `linux-validation`.

One-page map of every editing pass applied to `bra_submission/main.tex`
this week, for co-author review. Detail files are all at this repo root
on `bra-submission` unless noted. The full chronological campaign log
(`session-summary.md`) lives on the **prototype-fixes** branch.

## Current state

- **102 pages** (merged state: all seven passes), zero compile errors,
  no undefined/multiply-defined references, 22 overfull-hbox warnings
  (all cosmetic, max 72 pt), 1 documented bibtex warning
  (`macaroons2014`, NDSS unpaginated).
- Compile: pdflatex + bibtex + pdflatex ×2. Works with docker
  texlive (`docker run --rm -v "$PWD:/work" -w /work
  texlive/texlive:latest ...`) or local MiKTeX with `cm-super`
  installed; aux/log/pdf are committed build artifacts.
- Figures: fig1–fig10 are the title-free regenerations from
  `linux-validation` (annotation-identical; fig10's replication panel
  is the n=20 rerun, 50 MB crossover resolved).
- The manuscript reports **fifteen experiments**; all figures are
  regenerated from released raw data with CIs; headline numbers:
  6.51 vs 7.16 ms P50 ACL check (n.s.), +6.5 ms end-to-end enforcement
  premium, 193 TPS @500 ms batch, 20 s outage recovery — now backed by
  a cross-host validation showing the co-located throughput numbers
  were conservative (pass 5 below).

## The seven passes (newest last)

### 1. Coherence audit F1–F10 (commit cd37581) — `AUDIT_FINDINGS.md`

Full-manuscript numeric/terminology audit. Applied F1–F8: median-
convention footnote (F1), fig1 caption cross-ref rendering (F2), three
redundancy trims in related work/gaps (F3–F5, author-reviewed diffs),
LawFirmA/B naming (F6), `legal-channel` (F7), en dash (F8). F9 skipped.
**F10 was an audit false positive** — raw CSV verification showed the
existing "zero errors up to 400 clients" claim was already correct;
lesson recorded: recompute flagged numeric claims from raw CSVs before
editing.

### 2. Draft-history sweep R1–R8 (commit 759ee40) — *no dedicated md; recorded here*

Removed all reader-facing language that only made sense against the
paper's edit history:

- fig7/`GetHistoryForKey` caption rewritten standalone (was describing
  what "earlier versions displayed" and what is "now omitted").
- fig5/WAN caption: deleted "Supersedes the earlier 0 ms-only baselines
  from the pre-tuning measurement regime."
- The word "(regenerated)" removed from 8 figure captions and the
  median-convention footnote ("computed from the released raw data"
  where provenance mattered, dropped elsewhere).
- Four editorial "now"s removed (threat-model table, WAN prose, Exp 14
  discussion, consolidated section).
- Reviewed and deliberately kept: "formerly authorized user" (S1
  semantics), the Exp 14 `@Async` defect disclosure, Phase-4
  "replaced by" (migration roadmap).

### 3. Reviewer-lens factual fixes V1–V3 (commit 0caac55) — `REVIEWER_LENS_FINDINGS.md` §A

- V1: Conclusion said "nine-experiment evaluation" → "fifteen-".
- V2: deleted "resolving the baseline inconsistency **cited in prior
  review**" (leaked the rejection history).
- V3: `16.7,TPS` typo.

### 4. Reviewer-lens main wave (commits 34fca0c, 2fc2c01) — `REVIEWER_LENS_FINDINGS.md` + `REVIEWER_LENS_CHANGES.md`

Full reviewer-simulation critique (~40 findings), author-ruled, applied
in one commit. Headlines:

- **Cuts** (~5 pages): workflow-demo subsection (two sequence diagrams
  + activity diagram — all three flows already diagrammed in Section 3;
  the one unique fact rehomed to Prototype Scope), the security-claims
  sketch table (row-by-row repeat of the threat-model table), the
  SmartBFT migration paragraph, duplicate baseline paragraph.
- **Deduplication of repeated caveats**: custodial-identity 13→7
  sites, SmartBFT/CFT 11→6, "other paths not outage-tested" 6→2,
  "not a formal proof" 5→2 — each caveat still stated where it is
  load-bearing (Prototype Scope, threat model, limitations).
- **Clarity rewrites**: topology OrdererOrg-CA paragraph fact-first,
  consensus paragraph split, RQ1 discussion restatement aligned with
  the intro's RQ1, tautological outage sentences, GDPR section merged,
  circular conclusion sentence.
- **Two reviewer-preemption additions**: load-generator co-location
  note (evaluation setup) and the 6.51 ms-P50-vs-20 ms-Caliper-average
  reconciliation (Exp 11).
- **Reverted by author decision**: N1 — the role-hierarchy figure
  (`Hierarchy.pdf`) was cut, then restored (2fc2c01).
- Side effect: `fabricSdkNode_wallet` no longer cited (its only
  citation was in a deleted sentence).

`REVIEWER_LENS_CHANGES.md` has the complete per-ID before/after record.

### 5. Hardening pass (branch `hardening-pass`, commits 3223fad/421c8dc, 2026-07-17/18)

Layout, typography, and evidence-consistency repair; see the numbering
note at the top of this file and `CHANGELOG_review.md` for the full
per-edit record. Also produced `RISKS.md` (reviewer attack surface) and
`ACCEPTANCE_NOTES.md` (forward plan).

### 6. Two-host validation added to the paper (commit 52aa4a5, 2026-07-18)

New measurement, not just editing. All published throughput was
measured with the load generator co-located on the 8 GB evaluation
host — a reviewer could argue co-location distorted the numbers. We
reran both reference configurations with the generator on a second
physical machine (VivoBook i5-1035G1) over campus Wi-Fi:

| Config | Cross-host [95 % CI] | Published co-located [95 % CI] |
|---|---|---|
| 500 ms BatchTimeout, n=10 | **228.0 [222.7, 233.3]** | 193.0 [182.8, 203.2] |
| 2 s BatchTimeout, n=5 | **70.5 [67.8, 73.2]** | 66.3 [63.7, 68.9] |

Both cross-host means sit **above** the published CIs: co-location
*depressed* the published numbers, so they stand as conservative. The
manuscript now states this in the evaluation setup (one paragraph,
with the Wi-Fi caveat), and Data Availability points to branch
`linux-validation` for the raw trial data. Full report:
`experiments/twohost_validation/RESULTS.md` on that branch (includes
environments, ping-RTT records, and one clearly-labeled aborted run).

### 7. Owner-org fallback precision + timestamp rationale (commit cb35ce5, 2026-07-18)

A reviewer-lens assessment flagged that the paper's intra-organization
limitation ("any member of LawFirmA can access any document…")
overstated the exposure **against our own code**. Verified in the
implementation: the `OwnerOrg` fallback governs only the ledger-side
authorization decision; the wrapped-key endpoint releases a document
key solely against the requester's own per-recipient grant entry,
`k_enc` is never wrapped for ungranted principals, and document
listings are scoped to explicit grants. So an ungranted colleague can
obtain at most **ciphertext, metadata, and document existence — never
a key or plaintext**. Seven sites now state this precisely (ACL
architecture, threat-model cell, framework-vs-prototype row +
footnote, limitations bullet, Discussion RQ1 boundary), with severity
recalibrated to least-privilege violation + harvest-now-decrypt-later
surface. The ECDSA section also gained a reasoned note on why
timestamp binding is deferred: a client-signed clock binds only
*claimed* time; trusted time is the transaction timestamp, which
cannot be signed pre-submission (same circular dependency as the CID).

**Deliberate decision, on record:** the two candidate *code* changes —
closing the fallback in chaincode and binding owner/filename into the
signed payload — were scoped and **deferred to the revision round**.
Rationale: no experiment ever executed the fallback branch (the bench
user owns its document, authorizing via the seeded owner grant), so
changing the chaincode now would buy zero new evidence while breaking
the "benchmarks the deployed chaincode" provenance of Exps 11–14.
Both make strong response-to-reviewers artifacts if asked for.

## Open items for authors

- N5 (key-lifecycle figures 1–4): the composite route was attempted on
  `linux-validation` and **failed legibility** (2×2 illegible at column
  width; 1×4 legible but ≈2.4 pages tall — verdicts in
  `deliverables_for_manuscript/FIGURES_NOTE.md`). Remaining options:
  keep the five separate figures (current state), or redraw Phases 1–4
  with larger base fonts. RESOLVED as "keep" unless authors redraw.
- Resolved since the last version of this list: N3 (UI showcase already
  one paragraph + supplementary pointer), abstract cross-organization
  qualifier (added), CRediT roles (filled per corresponding author),
  seoBlockchain2024 (removed, uncited).
- Still pending: data-availability variant B1 (GitHub, name-leak
  warning applies) vs B2 (Zenodo DOI) vs B3 (on request) — author
  decision at the very end; camera-ready re-check of the three
  pre-proof citations (RBAC-IPFS, Liu & Zheng, Notash) against versions
  of record; Apple M1 auxiliary raw data (add to artifact or keep
  labeled auxiliary).
- Revision-round candidates (scoped, deliberately deferred — see pass
  7): close the owner-org fallback in chaincode; bind owner/filename
  into the signed payload. Also: the four flow/topology diagrams
  (`fabric_topology4` still shows FirmA/FirmB + `lawchain.com` labels)
  have **no editable source in the repo** — fixing them needs whoever
  holds the original drawing files.

## Commit trail (bra-submission)

dfc7e79/ddb4066/ee0aaae/3738c87/2661361 (writing campaign, items
1→0→4→2→5) → 406f306 (fig1–8 regeneration swap) → d5fbf37 (audit
findings) → cd37581 (F1–F8 + F10 record) → 759ee40 (R1–R8 sweep) →
0caac55 (V1–V3 + reviewer-lens findings) → 34fca0c (reviewer-lens main
wave) → 2fc2c01 (hierarchy figure restored) → 2cfc938 (this file) →
52aa4a5 (two-host validation in evaluation setup + data availability)
→ cb35ce5 (owner-org fallback precision + timestamp rationale; page
baseline 103→104, overfull 23).
