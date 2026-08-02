# Manual actions — things I could not verify or decide for you

Everything here is either (a) unverifiable from this machine, (b) an authorial
judgement that is yours to make, or (c) work deliberately left undone with a
reason. Nothing in this file is a known defect in committed work; where a claim
in the paper rests on something unverified, that is stated in the paper too.

Last updated 2026-08-02, after Tier 3 and Tier 4.

---

## 1. Verify before submission — I could not

### 1.1 Two Table 1 marks rest on abstract-level sources
**Status: needs your library access.**

Review item 18 asked for the ACL column to be re-audited, calling out Guo et al.
2024 and Onyeashie et al. 2025 as marks that "will draw objections". I moved both
from **N** to **P**. Both are confirmed to partition access via Fabric channels,
and Guo additionally verifies identity in chaincode via zero-knowledge proofs —
which under the column's new definition is P, not N.

**But I did not read either mechanism end to end.** MDPI returned HTTP 403 and
the IEEE paper is paywalled; neither is in `lit-papers/`. I chose P as the
conservative direction, because crediting a compared system is safer than
understating it. Confirm against the full texts:

- Guo et al. 2024, *Applied Sciences* 14:5005, doi:10.3390/app14125005
- Onyeashie et al. 2025, ICTCS pp.105–112, doi:10.1109/ICTCS65341.2025.10989348

Specifically: does either evaluate an authorization decision **per document, on
the retrieval path, before content or keys are returned**? If yes for Guo (the
ZKP identity check might qualify depending on where it sits), it becomes Y.

### 1.2 Abstract length against the actual BCRA cap
**Status: needs the journal's guide for authors.**

The abstract is **261 words**. It was 228 before the peer-review work began and
260 before I touched it; my Experiment 2 rewrite is net +1. Elsevier/KeAi
commonly cap at 250, but I have not seen BCRA's current instructions. If 250 is
enforced, roughly 11 words need cutting. I did not trim other people's sentences
to solve a pre-existing overage — that is an authorial call.

### 1.3 The regenerated figures in `~/Projects/Blockchain/Figures Updated/`
**Status: unverified, and not used by the build.**

That directory holds ten regenerated data charts that added **in-figure titles**,
against that file's own house rules ("no title inside the figure", "no em
dashes"). The violation was confirmed by rendering on figures 1, 2 and 9; the
other seven are **inferred, not checked**. None of them has been copied into the
repository, and the committed build does not use them. Decide whether you want
them at all before merging any of them in.

### 1.4 Diagrams are not covered by any automated check
**Status: your eyes only.**

The architecture and flow diagrams (`access_and_decryption.pdf`,
`access_grant.pdf`, `document_encryption.pdf`, `key_gen_and_storage.pdf`,
`key_rotation_and_recovery.pdf`, `rbac_acl_pipeline.pdf`,
`write_path_reconciliation.pdf`, `fabric_topology4.pdf`, `Hierarchy.pdf`,
`integrity_check_flow.pdf`) are hand-drawn assets. Nothing verifies that they
still match the code. Two changes in this round plausibly affect them:

- **The organization fallback was removed (M5).** Any diagram showing an access
  decision succeeding via organization membership without an explicit grant is
  now wrong.
- **Key wrapping now binds recipient identity as AAD.** Any diagram enumerating
  the wrapped-key token's inputs may want to show it.

Also unresolved from earlier: `DIAGRAM_REDRAW_INSTRUCTIONS.md` and
`MIZI_DIAGRAM_FIXES.md` are **untracked**, so the Figure 7 spec and the
corrected Figure 1 note exist only on this machine. Commit them or fold them in.

### 1.5 Citation spot-checks
I added two citations and one bib entry. All three resolve and build clean, but
the *content* claims are mine and worth a glance:

- `steichen2018blockchain` — I characterise it as permissionless Ethereum,
  smart-contract-gated IPFS retrieval, no per-recipient key wrapping, no measured
  outage behaviour. From the abstract and the paper's known architecture; I did
  not re-read the full text.
- `stathakopoulou2022smartbft` — cited for the SmartBFT recommendation, replacing
  two of four Fabric-documentation citations carrying that point.
- `rfc9180` (HPKE) — newly added to `references.bib`. The ~80-byte token figure I
  quote is derived from DHKEM(X25519)+AES-128-GCM sizes (32-byte enc + 32-byte
  wrapped key + 16-byte tag), **not measured**. The paper says so.

---

## 2. Deliberately not done, with reasons

### 2.1 Review item 23 — `RegisterIdentity` chaincode function
**Status: NOT IMPLEMENTED. The one Tier 4 item left undone.**

The review estimates roughly a day and calls it the conversion of your sharpest
disclosed limitation (S3, public-key substitution) into a contribution. I did not
attempt it, because it is a feature addition rather than a precision fix, and
doing it properly means:

1. a new chaincode function anchoring the user-to-key binding at enrollment;
2. a backend call at registration;
3. a verification step where grants are formed;
4. **chaincode sequence 12** — the network is currently at v1.21 sequence 11;
5. a new experiment demonstrating that the A5 substitution is now detectable,
   because on this project a security claim without a live measurement is not
   finished.

Rushing 1–4 without 5 would produce exactly the argued-not-measured claim the
review objects to. I would rather hand you a clean stopping point.

**Note the interaction with what I did ship:** the recipient-bound AAD (item 20)
does *not* mitigate S3, and I have said so explicitly in the paper. The review
asserted item 20 "directly reduces S3 severity"; it does not. An adversary who
substituted the public key holds the matching private key and can supply the
legitimate recipient's identifier as AAD unchanged. AAD defeats *re-targeting an
existing token*, which is a different attack. Only a ledger-witnessed
user-to-key binding closes S3.

### 2.2 Binding `docID` as AAD
**Status: blocked by a design decision that is yours.**

Review item 20 asked for the recipient public key *and* `docID` as AAD. Only the
recipient identity is bound. On the upload path the owner's key is wrapped
before `POST /documents/upload` returns, and the backend assigns the document id
— so it does not exist at wrap time. Binding it requires **client-generated
document identifiers**, which is a schema and API change, not a local one.

Consequence, stated in the paper: the binding defeats re-targeting a token to a
different principal, but not replaying a token from one document to another for
the *same* principal.

### 2.3 The legacy-token fallback is a live weakness
**Status: needs a migration decision.**

Tokens minted before this change carry no AAD and are **byte-identical** to bound
ones, so they cannot be told apart by inspection. `eciesUnwrapKey` therefore
falls back to the unbound form and logs a warning. While that fallback exists the
guarantee is advisory: an attacker who can present a legacy-format token still
gets the old behaviour.

Private keys never leave the client, so **existing grants cannot be re-wrapped
server-side** — they are only replaced when a holder reissues them. Once
outstanding grants are reissued, set `allowUnboundLegacy = false` in
`pangochain-frontend/src/lib/crypto.ts` and the weakness closes.

### 2.4 Access-graph disclosure has no fix, only a stated tension
Review item 22 offered a choice: migrate wrapped-key tokens to a PDC, or name the
exposure. I named it (new subsection, `sec:accessgraph`). PDC migration is not a
pure improvement — it narrows verification to collection members, so a regulator
outside the collection could no longer independently check an access decision,
and it changes `CheckAccess` endorsement requirements. That is a design trade for
you to make, not a hardening step to apply.

---

## 3. Environment facts that will bite a fresh session

- **Latency experiments need a quiet host.** This machine has 7 GiB RAM against a
  full desktop session. With the desktop open it sits ~9 GB into swap and every
  latency figure inflates by roughly 1.5–2×, unevenly across arms. Check
  `free -m` and `vmstat` before believing any timing. Storage and byte-count
  experiments are unaffected — they are the right work for a loaded host.
- **The stack is currently: chaincode legalcc v1.21 sequence 11**, freshness
  check enabled, backend in Fabric mode with the fail-closed default, 17
  containers up.
- **The ledger carries 2,000 benchmark documents** (`LG12B-70744510-*`) from
  Experiment 12b. Harmless, but they are in the world state.
- `experiments/.venv` referenced by `experiments/consolidated/RESULTS.md` **does
  not exist**. Nothing currently needs it; the analysis scripts are
  standard-library only.
- Figures are generated through a container (no matplotlib on this host) and the
  outputs come back **root-owned** — chown them back, also via a container, since
  `sudo` prompts here.

---

## 4. Not started

Tier 5 (items 24–35), hygiene. All cheap, all reviewer-visible, none begun.
