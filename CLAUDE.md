# PangoChain — BCRA manuscript

## What this directory is

The **manuscript** clone, branch `bra-submission`. The paper lives in
`bra_submission/main.tex`.

`pangochain-backend/`, `pangochain-fabric/`, `pangochain-frontend/` and
`experiments/` here are **untracked leftovers with no source** — ignore them.

**The real code and all experimental evidence are in a second clone of the same
repo:**

```
~/Projects/Blockchain/FCDH_linux_validation/Fardeen_Codex_Dhaka_Meetup_Hackathon   # branch prototype-fixes
```

To work on the paper with its evidence in reach, start Claude Code from
`~/Projects/Blockchain` so both clones are in scope.

## Current state

The paper is being **rewritten from scratch**, reusing the experiments and
(some) diagrams. Three files drive that work:

- `PAPER_STRUCTURE.md` — the agreed outline, with figure assignments
- `MANUAL_ACTIONS.md` — what is unverified, undecided, or deliberately undone
- `Figures_New/MANIFEST.md` — per-figure validity; 11 figures need changing

The old `bra_submission/main.tex` still builds and is the reference for prose
and numbers, but several of its claims are dead (below).

## Claims that are DEAD — never restate these

The paper was revised against a Major Revision report
(`bra_submission/bcra_peer_review.md`). These are contradicted by our own
committed measurements:

1. **"CheckAccess is statistically indistinguishable from a database check."**
   It is not. 10.99 ms vs 6.44 ms, Mann-Whitney p≈1e-31. Quote the difference
   as a **range, +4.0–4.4 ms**, not to two decimals. Non-significance was never
   evidence of equivalence.
2. **6.51 ms / 7.16 ms** — superseded, do not use.
3. **Experiment 17's +0.78 ms freshness-read cost** — does not reproduce;
   undetectable on the shipped build, bounded ~0.6 ms.
4. **"Storage grows linearly with document count."** It is `a·docs + b·time` —
   the TimeAnchor heartbeat adds ~7.84 MB/day/peer at zero document activity.
5. **"ECIES"**, and any IND-CCA2 / Shoup claim. It is an
   **ECDH-HKDF-AES-GCM hybrid wrap**; no security theorem is claimed.
6. **"AAD is empty."** Recipient identity is bound. It does **not** mitigate S3.
7. Cross-experiment latency **absolutes** are not comparable across builds.
   Only paired within-run differences transfer.

**Scope discipline:** enforcement is relocated **on the read path only**. Writes
are availability-first; Experiment 16 is our own contrary evidence. A narrower
true claim is publishable at BCRA; a broad claim contradicted by our own data is
not.

## Evidence standard

Every claim needs a live measurement, with the limits of that measurement stated
plainly — including when a result is only unit-tested, and when a run was
discarded for producing a flattering wrong answer. Several findings were caught
only because a result looked too convenient. That scepticism is the point.

Each experiment directory in the code clone has a `RESULTS.md` stating what was
measured, what was not, and what must not be claimed. **Read those before
quoting any number.** `git log` on both branches carries the reasoning.

## Building the paper

```bash
cd bra_submission
docker run --rm -v "$PWD":/w -w /w texlive/texlive:latest \
  sh -c "pdflatex -interaction=nonstopmode main.tex && bibtex main && \
         pdflatex -interaction=nonstopmode main.tex && \
         pdflatex -interaction=nonstopmode main.tex"
```

The host `pdflatex` fails on a Polish diacritic in the bibliography — use the
container. Container output is **root-owned**; chown it back via a container,
since `sudo` prompts here.

The manuscript is **single-column**: `\columnwidth` is the full text width, and
`figure*` is unnecessary.

Elsevier/KeAi commonly cap abstracts near **250 words** — the old one was 261.

## Conventions

- **No `Co-Authored-By: Claude` trailer** on commits.
- Commit code and manuscript **separately** — they are different clones.
- `.env`, `bcra_peer_review.md`, and `ui_retake_seed/` stay untracked
  (`ui_retake_seed/` holds private keys).
- Commit messages carry the reasoning, not just the diff.

## Host trap that invalidates measurements

This machine has 7 GiB RAM against a full desktop session. With apps open it
sits ~9 GB into swap and **every latency figure inflates ~1.5–2×, unevenly
across arms**. Check `free -m` and `vmstat` before believing any timing.
Storage and byte-count experiments are unaffected.

Latency experiments use a bracketed **A/B/A** design so host drift is measured
rather than absorbed into the effect — see
`experiments/function_latency_exp2/run.sh` in the code clone.
