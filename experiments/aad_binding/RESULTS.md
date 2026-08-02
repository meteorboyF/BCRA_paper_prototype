# Experiment 6b — cost of binding recipient identity as AAD (reviewer item 20)

- **Reviewer item:** 20 (bind AAD; "re-run Exp. 6 to confirm" it costs nothing
  measurable).
- **Evidence run:** `results/20260802083236/`
- **Reproduce:** `node bench.mjs --reps 300`

## Result

| Arm | n | P50 | mean | SD |
|---|---|---|---|---|
| wrap, AAD bound | 300 | 0.3973 ms | 0.4475 | 0.1420 |
| wrap, unbound | 300 | 0.3987 ms | 0.4475 | 0.1434 |
| unwrap, AAD bound | 300 | 0.2967 ms | 0.3572 | 0.1248 |
| unwrap, unbound | 300 | 0.3021 ms | 0.3568 | 0.1294 |

- **wrap:** AAD costs **+0.0000 ms** at the mean, 90 % CI [−0.019, +0.019]
- **unwrap:** AAD costs **+0.0004 ms** at the mean, 90 % CI [−0.017, +0.018]
- **Token size unchanged at 125 bytes.** AAD is authenticated, not transmitted.
  The benchmark asserts this and exits non-zero if it ever stops holding, because
  the manuscript quotes the 125-byte figure.
- **Binding is enforced**: a bound token presented without the AAD fails to
  decrypt. Asserted in the harness, not assumed.

The review's expectation is confirmed: binding costs nothing measurable, bounded
within ±0.02 ms at 90 % confidence.

## The first run was wrong, and how

The initial run reported unwrap costing **+0.042 ms**, 90 % CI [+0.023, +0.062]
— apparently a real, statistically clear cost. It was an artefact. Each
iteration ran the AAD arm first and the unbound arm second, so the unbound arm
always benefited from a warmed cache. At an effect size of hundredths of a
millisecond that ordering dominated the measurement.

Alternating the order within each pair collapsed both deltas to zero. The
flattering-looking "measured cost" was entirely an artefact of arm ordering.
Recorded here because a result that had survived into the write-up would have
been wrong in a way no reader could have detected.

## Why this and not a full Experiment 6 re-run

The review said "re-run Exp. 6 to confirm". This measures the question directly
instead, for two reasons. A wholesale re-run overwrites
`results/exp6_crypto.*` — the canonical bundle the manuscript quotes for PBKDF2,
AES-GCM, and token size — replacing numbers measured in an earlier campaign with
numbers from this host session, which is a change to published results that the
AAD question does not require. And it would confound the AAD comparison with
whatever else differs between campaigns. Here both arms run interleaved in one
process, so the comparison is paired and the host is constant by construction.

## What was NOT measured

**This is the Node WebCrypto runtime, not a browser.** Same limitation Exp 6
carries and states: `node v20.20.2` `webcrypto`, not browser WebCrypto. The
conclusion (no measurable cost) is unlikely to be runtime-specific, since AAD
adds a few dozen authenticated bytes to an existing GCM operation, but it is not
a browser measurement.

**No end-to-end application measurement.** This benchmarks the primitive. It
does not measure the grant or download flows, so it does not confirm that
threading the recipient id through the application costs nothing — only that the
cryptography does.

**The security benefit is partial while the legacy fallback exists.** See below.

## Implementation notes that matter for the claim

The review estimated "five lines in the frontend wrap plus the backend unwrap",
about two hours. Four things in the codebase make it more than that, and they
bound what the change can currently claim:

1. **There is no backend unwrap.** Wrapping and unwrapping are entirely
   client-side (`pangochain-frontend/src/lib/crypto.ts`); the backend only ever
   stores and returns opaque tokens. The change is frontend-only, across 19 call
   sites in 13 files.
2. **`docID` cannot be bound on the upload path.** The owner's key is wrapped
   before `POST /documents/upload` returns, and the document id is assigned by
   the backend, so it does not exist at wrap time. Binding it would require
   client-generated document identifiers — a design change. **Only the recipient
   id is bound.** That defeats re-targeting a token to a different principal; it
   does not defeat replaying a token from one document to another for the *same*
   principal.
3. **Legacy tokens cannot be migrated server-side.** Private keys never leave the
   client, so existing grants can only be re-wrapped when the holder next
   reissues them. `eciesUnwrapKey` therefore falls back to the unbound form and
   logs a warning. The format is byte-identical, so a legacy token cannot be
   distinguished by inspection — meaning the fallback is a transitional
   weakness, not merely a compatibility shim. Set `allowUnboundLegacy = false`
   once outstanding grants have been reissued.
4. **A version byte would have broken the 125-byte figure.** Distinguishing
   bound from legacy tokens by a format marker would change the token size the
   manuscript reports in the abstract-adjacent claim and in Table 2. Binding via
   AAD avoids this precisely because AAD is authenticated but not transmitted.

## Verification

- `npx tsc --noEmit` — clean. This is what catches a call site where the
  recipient id is not in scope; the parameter is optional, so a missed site
  compiles but silently produces an unbound token, and every site was checked by
  grep as well.
- `npx vitest run` — 81 tests pass across 15 files, including two new ones: that
  a bound token fails under a different identity with the fallback disabled, and
  that binding leaves the token at 125 bytes.
