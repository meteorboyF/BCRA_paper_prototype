# CHANGELOG — Hardening pass (branch `hardening-pass`, 2026-07-17)

---

## Addendum 2026-07-18 — author-ruled items A1/A4 and rewrites B5–B11

Author decisions applied this session (build after: 100 pp, 0 errors,
0 undefined refs, 22 cosmetic overfulls, 1 documented bibtex warning):

- **A1 — CRediT filled** per the corresponding author's role assignment
  (Fardeen: Conceptualization/Methodology/Software/Investigation/Writing –
  original draft; Angkon: Methodology/Software/Visualization/Writing –
  original draft/review \& editing; Anwar: Software/Validation/Formal
  analysis/Writing – review \& editing; Mizi: Software/Resources/
  Visualization; Rahman: Resources/Validation; Islam: Supervision/Funding
  acquisition). TODO comments removed. Roles ordered per CRediT taxonomy
  within each author.
- **A4 — `seoBlockchain2024` deleted** from references.bib (uncited;
  author ruled "if it's no use, remove").
- **B5** — one sentence added to Prototype Scope: per-user X.509 would add
  a sub-millisecond client-side signing step (Exp 6) and no extra
  endorsement/ordering round trips, so custodial submission does not
  flatter the latency results.
- **B6** — Introduction (§1.2): half-sentence noting the erasable-off-chain
  / fixed-size-on-chain decomposition, pointing to §\ref{sec:gdpr}.
- **B7** — Contributions delta sharpened: "no prior Fabric-and-IPFS document
  system, **including RBAC-IPFS**, reports measured fail-closed behavior…,
  **and none** quantifies the end-to-end premium…".
- **B8** — Scenario: "supplies **precisely** the process record… those rules
  contemplate" softened to "supplies **a** process record… **of the kind**
  those rules contemplate".
- **B9** — Abstract: added "(per-user enforcement is demonstrated for
  cross-organization access)" to the access-check sentence (closes
  reviewer-lens synthesis item 6). Abstract ≈220 words, within norms.
- **B10** — `hernando2025wills` (BRA digital-wills paper) now cited in
  §2.3.1 as an applied legal-domain integrity/custody deployment.
- **B11 — reference repairs (all web-verified, nothing invented):**
  `lone2019forensic` upgraded from a 2017 preliminary-venue entry to the
  version of record (Lone \& Mir, Digital Investigation 28 (2019) 44–55,
  DOI 10.1016/j.diin.2019.01.002 — also matches the key's year and the
  Hyperledger context); `hu2014guide` converted from a garbled @article
  ("pages 162-800") to a proper NIST SP 800-162 @techreport with DOI
  10.6028/NIST.SP.800-162; `groth2016` DOI 10.1007/978-3-662-49896-5_11
  added. Pruning of the remaining ~36 uncited entries deferred to
  camera-ready (harmless under elsarticle-num).

Still pending (author): A2 data-availability variant (at the very last),
A3 Experiment-15 retitle verdict, C16 M1 raw data. Linux tasks C12–C15
handed off via `LINUX_EXPERIMENTS_PROMPT.md` (kept outside the repo).

---

## Addendum 2026-07-18 (later) — merge of the Linux-side work

The Linux sessions completed C12–C15 on `linux-validation` and, beyond
scope, applied two manuscript passes directly on `bra-submission`
(52aa4a5 two-host results in evaluation setup + data availability;
cb35ce5 owner-org fallback precision, code-verified). That line diverged
from `hardening-pass`; this session merged `bra-submission` into
`hardening-pass` (main.tex auto-merged; artifact conflicts rebuilt) and
then:

- **Figures swapped in** from `linux-validation` deliverables: fig1–fig9
  title-free regenerations (verified annotation-identical by the
  producing session, spot-checked here: fig1 title gone, fig6 100.59 ms
  intact) and fig10 with the n=20 replication panel (50 MB crossover
  resolved).
- **Em dashes**: the two Linux passes introduced 6 new rendered em
  dashes; all replaced (comma/colon/parentheses). Grep for `—` and
  prose ` --- ` in main.tex: 0.
- **Codename hygiene**: reworded the data-availability WARNING comment
  to avoid the codename literal; main.tex + references.bib now grep
  clean (case-insensitive), matching the deliverables discipline.
- **HANDOFF.md** renumbered to seven passes (hardening = 5, two-host =
  6, owner-org = 7), current-state block updated (102 pp, 22 overfulls),
  open-items list refreshed (N3/N5/qualifier/CRediT/seoBlockchain2024
  resolved; N5 composite route failed legibility — keeping the five
  separate figures unless authors redraw with larger fonts).
- **Two-host framing**: session A's paragraph already matches the agreed
  framing (conservative co-located baseline + Wi-Fi caveat); left as
  written apart from the em-dash fix. Table 8 footnote judged
  unnecessary since the client hardware is stated inline.
- Build after merge: **102 pages, 0 errors, 0 undefined refs,
  22 cosmetic overfulls, 0 "??", 1 documented bibtex warning.** Float
  audit: no float further than 2 pages from its first reference except
  the two intentional Introduction forward-references
  (tab:framework_vs_prototype, fig:failclosed) and the key-lifecycle
  stack (d=6, inherent to five stacked figures; N5 resolved as keep).

Every change made to `bra_submission/` in this pass, grouped by type, so each
edit can be reviewed and reverted individually. Baseline = the authors' local
copy of 2026-07-17 (verified byte-identical in source content to branch
`bra-submission` tip `2cfc938`; only build artifacts differed). Build after
all edits: **100 pages, 0 errors, 0 undefined/multiply-defined references,
0 "??" in the PDF, 22 overfull hboxes (all cosmetic, max 72 pt; was 23 with a
390 pt one), 1 documented bibtex warning (`macaroons2014`, NDSS unpaginated).**

Note on toolchain: this pass compiled with local MiKTeX (pdflatex + bibtex,
with `cm-super` installed to satisfy microtype font expansion) instead of the
docker texlive image used previously. Same source, same page-level layout
behavior; the committed PDF is byte-different but visually equivalent.

---

## 1. Formatting / layout (Phase 2)

These fix a real, reviewer-visible defect: in the pre-pass build, **every
figure from Fig. 13 (rbac_acl_pipeline) through Fig. 29 (baseline) was dumped
on pages 74–83, i.e. 20–43 pages after its first text reference**, because
one unplaceable float blocked the queue. Verified in the committed build's
own `main.aux` (e.g. `fig:scalability` on p. 76 while Experiment 1's text is
on p. 52).

| # | Change | Why |
|---|---|---|
| F1 | `\usepackage{placeins}` → `\usepackage[section]{placeins}` | Floats no longer drift across section boundaries. |
| F2 | `fig:fabric_topology`: `width=2\columnwidth` → `width=\textwidth` | IEEE two-column leftover; produced the 390 pt overfull hbox (image ~13.7 cm wider than the page). |
| F3 | `fig:access_and_decryption`: `[!t]` → `[!tp]`, added `height=0.55\textheight,keepaspectratio` | This portrait diagram (aspect 1.31) could never satisfy `[!t]` at 0.95\columnwidth (~583 pt tall), so it — and every float after it, in order — deferred to the pre-Discussion FloatBarrier. This was the root cause of the pile-up. |
| F4 | Moved the `fig:rbac_hierarchy` figure block from the end of the Introduction to directly after its only reference; `[H]` → `[!htb]`; removed the now-redundant `\FloatBarrier` | Was landing 4 pages after its reference. |
| F5 | Retitled subsection "Consolidated Evidence…" → "Experiment 15: Consolidated Evidence…" | The paper says "fifteen experiments" but only 14 subsections carried experiment numbers; the repo's own `experiments/consolidated/RESULTS.md` is titled "Experiment 15". Aligns the visible count with the claim. **Author may veto** if they prefer not to call the consolidation an experiment — in that case change the five "fifteen(-)experiment" claims to "fourteen experiments plus a consolidated statistical analysis". |

Result: pages 103 → 100; floats more than one page from their first reference
went from **20 → 7**, and the seven residuals are benign:

- `tab:framework_vs_prototype` (+43 pp) and `fig:failclosed` (+61 pp): the
  "first reference" is a deliberate forward pointer from the Introduction;
  the local references in Section 5/6 are adjacent.
- Key-lifecycle figures 8–12 (+2 to +6 pp): five stacked column-width figures
  serving one sentence — inherent; the real fix is the still-open
  reviewer-lens item N5 (merge Phases 1–4 into one figure).
- `tab:threat_model`, `fig:ipfscost`, `fig:caliper` (+2 pp each): acceptable.

## 2. Typography — em dashes (Phase 5.8)

Counts: the manuscript contained **31 rendered spaced em dashes (` --- `) in
prose, 2 em-dash "not reported" table cells, and 3 literal `—` characters in
LaTeX comments**. All replaced; the only `---` still in the file are inside
`%` comments (4 section-header comments plus `% ----` rules), which do not
render. Grep for `—` in `.tex` now returns 0.

Replacements (comma/colon/parentheses per sentence structure; no technical
content changed): lines (pre-edit numbering) 669, 799, 814, 823–825, 843,
850–852, 857–858, 865–868, 1330–1331, 1620–1621, 1837, 1867, 2235, 2421,
2809, 2889, 2940, 2970, 2973–2976, 2980, 3026, 3056–3057, 3152–3154,
3166–3167. Table cells in `tab:numbers_comparison`: `---` → "not reported".
Comment block in Data availability: `—` → `--`.

**Not fixed (flagged):** 12 figure PDFs contain an em dash in their embedded
plot titles ("Exp 1 — Throughput vs concurrency", etc.): fig1–fig9,
document_retrieval_flow, document_upload_flow, rbac_acl_pipeline. The fix is
a one-line title change in `experiments/legacy_figures/regen_figs.py`
(prototype-fixes) and a re-run **on the original Linux environment** — not
regenerated here because re-plotting on a different host risks bootstrap-CI
annotation drift against the prose. Alternatively drop the in-figure titles
entirely (journal captions make them redundant).

## 3. Consistency — numbers (Phase 1.2/1.3; every change recomputed from raw CSVs)

| # | Sites | Before | After | Evidence |
|---|---|---|---|---|
| N1 | Contributions; Exp 1; Exp 2 (§6.2 corroboration); Exp 8; Discussion RQ3; `tab:numbers_comparison` | "68--70 TPS" (and one "68-70") sustained at the 2 s batch; ratios "4.1 to 4.2×" / "4.2×" | "66--70 TPS" for sustained duration-60 s runs; Exp 1 additionally states the fixed-count sweep spans "62--70 TPS per point"; Exp 8 gives the exact 67.7 TPS [66.3, 69.0]; ratios "4.0 to 4.2×" / "about 4×"; table cell "66--69" → "66--70" | `results/exp1_throughput.summary.json`: duration60s @2 s = 66.3 mean; fixedcount sweep per-point means 62.14–69.98; `exp_batchtimeout_sens`: 67.68 [66.32, 69.04]; `exp5_wan`: 68.24 / 69.48 @0 ms. The old "68--70" floor contradicted the visible Fig. 16 points (~62 at conc 50) and the consolidated table. |
| N2 | Contributions; Exp 9; Discussion | HTTP 503 denials "sustained at 25--45 per second" | "averaging approximately 30 per second (peaking at 44)" | `experiments/fail_closed_outage/.../per_second.csv`: outage-window seconds range 7–44 (several full seconds at 15–24); 1,340 denials / 45 s = 29.8/s. The old range overstated the floor and the peak. |
| N3 | Exp 7 | "σ = 6.1 ms" | "σ = 6.4 ms" | `results/exp7_history.summary.json`: stdev 6.41. CV < 5 % claim still holds (6.41/134 = 4.8 %). |
| N4 | Exp 2 | M1 cross-check "within 3 %" | "within about 3 %" | 2,147/2,084 = +3.02 %. |

## 4. Language (Phase 5; no technical meaning changed)

- Missing comma: "stayed below 23 % throughout confirming" → "throughout,
  confirming that" (Exp 1).
- Expanded the one terse caption: `fig:ui_audit_views` ("Audit and
  transparency views of the prototype interface.") now describes both panels
  and points to the supplementary material.
- Removed a duplicated commented-out section header (Literature Review).
- Scans that came back **clean** (no edits needed): LLM-filler vocabulary
  (delve/leverage/pivotal/seamless/robust/moreover-stacking/etc.) — 0 hits;
  British spellings — 0 hits; vague quantifiers — 0 hits; unsupported
  superlatives — 0 hits. Prior editing passes already did this work.

## 5. References (Phase 6.6 — flags only, nothing deleted)

- `macaroons2014`: the single remaining bibtex warning (empty `pages`) is
  documented-legitimate (NDSS proceedings are unpaginated). No action.
- **38 uncited `.bib` entries** (harmless — elsarticle-num prints only cited
  works — but worth pruning at camera-ready). Notable among them:
  `seoBlockchain2024` (existing author decision: cite or delete) and
  `hernando2025wills` (the BRA digital-wills paper — could be cited in
  related work as a BRA legal-domain precedent; currently dead weight).
- Entries lacking DOI/URL where one may exist — verify and add, do not
  invent: `groth2016` (EUROCRYPT, Springer DOI exists), `lone2019forensic`
  (Digital Investigation, Elsevier DOI exists), `hu2014guide` (NIST SP
  800-162 has a doi.org/10.6028 identifier), `fadhil2024blockchain`.
  `Ongaro2014`, `zanzibar2019` (USENIX) and `nielsen1993usability` (book)
  conventionally have no DOI.
- arXiv-only: `benet2014ipfs` (the IPFS whitepaper — conventional citation,
  no formally published version; fine).
- Pre-existing camera-ready items (unchanged): re-verify the three pre-proof
  citations (RBAC-IPFS, Liu & Zheng, Notash) against versions of record.

## 6. Compliance (Phase 6)

- Back matter verified present, before References, in order: CRediT
  (skeleton — **author-owned TODO, do not submit empty**), Declaration of
  competing interest, Acknowledgements (with grant number), Data
  availability, Generative-AI declaration (wording matches the Elsevier
  template: Claude/Anthropic, language editing + structuring + LaTeX,
  authors take full responsibility). ✓
- **Data availability — decision sharpened, not made.** Variant B1 (GitHub
  link) is still ACTIVE per the authors' earlier choice, but a WARNING
  comment now sits above it: the linked repo's directories are named
  `pangochain-*` and its docs use "PangoChain" throughout, so linking as-is
  leaks the system name the manuscript deliberately never uses (it also
  contains the OpenAI-based demo layer the paper is silent about). A new
  commented Variant B3 ("available from the corresponding author on
  reasonable request") was added alongside B2 (Zenodo). Exactly one variant
  must remain at submission.
- Highlights: verified — 5 bullets, all ≤ 85 characters, all claims present
  in the manuscript. Compiles standalone. ✓
- Keywords: 6, within BRA's cap, includes IPFS; relevant to scope. ✓
- Supplementary (`supplementary_ui.tex`): compiles standalone. ✓

## 7. Figure review (Phase 3 — flags, no regeneration)

- All plots and diagrams are vector PDF; only the UI screenshots are PNG
  (appropriate for screenshots; check Elsevier's 300 dpi guidance at
  submission and state 1/1.5/2-column sizing).
- Embedded "pango" text in figures: **0 occurrences** (checked all 32 PDFs).
- Axis labels/units/legends present on all plots (fig1–fig14 reviewed).
- Legibility: matplotlib defaults at 0.78–0.98\textwidth give in-figure text
  near footnote size — acceptable; the five key-lifecycle workflow diagrams
  and `access_and_decryption` render smallest and are worth a legibility look
  in print. `Hierarchy.pdf` is small (210×117 pt) but simple.
- Terminology drift **inside diagrams**: `fabric_topology4.pdf` labels nodes
  "FirmA"/"FirmB" and hostnames `*.lawchain.com`, while the prose uses
  LawFirmA/LawFirmB and `legal-channel`. Cosmetic, needs diagram
  regeneration to fix; flagged, not fixed.
- Color/grayscale: fig1–fig14 use the house two-series style
  (orange/blue with distinct markers and dash patterns) — distinguishable in
  grayscale by marker/dash; no red–green encodings found.
- Em-dash titles in 12 figures: see §2 above.

## 8. Claim-to-evidence traceability (Phase 1.3)

Method: every quantitative claim in the manuscript was traced to the raw
artifacts on `prototype-fixes` (`results/*.csv|json`, `experiments/*/results/`,
`experiments/*/RESULTS.md`, `experiments/consolidated/.../consolidated_table.md`).
Key rows (✔ = value matches artifact; convention differences documented in
the manuscript's median-convention footnote):

| Claim (manuscript) | Source artifact | Status |
|---|---|---|
| CheckAccess 6.51 vs 7.16 ms P50; means 7.293/7.548; σ 2.352/2.092; P25/P75/P95/P99 table; Mann-Whitney U=4500.0, p=0.22 | `results/exp2_latency.csv` (recomputed independently) | ✔ exact |
| RegisterDocument 2,084 ms P50 | `exp2_latency.summary.json` (2083.93) | ✔ |
| Fabric commit constant 2,132 ± 20 ms; IPFS 10→95 ms; totals 2,142–2,226 ms | `exp3_filesize.summary.json` | ✔ |
| Audit query 3.9 ms median, mean 3.45; CSV verify 86.3 ms; 22× | `exp4_audit.summary.json` | ✔ |
| WAN bridge 68.2→60.8 TPS (−11.0 %), commits 2,140→2,457; veth 69.5→38.3 (−44.8 %), 2,141→3,588 (+100/+217 intermediates) | `exp5_wan.summary.json` | ✔ |
| Crypto: PBKDF2 100.44; AES 44.42/61.94; SHA 44.43; ECDSA 0.183/0.097; ECIES 0.403/0.603; 125 B vs 256 B, 51.2 % | `exp6_crypto.summary.json` + DELTAS.md | ✔ |
| GetHistoryForKey 135.5 P50, mean 134.0, range 123–145 | `exp7_history.summary.json` | ✔ (σ corrected 6.1→6.4) |
| BatchTimeout 67.7/193.0/180 TPS; client CPU 2/11/14 %; trial ranges 137–206, 174–217 | `exp_batchtimeout_sens.summary.json` | ✔ (prose "68–70@2s" corrected) |
| Outage: 45 s, zero successes, zero bytes, 1,340 denials, 2,013 audit rows, first success t=95 (20 s lag) | `experiments/fail_closed_outage/.../summary.json`, `per_second.csv` | ✔ (denial rate corrected to avg ≈30, peak 44) |
| IPFS: 254/875 ms; 7.0 s @24 conc; 576 reqs 0 fail; 0.024 %; 46 B CID; 206 vs 204 ms one-replica-down; clean timeouts all-down | `experiments/ipfs_cost/RESULTS.md` + run CSVs | ✔ |
| Caliper: 875 TPS @20 ms; 172 TPS; 1.7–2.0 s; 3.7 %/27 % gateway-limit rejections | `experiments/caliper/results/.../caliper_rounds.csv` | ✔ |
| Ledger growth: 7.96→8.60 ms; 5.68→7.12 ms; 5,618+1,389 B/doc (~7 KB); 70–76 TPS; 3.6 h; 0 failures; within 0.1 % of linear | `experiments/ledger_growth/RESULTS.md` + disk.csv | ✔ |
| Net scaling: 43.3→40.9 (−5.5 %); majority −0.9/−5.4/−12.7 %; 35.7 TPS; peers ×2 −3.3 %; reads 3.9–5.5 ms; outlier rerun documented | `experiments/network_scaling/RESULTS.md`, matrix_final.csv | ✔ |
| Baseline: +6.5 to +9.1 ms P50; 21.6 vs 15.1; ≤10 % TPS at saturation; 144/~24,000 anchors; 3–8 TPS drain; 16,000 reqs 0 fail; @Async defect footnote | `experiments/baseline_auditlog/RESULTS.md`, levels.csv | ✔ |
| Consolidated CIs: 6.51 [6.33,7.22] vs 7.16 [6.60,7.81]; 21.62 [21.39,21.84] vs 15.09 [14.84,15.36]; 193.0 [182.8,203.2] | `experiments/consolidated/.../consolidated_table.md` | ✔ |
| Exp 1: zero errors ≤400 clients; PG peak ≈279; CPU <23 % | `exp1_throughput.summary.json` (errors 0 through 400; 279.3) | ✔ |
| **Apple M1 auxiliary figures (2,147 ms; M1 column of Table 8)** | **not in released bundle** | ⚠ NOT FOUND — auxiliary cross-platform check from the earlier campaign; either add the M1 raw data to the artifact or keep the claim clearly labeled auxiliary (it is). |
| Breach statistics (ABA 29 %, NetDocuments >50 % insider) | citation-backed (`aba2023`, `ico2024trends`), not repo artifacts | n/a (literature claims) |

No claim required invention; the three mismatches found (N1–N3 above) were
all corrected *toward* the measured data.

## 9. Consistency — terminology/cross-refs (Phase 1.4–1.7)

- `\ref`/`\cite`/`\eqref`: all resolve; 0 "??" in the PDF; figure/table
  numbering sequential; every float referenced in text (verified against
  extracted PDF text, including "Figs. 8–12"-style range references).
- Terminology spot-checks clean in prose: LawFirmA/LawFirmB (no bare FirmA
  outside figures), `legal-channel`, fail-closed (no drift), chaincode (usage
  note present), Layer 1/Layer 2. Units: TPS/ms/s usage consistent; thousands
  separators consistent ("1,340", "2,013", "193.0").
- Tense/voice: methods consistently past tense, results present; "we" appears
  only in the introduction/definitions; no drift found worth editing.
- American English throughout (0 British spellings found).
