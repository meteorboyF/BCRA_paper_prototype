# Manuscript Coherence & Redundancy Audit — Findings (2026-07-17)

Full-manuscript audit (not diff-based) of `bra_submission/main.tex` at
commit 406f306. **No edits applied — awaiting author selection.**
Recommended action: apply F1–F8, skip F9, verify-then-fix F10.
Line numbers refer to main.tex at 406f306.

| # | Location (line) | Type | Finding | Suggested fix |
|---|---|---|---|---|
| F1 | fig6 vs prose 1242/2289/2869/3718 | Numeric mismatch | Regenerated fig6 bar label prints 100.59 ms (PBKDF2); text says 100.44 ms (4×). Cause: `statistics.median` in regen script vs original summary.json percentile convention. Same convention gap vs released consolidated_evidence.csv: 875 vs 867.45 (Exp 10), 8.60 vs 8.54 (Exp 12) — manuscript internally consistent, but lacks the median-convention footnote. | Regenerate fig6 with summary-convention P50 annotations (or state convention in caption); add the one-sentence median-convention footnote (already in `experiments/consolidated/RESULTS.md` on prototype-fixes) to `sec:exp_consolidated`. |
| F2 | 2587 (fig1 caption) | Broken ref intent | `Experiment~\ref{sec:exp_sensitivity}` renders the subsection number ("Experiment 6.8"), not "Experiment 8". | `Experiment~\hyperref[sec:exp_sensitivity]{8}` (house convention). |
| F3 | 610 | Superseded-claim flow | "none of the prior legal and evidence-management systems in Table X report evaluating…on the critical path" sits immediately before the subsection conceding RBAC-IPFS measures exactly that (table now has an ACL=Y row). Scoping saves it technically; reviewers will stumble. | Append "; the generic access-controlled storage line reviewed next narrows this gap" or change "in Table~X" to "reviewed above". |
| F4 | 668–676 vs 313–320 (also 529, 3629) | Redundancy | Gaps-close repeats the contributions disclaimer near-verbatim ("not a new access-control primitive, not a BFT ordering protocol…measured relocation of the boundary"). Intro/conclusion repetition fine; 529+668 in the same section is not. | Trim 668 version to one sentence pointing at Section contributions; keep 529. |
| F5 | 160, 323, ~648 (gaps), ~630 (rel-work close) | Redundancy | The "none reports measured fail-closed / enforcement premium" delta appears 4×; gaps sentence and related-work close are ~20 lines apart saying the same thing. | Shorten the gaps RBAC sentence to a pointer; keep the fuller subsection-close statement. |
| F6 | 258, 2324 | Terminology drift | Bare "FirmA, FirmB"; 16 other sites use LawFirmA/LawFirmB. | Rename both. |
| F7 | 2469 | Terminology vs artifact | `\texttt{legalchannel}` sole occurrence; code and other refs use `legal-channel`. | Fix to `legal-channel`. |
| F8 | 350 | Typography | `68-70\,TPS` hyphen vs `68--70` en dash elsewhere (2543/2556/2980/3695). | `68--70`. |
| F9 | 1417 | Cosmetic (optional) | Subsection still titled "Operational Threat Model" though intro announces the four-part restructure. | Optional retitle "Threat Model"; reviewer-neutral either way. |
| F10 | 2543–2546 | Unverified minor | "zero transaction errors up to 400 clients" — raw fabric rows show errors=0 through 600; claim understates (possibly old-regime caution). | Verify against `results/exp1_throughput.csv` (prototype-fixes) and say "across the measured range", or leave. |

## Verified clean (no action)

6.51/7.16 across all occurrences incl. 6.510/7.162 full-precision table and
Mann–Whitney U=4500, p=0.22 (consistent with CI-overlap claim); 193.0; 279;
16.7 (10×); 135.5; 51.2 %; 125 B (other "125" hits are the Core Ultra 125H
CPU); 1,340/2,013; Caliper 875/172; 0.024 %; "fifteen experiments" (5×, zero
stale "nine"); all three 20-second recovery statements; "fail-closed" (30×,
no drift); "two-layer" naming (only exception is Kim et al.'s own
"two-level" system name); Layer 1/Layer 2 usage; no surviving "15-second"
or plotted-projection references; cite spot-checks (caliper2021, thakur2024,
woznica2022) match intent.

## How to resume in a fresh session

1. This file + `MANUSCRIPT_TODO.md` (both at repo root, bra-submission) hold
   all pending manuscript work.
2. `session-summary.md` (repo root, prototype-fixes) is the full campaign
   log; `experiments/README.md` indexes every experiment's RESULTS.md.
3. Compile: `cd bra_submission && docker run --rm -v "$PWD:/work" -w /work
   texlive/texlive:latest sh -c "pdflatex …; bibtex main; pdflatex ×2"`
   (no local LaTeX; overfull baseline = 27).
4. F1's figure fix happens in
   `experiments/legacy_figures/regen_figs.py` on prototype-fixes, then
   copy the PDF over and recompile here.
