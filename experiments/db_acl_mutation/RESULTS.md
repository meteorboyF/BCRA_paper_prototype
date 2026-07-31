# Experiment 18 — Adversarial Database ACL Mutation

**Evidence run:** `results/20260731_090324/`. Linux x86_64, Fabric 2.4, 3-org
`legal-channel`, backend with `DOCUMENT_MATERIAL_DB_FALLBACK=false` (the shipped
strict fail-closed default).
**Runner:** `run.sh` + `setup-attacker.mjs`.

`results/20260731_090028/` is an **invalid earlier run, retained deliberately.** Its case 3
reported the same-organization insider as denied (403), which looked like a reassuring
result and was not. The insider account was still in `PENDING_APPROVAL`, so every request
from it was rejected at the security filter before any document ACL was consulted — the run
measured account status, not authorization. It is kept because a discarded run that produced
a *flattering* wrong answer is worth being able to audit, and because the failure mode is
easy to reproduce accidentally.

## Why this experiment exists

The manuscript's headline security claim is that a malicious database administrator cannot
subvert authorization, because the release path evaluates committed ledger state rather than
the PostgreSQL ACL. Reviewer finding **M10**: *"This is the paper's headline security claim
and it is argued, not measured — in a paper whose stated contribution is measurement."*

This experiment measures it, by performing the mutation an attacker with database write
access would perform — directly via `psql`, never through application code — and observing
what the release path actually does.

## Method

Fixture: a document owned by a LawFirmA user with a genuine cross-firm read grant to a
LawFirmB user, built through the real REST flows (shared with Experiment 16). Three cases,
each mutation reverted before the next.

The same-organization insider in case 3 is a self-registered LawFirmA account. Note that
self-registration lands in `PENDING_APPROVAL`, and an unapproved account is rejected at the
security filter before any document ACL is consulted — an earlier run of this experiment
produced a spurious "denied" for exactly that reason. The runner now approves the account as
fixture setup and asserts the status, because case 3 is vacuous unless the insider is a
legitimately approved firm member.

## Results

| Case | Mutation | Ledger says | Ciphertext | Wrapped key |
|---|---|---|---|---|
| 1. Forged grant, cross-org | `INSERT` a `document_access` row for a user with no ledger grant | `false` | **403** | **403** |
| 2. Deleted grant | `DELETE` the row of a user who **does** hold a ledger grant | `true` | **200** | 403 |
| 3. Same-org insider | none — no row in either store | `true` | **200** | 403 |

Baselines: the cross-org attacker was denied (403) before any mutation; the genuine grantee
was served (200/200) before any mutation.

## Findings

1. **The headline claim holds, and is now measured rather than argued.** A forged
   `document_access` row granting `read` to a user with no ledger grant changed nothing: the
   database said `read`, the ledger said `false`, and the release path denied with 403. An
   attacker holding full write access to the operational database cannot obtain protected
   material. This is the first direct measurement of the property the paper is built on.

2. **The database cannot revoke, either.** Case 2 is the mirror image and is arguably the
   more interesting result: deleting a legitimate grant row did **not** stop ciphertext
   release, because the ledger grant still authorizes. Database mutation is powerless in
   both directions on the ciphertext path, which is the claim working as intended — but it
   also means operators must not treat a database edit as a revocation. Revocation has to go
   through the ledger path (Experiments 16 and 16b). The wrapped-key endpoint behaves
   differently, returning 403, because it is gated on the operational row; that asymmetry is
   by design but is easy to misread as "access was revoked."

3. **The organization fallback was confirmed by measurement, then removed.** A LawFirmA
   member holding no grant in *either* store received the ciphertext (HTTP 200), because
   `CheckAccess` fell through to `doc.OwnerOrg == userOrg`. This is reviewer finding **M5**
   reproduced end to end rather than read off the source, and it bounded how far finding 1
   generalised: the ledger path was authoritative, but its policy was permissive within the
   owning organization. The exposure was limited to ciphertext — the wrapped key was
   refused because no per-recipient grant exists — matching what the manuscript claimed.

   The fallback has since been deleted (chaincode v1.19, sequence 9). Re-running this
   experiment against the fixed chaincode, case 3 becomes
   `ledger=false ciphertext=403 wrapped_key=403`: a member of the owning organization with
   no grant is denied outright. No compensating change was needed, because
   `RegisterDocument` already writes an explicit owner grant into the ACL, so
   upload-then-download continues to work; the legitimate cross-firm grantee in case 2 is
   still served (200/200), confirming the removal did not over-reach.

   | | before removal | after removal |
   |---|---|---|
   | same-org member, no grant | ledger `true`, ciphertext **200** | ledger `false`, ciphertext **403** |
   | owner | served | served |
   | explicitly granted cross-firm user | served | served |

   Evidence: `results/20260731_100639/` (before), `results/20260731_103055/` (after).

4. **Denied access attempts were not audited — found here and fixed.** On the first
   measured run, no audit record of any kind was written when `CheckAccess` returned false:
   the only events recorded for the document were `DOC_REGISTERED`, `ACCESS_GRANTED`, and
   `DOC_VIEWED`, all successes. In `DocumentService.enforceFabricAccessOrFailClosed` the
   policy-denial branch was `if (!allowed) throw new AccessDeniedException(...)` with no
   `auditService.log` call; only *outage* denials were audited, via
   `logFabricOutageAccessDenied`.

   This contradicted the manuscript, which states in the motivating scenario that
   "subsequent download attempts are denied **and audited**" (Scenario S1), and it meant a
   probing attacker left no trace: the forged-grant attack in case 1 was defeated but
   invisible. For a system whose value proposition is an auditable record for litigation,
   that is a substantive gap rather than a cosmetic one.

   A `logPolicyAccessDenied` call was added to that branch, emitting an `ACCESS_DENIED`
   event carrying the reason, the mode (`policy_denial`), and the requester's MSP. The
   experiment was re-run against the fixed backend: the same document now accumulates
   **3 denial events** where it previously recorded **0**, and each is anchored to the
   ledger (`fabric_tx_id` non-null) rather than existing only in PostgreSQL, so the denial
   trail carries the same tamper-evidence as the grant trail.

   Evidence for both states is retained: `results/20260731_090324/` is the pre-fix run
   showing `denial_events=0`, `results/20260731_100639/` the post-fix run showing
   `denial_events=3`.

## Not covered

- **`pk_ecies` substitution (Scenario S3).** The review's item 5 also suggests mutating a
  recipient's public key to demonstrate S3 concretely. Not attempted here: unlike an ACL row,
  a substituted key only pays off on a *subsequent* grant, so the case needs a grant issued
  after the mutation and a check of which key the wrapped token is bound to. It is a
  worthwhile separate case.
- The experiment measures the REST release path. It does not test a caller holding Fabric
  credentials who bypasses the gateway entirely.

## Consequences for the manuscript

- Finding 1 supplies the missing measurement for the paper's central security claim and
  should be cited wherever that claim is made.
- Finding 3 gives Table 4's intra-organization row and the RQ1 caveat direct evidence.
- Finding 4 no longer requires a manuscript correction, because the code was changed to
  match what Scenario S1 already claimed rather than the other way round. It is worth
  reporting as a measured property nonetheless: denials are now anchored, which is what
  makes "denied and audited" checkable by a consortium peer instead of taken on trust.

## Reproduce

```bash
# Prerequisites: 3-org network + backend up, demo users seeded.
# The backend MUST run with DOCUMENT_MATERIAL_DB_FALLBACK=false; under the dev.sh default
# of true, a Fabric failure would silently fall back to the very ACL being attacked.
bash experiments/db_acl_mutation/run.sh
# raw evidence: experiments/db_acl_mutation/results/<stamp>/
```

Every mutation is reverted by the runner; the fixture document is disposable, so the run is
safe to repeat.
