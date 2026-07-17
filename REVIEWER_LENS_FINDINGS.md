# Reviewer-Lens Critique Pass — Findings (2026-07-17)

Full-manuscript reviewer-simulation pass over `bra_submission/main.tex`
at 759ee40 (post F1–F10 coherence audit, post R1–R8 draft-history
sweep). Reads the paper as a first-time peer reviewer: does it earn
each claim and page? Line numbers refer to main.tex at 759ee40.

**Status: RESOLVED 2026-07-17.** Applied across two waves (author-ruled):
V1–V3 (commit 0caac55); then C1, R1, R2, R3 (H1–H3 are their hedging
faces), N2 (fork/join rehomed to prototype scope), N4, H5, the two
preemptive sentences from section H (#4 generator co-location, #5
gateway-vs-Caliper reconciliation), and batches A–F = N1, N6, W7 |
[N1 subsequently REVERTED by author decision 2026-07-17 — role-hierarchy
figure restored] |
W6, C3, R6 | W2, W3 | W1, W8, D1, R4, R5, H4, H6 | D2, D3, R7 |
C2, R8, W4, W5, H7 — plus the tech-stack custodial sentence (R2's
last site). Full before/after record: `REVIEWER_LENS_CHANGES.md`.

**Remaining open (never ruled, low stakes):** N3 (compress UI
showcase), N5 (merge key-lifecycle figures 1–4), and synthesis #6's
optional "cross-organization" qualifier in the abstract.
Line numbers in the tables below refer to 759ee40 (pre-fix).
Overfull baseline after this pass: 23 (was 26); pages: 103 (was 108).

## A. Factual / mechanical catches

| ID | Location | Category | Finding | Severity | Suggested action | Status |
|---|---|---|---|---|---|---|
| V1 | 3756 (Conclusion) | stale fact | "a **nine-experiment** evaluation" — paper says "fifteen experiments" in 4 places (160, 2447, 3253, 3995). The F1–F10 audit's "zero stale nine" check missed this hyphenated form. | High | "fifteen-experiment evaluation" | APPLIED |
| V2 | 2595–2596 (Exp 2 intro) | draft-history leak | "…and **resolving the baseline inconsistency cited in prior review**" — references the rejected submission's review; the class R1–R8 removed, missed because it avoids the swept phrases. | High | Delete the clause | APPLIED |
| V3 | 3404 | typo | "16.7,TPS" — missing `\` in `\,` | Low | `16.7\,TPS` | APPLIED |

## B. Wording / clarity (item 1)

| ID | Location | Finding | Severity | Suggested action |
|---|---|---|---|---|
| W1 | 2538–2540 | 55-word sentence gluing throughput + baseline provenance + citation + error claim; "and showing zero transaction errors…" has an ambiguous subject (grammatically the firm shows zero errors). | Med | Split into three sentences. |
| W2 | 2295–2313 (topology) | OrdererOrg-CA governance disclaimer stated three times in one paragraph, twice in conditional voice, before stating what the prototype actually did. | High | Fact-first rewrite: (1) measured deployment used shared OrdererOrg CA (simplification); (2) production model is member-controlled CA per Section 4.3. Cuts ~8 lines. |
| W3 | 2056–2092 (consensus ¶) | One sprawling paragraph mixing Raft config, governance, the same CA caveat as W2, deferred regulator interfaces, endorsement examples. Double-conditional sentence. | Med | Split into 3 paragraphs; CA caveat lives here OR in topology, not both. |
| W4 | 250–252, 1030, 1469 | "This prevents new document releases through the evaluated path during the tested Fabric outage" — stacked qualifiers make it near-tautological. | Med | "During Fabric unavailability, no new documents are released through this path." (scope already set by preceding sentence at all 3 sites). |
| W5 | 3768–3771 (Conclusion) | Circular: "The negligible read overhead… confirms… negligible interactive overhead." | Med | "The measured read overhead (6.51 vs. 7.16 ms P50, n=100) confirms the choice imposes no practical interactive cost." |
| W6 | 1399 (Layer 2 ¶) | ~180-word paragraph packing key conventions, MVCC rationale, cron job, eventual consistency; two 60+-word sentences. | Med | Split after "…evaluated at query time." |
| W7 | 396–400 | Lit-review opening; Alkhatib sentence ~60 words. | Low | Split at "…open deployment challenges:". |
| W8 | 2727 | Exp 4 methods: one paragraph; final sentence ~55 words. | Low | Split at "A PostgreSQL audit_log table was seeded…". |

## C. Coherency (item 2)

| ID | Location | Finding | Severity | Suggested action |
|---|---|---|---|---|
| C1 | 2447–2451 | "Experiments 10–15 extend it along the axes **reviewers of permissioned-blockchain systems most often probe**" — meta-commentary framing experiments as review-defense. | High | "…extend it along axes the core campaign leaves open: off-chain storage cost, standard-instrument comparability, …" |
| C2 | 273–276 vs 3641–3643 | RQ1 drift: intro RQ1 = "ledger-verifiable access-control state… strict fail-closed policy"; Discussion restates as "access decisions **and audit events** independently verifiable while **preserving confidentiality**" — different question. | Med | Align Discussion restatement to intro wording verbatim. |
| C3 | 1920–1921 | "This scenario is promoted from the prototype-limitations discussion" — organizational self-reference. | Low | "This is the sharpest residual risk in the prototype." |

## D. Readability / density (item 3)

| ID | Location | Finding | Severity | Suggested action |
|---|---|---|---|---|
| D1 | 3012 | Exp 9's entire experiment in one ~200-word paragraph. | Med | Split into setup/results/recovery. |
| D2 | 3496–3526 (GDPR) | Pseudonymization/compliance point made ~3 times; final sentence 60+ words. | Med | Merge ¶2–3; state caveat once; split last sentence. ~10 lines saved. |
| D3 | 3494 | 150-word paragraph fusing a NEW limitation (no IPFS GetFile timeout) with a REPEATED caveat (other paths not outage-tested, stated 5× elsewhere). | Low | Split; end repeated caveat with a pointer. |

## E. Conceptual redundancy (item 4) — with counts

| ID | Concept | Sites | Severity | Suggested action |
|---|---|---|---|---|
| R1 | CFT-not-BFT / SmartBFT production path | 11 SmartBFT mentions, 7 locations: 259, arch table 763–767, threat table 1754–1767, claims table 1837–1839, out-of-scope ¶1972–1988 + dedicated ¶1990–2001, consensus 2074–2075, limitations 3411–3423 | High | Keep ¶1972–1988 + table rows. Delete ¶1990–2001 (restatement); compress 3411–3423 to two sentences + pointer. |
| R2 | Custodial MSP identity → per-user X.509 | 13 mentions of production path; 8 of "server-managed/shared administrative": 962, 999–1003, 1093–1096, 1332–1334, table rows, 2126–2133, 2287–2290, 3545–3554, 3589–3593, 3650–3652 | High | Establish once in Prototype Scope + table + one future-work statement; elsewhere "(custodial-identity caveat, Section 5.1)". ~15 lines. |
| R3 | "Other paths fail-closed by design but not independently outage-tested" | ~6 near-verbatim: 249–250, 1024–1026, 1464–1466, 1592–1594, 1827, 3494, 3714–3717 | High | Load-bearing twice (intro first scoping + limitations). Middle four → pointer or delete. |
| R4 | Exp 2 conclusion restated within Exp 2 | 2619–2628 and 2671–2676 (same numbers twice) | Med | Delete 2671–2676's first two sentences; keep write-SLO sentence. |
| R5 | No-PG-write-baseline justification | 2630–2635, 2677–2680 (same subsection), 3682–3683 | Med | Keep 2630–2635; reduce 2677–2680; Discussion instance fine. |
| R6 | MVCC / expiry write-back eventual consistency | 4 tellings: 1399, listing comment 1437–1441, 2335–2349, 3375–3377 | Med | Full story once (§3.4 + listing); 2335–2349 shrinks to a clause. |
| R7 | S3 public-key substitution told twice in full | 1920–1936 and 3475–3490 (~15 lines each, same mitigation sentence) | Med | Keep threat-model version; limitations → 3 lines + pointer. |
| R8 | "Not a new access-control primitive / not BFT / not production-ready" | 4 sites post-F4: 316–318, 528–529, 3629–3631, 3738–3740 | Med | Contributions + Conclusion legitimate pair; cut Discussion 3629–3631 (verbatim third telling); keep 528–529. |

## F. Weak / non-load-bearing content (item 5) — what is lost by cutting

| ID | Location | Content | What is lost | Severity |
|---|---|---|---|---|
| N1 | 377–385 + 198 | Fig. 1 role-hierarchy org chart, referenced once | **Nothing.** Generic; sentence at 198 already concedes hierarchy isn't the point. | Med (cut) |
| N2 | 2351–2407 | "Demonstration of Core System Workflows": 3 sequence/activity diagrams re-describing flows already diagrammed in Section 3 | A second diagrammatic view; no claim cites these figures. ~2 pages. One real item — fork/join not validated (2395–2397) — needs a one-line home in prototype scope. | High (cut candidate) |
| N3 | 2410–2438 | UI showcase + 2 screenshots | Visual proof prototype exists; ledger-explorer weakly supports auditability. Compress to 1 ¶ + supplementary pointer. | Med (compress) |
| N4 | 1806–1844 | tab:security_claims "compact argument sketch" | Little: row-by-row compression of tab:threat_model 2 pages earlier. Paper has 4 overlapping trust/limitation matrices. | Med (cut or merge) |
| N5 | 1339–1377 | Five key-lifecycle figures (Phases 1–5); Phase 5 unimplemented design | Phases 1–4 duplicated by §3.2 workflow figures; Phase 5 is the only non-duplicated content. Keep 5, merge/cut 1–4. ~1 page. | Med |
| N6 | 182–191 | Breach statistics + "do not prove audit logs were altered" hedge | Motivation worth keeping, halved; hedge sentence protects against an overclaim not yet made. | Low (trim) |

## G. Defensiveness / over-hedging (item 7) — cumulative assessment

**Verdict: accumulation is visible.** Counts: "production
hardening/path/requires/deployment" ×35, "fail-closed" ×35, custodial
×11, SmartBFT ×11, per-user X.509/Fabric ×13, "evaluated
(document-)download path" ×8, 16.7 TPS "synthetic/illustrative"
hedge ~5×, "not a formal proof / no new reduction" ×5 (1573, 1651,
1149–1155, 1185, 2003–2015). ~60% of hedge instances restate caveats
already established. Consolidating into Prototype Scope + Limitations
would read as MORE rigorous and recover ~2–3 pages with section F.

| ID | Hedge | Load-bearing | Purely defensive | Action |
|---|---|---|---|---|
| H1 | Download-path scoping / "not independently outage-tested" (=R3) | Intro first statement; Limitations 3494 | ~4–5 middle repeats | Cut repeats (R3) |
| H2 | Custodial identity (=R2) | Prototype Scope; P4 caveat; Discussion ¶3650 | Other ~9 | Cut repeats (R2) |
| H3 | CFT/BFT (=R1) | Threat-model ¶1972–1988; A2 | ¶1990–2001, 3411–3423, 259 aside | Cut repeats (R1) |
| H4 | "Illustrative 16.7 TPS assumption" | RQ3 definition (292–293) | 2540, 2551, 3404–3405 | Later sites: "the 16.7 TPS baseline (RQ3)". |
| H5 | "Not a formal proof / no new reduction" | Crypto §once (1149–1155) | 1185, 1573, 1651 caption, ¶2003–2015 | Keep one + caption; delete ¶2003–2015 final 2 sentences and 1185. |
| H6 | Self-narration: "deliberately not plotted" (2933), "deliberately not hardware-normalized" (3280), "The raw speedup, however, is not the point" (2731), "precisely because" (1929) | Each locally defensible | Cumulative: paper anticipating attack | Optional: drop "deliberately" ×2. |
| H7 | Discussion RQ1 "affirmative within the evaluated scope" + immediate 2-¶ boundaries block | Boundaries content legitimate | Reflex qualifier in the answer sentence | "The answer is affirmative, with two boundaries:". |

## H. Reviewer-comment synthesis (item 6, ranked by likelihood)

1. "Too long and repetitive; same caveats 5+ times" (R1–R3, H1–H3, N2/N4/N5). Near-certain.
2. Internal inconsistency "nine-experiment" vs "fifteen" (V1). [FIXED]
3. "What prior review?" (V2). [FIXED]
4. Single-host testbed validity: generator co-located with network on one
   8 GB host; Exp 13 discloses ratios-only, Exp 8 reports client CPU, but
   Exps 1/5/9/14 don't restate co-location. Pre-empt with one sentence in
   evaluation setup (2452–2462) pointing to Exp 8 client-CPU evidence.
5. Exp 2 vs Exp 11 unreconciled: gateway CheckAccess 6.51 ms P50 vs
   Caliper 20 ms avg direct — different statistic/load/path, never stated
   side by side. One sentence in Exp 11 or consolidated section.
6. Owner-org fallback vs zero-trust framing — well-disclosed; optionally
   add "cross-organization" to the abstract's access-check sentence.
7. RQ1 restatement drift (C2).
8. Reviewer-aware framing (C1) — tone flag.

## How to resume in a fresh session

1. This file + `AUDIT_FINDINGS.md` + `MANUSCRIPT_TODO.md` (repo root,
   bra-submission) hold all pending manuscript work.
2. Gate: author selects IDs; judgment-call rewrites (most of B–G) get
   before/after diffs before commit; mechanical fixes apply directly.
3. Compile: docker texlive/texlive (no local LaTeX); overfull baseline
   = 26; 108 pages; aux/log/pdf are committed build artifacts.
4. `session-summary.md` (prototype-fixes) is the living campaign log.
