# Manuscript Handoff — BRA Resubmission (as of 2026-07-17)

> **2026-07-17 (later): fifth pass applied on branch `hardening-pass`** —
> layout repair (float pile-up: experiment figures were landing 20–43 pages
> from their references; topology figure was 2× page width), em-dash removal
> (31 prose sites), three raw-data-verified number corrections (66–70 TPS,
> denial rate ≈30/s, Exp 7 σ 6.4), Experiment-15 retitle, data-availability
> leak warning + Variant B3. See `CHANGELOG_review.md`, `RISKS.md`,
> `ACCEPTANCE_NOTES.md`. Build: 100 pp, 0 errors, 22 cosmetic overfulls,
> 1 documented bibtex warning. Compiled with local MiKTeX (+cm-super), not
> docker texlive; layout equivalent.

One-page map of every editing pass applied to `bra_submission/main.tex`
this week, for co-author review. Detail files are all at this repo root
on `bra-submission` unless noted. The full chronological campaign log
(`session-summary.md`) lives on the **prototype-fixes** branch.

## Current state

- **103 pages**, zero compile errors, no undefined/multiply-defined
  references, 23 overfull-hbox warnings (all cosmetic; the three large
  ones are pre-existing unbreakable `\texttt` lines), 1 documented
  bibtex warning.
- Compile: `cd bra_submission && docker run --rm -v "$PWD:/work" -w
  /work texlive/texlive:latest sh -c "pdflatex main; bibtex main;
  pdflatex main; pdflatex main"` (no local LaTeX; aux/log/pdf are
  committed build artifacts).
- The manuscript reports **fifteen experiments**; all figures are
  regenerated from released raw data with CIs; headline numbers:
  6.51 vs 7.16 ms P50 ACL check (n.s.), +6.5 ms end-to-end enforcement
  premium, 193 TPS @500 ms batch, 20 s outage recovery.

## The four editing passes (newest last)

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

## Open items for authors

- From the reviewer-lens pass (never ruled, low stakes): N3 (compress
  UI showcase to one paragraph + supplementary pointer), N5 (merge
  key-lifecycle figures 1–4; Phase 5 is the only non-duplicated one),
  optional "cross-organization" qualifier in the abstract's
  access-check sentence.
- Pre-existing, in `MANUSCRIPT_TODO.md`: CRediT roles (needs co-author
  sign-off), data-availability variant B1 (GitHub) vs B2 (Zenodo DOI),
  seoBlockchain2024 cite-or-delete, camera-ready re-check of the three
  pre-proof citations (RBAC-IPFS, Liu & Zheng, Notash) against versions
  of record.

## Commit trail (bra-submission)

dfc7e79/ddb4066/ee0aaae/3738c87/2661361 (writing campaign, items
1→0→4→2→5) → 406f306 (fig1–8 regeneration swap) → d5fbf37 (audit
findings) → cd37581 (F1–F8 + F10 record) → 759ee40 (R1–R8 sweep) →
0caac55 (V1–V3 + reviewer-lens findings) → 34fca0c (reviewer-lens main
wave) → 2fc2c01 (hierarchy figure restored).
