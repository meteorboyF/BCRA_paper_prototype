# Figures_New — manifest and validity status

Assembled 2026-08-02 for the paper rewrite. These are **copies**; the originals
remain under `bra_submission/figures/` so the existing paper still builds.

Status key:
- **OK** — reflects the current build; reuse as is.
- **CAVEAT** — data is correct but belongs to an older build or is incomplete;
  reusable only if the text scopes it.
- **REGENERATE** — contains something now false; do not reuse unchanged.
- **REVIEW** — hand-drawn; nothing automated checks it against the code.

---

## Data figures

| File | Exp | Status | Why |
|---|---|---|---|
| `fig2_latency.pdf` | 2 | **OK — newly generated** | Regenerated 2026-08-01 from the quiet-host run. CheckAccess 10.99 ms (n=200) vs 6.44 ms (n=100), disjoint CIs. Supersedes the 6.51/7.16 version. |
| `fig14b_durable_baseline.pdf` | 14b | **OK** | Three-mode comparison against the durable audit-log baseline. Recent, matches current claims. |
| `write_path_reconciliation.pdf` | 16b | **OK** | Durable re-anchoring, median 15.9 s. Recent. |
| `fig9_failclosed_outage.pdf` | 9 | **OK** | Fail-closed behaviour under outage; unaffected by M2/M5/M10. |
| `fig1_scalability.pdf` | 1 | **OK** | Throughput vs concurrency. Write-path; the read-path changes do not touch it. |
| `fig3_filesize.pdf` | 3 | **OK** | File-size independence of the upload path. |
| `fig4_audit.pdf` | 4 | **OK** | Audit verification cost, PostgreSQL vs hash chain. |
| `fig5_wan.pdf` | 5 | **OK** | WAN RTT sweep. |
| `fig7_gethistory.pdf` | 7 | **OK** | GetHistoryForKey vs depth. |
| `fig8_sensitivity.pdf` | 8 | **OK** | BatchTimeout sensitivity. |
| `fig10_ipfs_cost.pdf` | 10 | **OK** | IPFS replication/DAG overhead. |
| `fig6_crypto.pdf` | 6 | **REGENERATE** | Panel labels say **ECIES**, which the rewrite must not use (review item 19). Also review item 30: stale labels were corrected in the caption but never in the figure. Token-size panel should acknowledge HPKE (~80 B) alongside RSA-OAEP (256 B), per item 21. |
| `fig12_ledger_growth.pdf` | 12 | **CAVEAT / REGENERATE** | Storage panel is confirmed (5,751 B/doc measured vs 5,618 published, within 2.4 %). **But** it shows growth as linear in document count only; the model is now `a·docs + b·time` — the TimeAnchor heartbeat adds ~7.84 MB/day/peer with zero document activity. Add the time term or the figure understates cost. Its latency panel predates the current read path. |
| `fig11_caliper.pdf` | 11 | **CAVEAT** | Chaincode-direct CheckAccess throughput. CheckAccess changed since (TimeAnchor read, M5 removal), and **Exp 11 was never re-assessed**. Either re-run or scope the caption to the build measured. |
| `fig13_network_scaling.pdf` | 13 | **CAVEAT** | CheckAccess across 2–7 organizations — read-side, so the same changes apply, and **Exp 13 was never re-assessed**. Same choice: re-run or scope. |
| `fig14_baseline.pdf` | 14 | **CAVEAT** | End-to-end premium on the pre-M2/M5/M10 build. The current caption scopes it; keep that scoping in the rewrite or drop the figure in favour of 14b. |

## Architecture and flow diagrams — all REVIEW

Hand-drawn; nothing verifies them against the code. **Two changes plausibly
invalidate several of them:**

1. **M5 removed the implicit organization fallback.** Any diagram showing an
   access decision succeeding because the requester is in the owning
   organization, without an explicit grant, is now **wrong**.
2. **Wrapped keys now bind recipient identity as AAD.** Any diagram enumerating
   the wrapped-key token's inputs is now **incomplete**.

| File | Check for |
|---|---|
| `access_and_decryption.pdf` | Org-fallback path (1); AAD in unwrap (2) |
| `access_grant.pdf` | AAD binding at wrap time (2); grant is now mandatory for same-org principals (1) |
| `rbac_acl_pipeline.pdf` | **Highest risk** — the two-layer ACL. Layer 2 no longer has an org-ownership shortcut (1) |
| `document_encryption.pdf` | AAD inputs (2) |
| `key_gen_and_storage.pdf` | AAD inputs (2) |
| `key_rotation_and_recovery.pdf` | Re-wrap on rotation must now bind AAD (2); legacy unbound tokens exist |
| `integrity_check_flow.pdf` | Likely unaffected — hash/CID anchoring unchanged |
| `fabric_topology4.pdf` | Likely OK — 3-org topology unchanged |
| `Hierarchy.pdf` | Likely OK — role hierarchy unchanged |

Also: `DIAGRAM_REDRAW_INSTRUCTIONS.md` and `MIZI_DIAGRAM_FIXES.md` (repo root,
**untracked**) hold the Figure 7 spec and the corrected Figure 1 note. Fold them
in before redrawing.

## UI screenshots

| File | Status |
|---|---|
| `ui_audit_log.png` | **OK** — AAD binding is not user-visible |
| `ui_ledger_explorer.png` | **OK** |

## `unused_in_old_paper/`

13 assets present in `figures/` but never `\includegraphics`-ed by the old
`main.tex`. Provenance and accuracy **unassessed** — they were not part of the
built paper, so nothing in the review process checked them. Treat as raw
material, not as validated figures.

## Deliberately NOT included

`~/Projects/Blockchain/Figures Updated/` — ten regenerated charts that added
**in-figure titles**, against that directory's own house rules ("no title inside
the figure", "no em dashes"). Confirmed by rendering on figures 1, 2 and 9; the
other seven inferred. Never validated, never used by any build. Excluded on
purpose — decide before adopting any of them.
