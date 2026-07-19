# Session changes — 2026-07-19

What changed this session, in order, with commit hashes and where each lives.
Two clones were used:

- **main clone** — `~/Projects/Blockchain/Fardeen_Codex_Dhaka_Meetup_Hackathon`
  (holds the manuscript on `bra-submission`)
- **validation clone** — `~/Projects/Blockchain/FCDH_linux_validation/Fardeen_Codex_Dhaka_Meetup_Hackathon`
  (holds the full code tree, experiments, and the live Docker network; work on
  `prototype-fixes` / `ui-retake`)

---

## 1. UI screenshot swap into the manuscript
**Branch:** `bra-submission` — commit **d59c7b6**

- Copied the codename-free UI retakes `ui_ledger_explorer.png` and
  `ui_audit_log.png` (from the validation clone's
  `deliverables_for_manuscript_ui/`) into `bra_submission/figures/`
  (same filenames → no `\includegraphics` edits).
- **Integrated a co-author push discovered mid-work:** the first push was
  rejected because `bra-submission` had advanced `4be6101 → e490714`
  (co-author "hardening-pass" merge — newer local copy overlay, CRediT
  filled, `seoBlockchain2024` removed, readability/full-width-figure pass,
  T1–T6 alignment, `references.bib` changes, regenerated figures). Redid the
  swap on top of their tip.
- Rebuilt via docker `texlive/texlive`. **New baseline after their merge:
  103 pages, 16 overfull** (down from 104/23). Verified the retakes are in
  the PDF (page 54).

## 2. UI prose precision
**Branch:** `bra-submission` — commit **52e1602**

- `bra_submission/main.tex` §UI: "channels" → "the channel"; added
  "each event linked to its anchoring Fabric transaction identifier";
  "expanded" → "expandable" (to match the caption).
- Rebuild unchanged: 103 pages, 16 overfull.

## 3. Cold peer-review pass (assessment only, no commit)
- Read the submitted PDF end-to-end and produced a full reviewer report
  (summary, strengths, major/minor concerns, recommendation: Major Revision).
- Surfaced three high-severity findings **absent from every prior audit doc**
  (AUDIT_FINDINGS, REVIEWER_LENS_FINDINGS/CHANGES, MANUSCRIPT_TODO): M2, M3,
  M4. These drove the rest of the session.

## 4. M2 / M3 / M4 investigation (code + live network)
Scoped each against the actual code and the running 3-org network.

- **M2 — orderer-only outage divergence: CONFIRMED LIVE, and permanent.**
  With peers up and all three orderers stopped: a revoke returns HTTP 204 but
  never reaches the ledger (`AccessControlService.revoke()` catches the submit
  failure and completes), so `CheckAccess` (evaluate → live peer) keeps
  authorizing the revoked user — download 200, 669 bytes served; ledger
  `CheckAccess=true` while DB `revoked=t`. After orderer restart the ledger
  **still** authorizes — no automatic re-anchoring, so the divergence is
  permanent until a manual re-revoke. Exposure bounded to ciphertext (the
  wrapped-key endpoint is DB-gated → 403). Experiment 9 (all-peer outage)
  structurally can't catch this.
- **M3 — client-supplied `CheckAccess` timestamp: CONFIRMED in code.**
  `chaincode.go:191` reads `GetTxTimestamp()`; on an evaluate that value comes
  from the client/gateway proposal and is never ordered/validated. Under the
  prototype's custodial MSP identity the compromised API operator is the
  signer → can backdate to resurrect an expired grant.
- **M4 — single-peer evaluate: CONFIRMED in code.** `FabricConfig` binds one
  peer endpoint; the release-path `CheckAccess` trusts a single peer's query
  response. (Side note: the channel uses **majority** endorsement for
  writes — a single-peer `RevokeAccess` invoke returns
  `ENDORSEMENT_POLICY_FAILURE`.)

## 5. Experiment 16 — formalized, run, committed
**Branch:** `prototype-fixes` (validation clone) — commit **801824c**

- New `experiments/orderer_outage_divergence/`:
  - `setup.mjs` — builds a fresh, self-contained fixture (case + browser-
    encrypted document + active cross-firm grant) via real REST flows.
  - `run.sh` — runs the full outage sequence, capturing raw HTTP/ledger/DB
    evidence.
  - `RESULTS.md` — findings write-up.
  - `results/20260719_061017/` — evidence bundle (`sequence.csv`,
    `fixture.json`, `environment.json`, `ledger_acl_during_outage.json`,
    force-added `run.log`).
- `experiments/README.md` index updated (Exp 16 row + note).
- Reproduced the full sequence including the manual re-revoke fix
  (step 8: CLI re-revoke with majority endorsement commits `VALID` →
  ledger `false`).
- Also fixed a bookkeeping slip: an earlier M2/M3/M4 log entry had landed on
  `ui-retake` by mistake; it was moved to `prototype-fixes` and `ui-retake`
  was reset to its pushed tip (`f996c96`).

## 6. Manuscript reviewer fixes D1–D8
**Branch:** `bra-submission` — commit **165dcb3**

Applied (compile-verified): **105 pages, 16 overfull, no undefined refs.**

| ID | Change | Location |
|----|--------|----------|
| D1 | New **Experiment 16** subsection (6.16) | §6, after Table 11 |
| D2 | S1 revoked-replay cross-referenced to the write-path divergence | Threat model, Scenario S1 |
| D3 | "until re-anchored" corrected → **no automatic re-anchoring**, permanent until manual re-revoke; points to Exp 16 | §7 write-path limitation |
| D4 | Timestamp is proposal-supplied / backdatable under custodial identity | Threat-model API-operator row + "Access-decision replay granularity" |
| D5 | Release decision consults a **single peer** | P1 statement + Discussion RQ1 |
| D6 | Fig 1 caption scoped to app-layer intra-org vs ledger cross-org enforcement | Fig 1 caption |
| D7 | Abstract leads with canonical **66–70 TPS**, 193 qualified as tuned | Abstract |
| D8 | Count "fifteen" → "sixteen" for campaign totals; kept "fifteen **measurement** experiments" where it means the consolidated-metrics set | Abstract, §6 intro, §6.15, Conclusion, Data availability |

## 7. M7 — data availability / Zenodo (path b)
**Manuscript:** Data Availability switched to **Variant B2** (archival DOI) in
commit 165dcb3.

- **Codename-neutralized replication package built:** `experiments/` +
  `results/` extracted from a clean `git archive`, scrubbed to **zero**
  residue of the codename (→ `LDMS` / `ldms.example`) *and* of the author
  home-path, the hackathon repo name, and the capture hostname found along
  the way. Output: `ldms-replication-package-v1.zip` (3.8 MB) in the session
  scratchpad, with a `README.md` provenance/anonymization note inside.
- **Tags pushed:** `bra-data-v1-experiments` (`prototype-fixes` @ 801824c),
  `bra-data-v1-twohost` (`linux-validation` @ 6857eef).
- **B2 DOI is a flagged placeholder** `10.5281/zenodo.XXXXXXX` — see below.

---

## Commits this session

**`bra-submission`** (manuscript):
- `d59c7b6` — UI retakes swapped in
- `52e1602` — UI prose precision
- `165dcb3` — reviewer M1–M6 fixes + Experiment 16 + M7 B2 activation

**`prototype-fixes`** (experiments / living log):
- `103db5f` — log: UI swap
- `901dcd0` — log: UI prose
- `801824c` — Experiment 16 + M2/M3/M4 investigation log

**Tags:** `bra-data-v1-experiments`, `bra-data-v1-twohost`

**Not authored by us but integrated:** `e490714` (co-author hardening-pass
merge, landed on `bra-submission` before our UI swap).

---

## Baseline history this session
103 pages / 16 overfull (post co-author merge) → **105 pages / 16 overfull**
(after Exp 16 subsection + reviewer fixes).

---

## Open action items (yours)

1. **Zenodo DOI (blocking submission):** upload
   `ldms-replication-package-v1.zip` to Zenodo, then replace the placeholder
   `10.5281/zenodo.XXXXXXX` in `bra_submission/main.tex` (Data availability,
   marked `ACTION REQUIRED`) with the minted DOI.
2. **Reviewer M5 / M8 + minors — not yet actioned.** M5 (equivalence test /
   explain why the DB baseline median is slower), M8 (verify the e-health
   "none reports X" claims), and the minor wording/table-dedup nits remain
   open from the review.
3. **Supplementary UI screenshots** (registration, dashboard, case, details,
   download) are still the **old** captures — only the two main-text audit
   views were retaken.
4. **Demo-data state:** the live network's seeded `doc0` grant may be left in
   a divergent state from the M2 testing; regenerate with
   `node ui_retake_seed/seed_demo.mjs flows` if a clean demo is needed. Does
   not affect any committed artifact.
