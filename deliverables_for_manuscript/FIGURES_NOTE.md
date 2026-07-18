# Figure Deliverables — Verification Note (2026-07-18)

Produced on the original evaluation machine (Intel Core Ultra 5 125H,
Ubuntu 22.04, 8 GB) in the original plotting environment (Python 3.12.3,
matplotlib 3.11.0, numpy 2.5.1 — the same venv that generated the
committed figures). Branch: `linux-validation`.

## fig1–fig9 — title-free regeneration (Task 2)

Change: `set_title`/`suptitle` strings removed entirely for fig1–fig9 in
`experiments/legacy_figures/regen_figs.py`. The "(a)…"/"(b)…" panel
sublabels in fig5 and fig8 are retained (they contain no em dashes).
Nothing else changed: same data paths, same canonical filters, same CI
method, same seeded bootstrap (`--boot 10000 --seed 7`).
Evidence run: `experiments/legacy_figures/results/20260718_104706/`.

### Mandatory annotation diff (pdftotext text layer, committed vs new)

Method: `git show origin/bra-submission:bra_submission/figures/<f>.pdf`,
`pdftotext` both versions, sorted line diff.

| Figure | Text-layer difference | Numeric annotations |
|---|---|---|
| fig1_scalability | title line only | IDENTICAL (incl. "193 TPS @500 ms" reference label) |
| fig2_latency | title line only | IDENTICAL |
| fig3_filesize | title line only | IDENTICAL |
| fig4_audit | title line only | IDENTICAL |
| fig5_wan | suptitle line only | IDENTICAL |
| fig6_crypto | title line only | IDENTICAL (incl. PBKDF2 100.59 ms annotation) |
| fig7_gethistory | title line only | IDENTICAL (incl. "P50 = 135.5 ms") |
| fig8_sensitivity | suptitle line only | IDENTICAL |
| fig9_failclosed_outage | title line only | IDENTICAL |

For every figure the ONLY line removed from the text layer is the
deleted title; every other line — all tick labels, bar/point
annotations, legend entries — is byte-identical. No re-seeding was
needed; the committed values reproduced exactly on the first run.

## Diagram editable-source check (Task 2, second part)

Searched both `linux-validation` (full tree) and `origin/bra-submission`
(git ls-tree) for `.drawio`, `.svg`, `.pptx`, `.vsdx` sources for:
`document_upload_flow`, `document_retrieval_flow`, `rbac_acl_pipeline`,
`fabric_topology4` (the last shows "FirmA"/"FirmB" and `*.lawchain.com`
labels where the paper text says LawFirmA/LawFirmB).

**Result: no editable source found for any of the four.** Only the
rendered PDFs exist in the repository. Per instructions, they were NOT
recreated; the FirmA/FirmB + `lawchain.com` label mismatch in
`fabric_topology4.pdf` remains an open item requiring the original
drawing tool/source held outside the repo.

## Key-lifecycle composites (Task 3)

(appended below when built)
