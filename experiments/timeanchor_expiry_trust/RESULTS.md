# Experiment 17 — TimeAnchor: Cost of Making Grant Expiry Clock-Trustworthy

**Status:** latency cost measured; staleness-ceiling sweep measured. The end-to-end
backdating demonstration is **not run** - see Not measured.

**Evidence run:** `results/20260730_193100/`. Linux x86_64, Fabric 2.4, 3-org
`legal-channel`, CouchDB state database, majority endorsement.

## Why this experiment exists

Reviewer finding **M2**: grant expiry is evaluated inside `CheckAccess`, which runs as a
Fabric *evaluate*. `GetTxTimestamp()` on an evaluate returns the timestamp the **client**
placed in its proposal, and under custodial submission that client is the application
gateway - the component the architecture claims to remove from the authorization TCB. A
compromised gateway could therefore backdate a proposal to satisfy an already-expired
`ExpiresAt`. The review asked for either a scoped claim or "a design ... with its cost
measured."

The design implemented is a **TimeAnchor**: `UpdateTimeAnchor` is a *submit*, so every
endorsing peer independently validates the heartbeat's timestamp against its own clock
before endorsing, and `CheckAccess` refuses proposals sitting more than
`MaxClockSkewSeconds` (120 s) behind the committed anchor. The anchor cannot be rewound by
the gateway; it can only be starved, which is what the staleness ceiling addresses.

## Measured: latency cost of the freshness read

`CheckAccess` now performs one additional world-state read (`GetState` on `TIMEANCHOR`) on
every call. Because this deployment uses CouchDB, that read is not free, and `CheckAccess`
sits on the paper's headline latency claim - so it was measured rather than assumed.

**Design.** Paired comparison across two chaincode deployments that differ *only* in whether
the freshness read executes, toggled by the `disableFreshnessCheckForMeasurement` constant
(a measurement control that ships as `false`). Same host, same fixture document, same active
cross-firm grant, same REST harness, back to back. The probe is the wrapped-key endpoint,
which exercises `CheckAccess` on the release path without IPFS retrieval in the path.

| Arm | Chaincode | n | P50 | mean | SD | P95 |
|---|---|---|---|---|---|---|
| Control (no freshness read) | v1.2 seq 3 | 150 | 7.25 ms | 7.34 ms | 0.82 ms | 8.66 ms |
| Treatment (freshness read)  | v1.3 seq 4 | 150 | **8.04 ms** | 8.37 ms | 1.47 ms | 10.65 ms |

**Cost: +0.78 ms at P50 (+10.8%), +1.03 ms at the mean.**
Mann-Whitney U = 17751.5, z = 8.65, p < 10⁻¹⁵ (tie-corrected normal approximation; reported
as a bound rather than the underflowed 0 the computation returns).

Unlike the Experiment 2 comparison this is a *difference* that should be reported as
significant rather than equivalent: the extra read genuinely costs something. The relevant
question for the paper is whether it costs enough to matter, and at 0.78 ms against RQ2's
50 ms interactivity threshold it does not.

> **Superseded as a statement about the current build (2026-08-01).** The same
> paired toggle re-run on chaincode v1.20 seq 10 (control) vs v1.21 seq 11
> (treatment), n = 200 per arm, found **no detectable cost**: mean difference
> −0.10 ms, 90 % CI [−0.63, +0.42], Mann-Whitney p = 0.75. The +0.78 ms above
> lies outside that interval. The two results are not directly contradictory —
> different chaincode generations, world state, and host session — but they
> cannot both be quoted as the freshness read's current price. For the shipped
> build the defensible claim is that the cost is not detectable and is bounded
> above by roughly 0.6 ms at 90 % confidence. A plausible but **unmeasured**
> mechanism is that `TIMEANCHOR` is now a hot key, rewritten every 60 s by the
> heartbeat and read by every `CheckAccess`, so it stays cached. See
> `experiments/function_latency_exp2/RESULTS.md`.

**These absolute numbers are not comparable to Experiment 2's 6.51 ms.** That figure comes
from a different harness and endpoint. Only the paired delta is transferable; if the paper
wants a revised absolute P50 for the release path, Experiment 2 must be re-run under its own
harness against v1.3.

### A discarded run, and why

`latency_anchor_off_DISCARDED_coldstart.txt` is a 100-sample control run showing
mean 26.58 ms, SD 160.80 ms, driven by a single 1618 ms sample at index 8. That is the
chaincode container's cold start immediately after redeployment, not release-path behaviour.

It was **re-run rather than trimmed**, under a stated rule fixed before looking at the
replacement values: *warm-up must absorb container cold start, and any run whose warm-up
demonstrably failed to do so is repeated in full, not filtered.* The warm-up went from 15 to
60 iterations and both arms were then measured under that identical protocol. The discarded
file is kept so the decision is auditable. This follows the practice the review asked for in
Experiment 13, where a re-run was performed with no stated a-priori criterion.

## Measured: the security/availability trade-off (Experiment 17b)

`MaxAnchorStalenessSeconds` is both halves of the trade-off at once. It is the
**availability window** - how long ordering can be unavailable before `CheckAccess` starts
refusing otherwise-valid decisions - and it sets the **backdating bound**, since a gateway
that withholds heartbeats can present a proposal at most (ceiling + `MaxClockSkewSeconds`)
behind real time before the decision is refused.

**Design.** For each ceiling: deploy the chaincode with that constant, commit one fresh
anchor, then stop feeding it and poll `CheckAccess` every 3 s until the decision flips from
authorised to refused. The elapsed time to that flip is the measured availability window.
Runner: `sweep-staleness-ceiling.sh`; evidence in `results/sweep_20260730_193634/`.

| Ceiling | Measured availability window | Implied backdating bound | Outcome |
|---|---|---|---|
| 30 s | **31 s** | 151 s | refused |
| 60 s | **59 s** | 179 s | refused |
| 120 s | **121 s** | 241 s | refused |
| 0 (disabled, shipped) | none within 200 s | unbounded by this mechanism | still authorising |

**Findings.**

1. **The ceiling is enforced, and it is the knob it claims to be.** Measured windows track
   the configured value to within the 3 s poll granularity (31/59/121 against 30/60/120).
   The relationship is linear and the constant means what it says.

2. **The trade-off is direct, not merely qualitative.** Every second of backdating tolerance
   bought is a second of outage tolerance surrendered, one for one. There is no setting that
   improves both: the two quantities are the same number read from opposite ends. This is
   the security-versus-availability curve the review notes was never attempted for
   Experiment 9, and its shape is a straight line with slope 1.

3. **Disabled behaves as designed.** With the ceiling at 0 the release path kept authorising
   for the full 200 s observation window with the anchor frozen throughout - reads survive an
   ordering outage, and the backdating bound degrades with the suppression interval instead.
   This is the shipped default, chosen for availability, and it is the weaker security
   posture of the two.

**What this does and does not establish.** It measures the *enforcement* of the ceiling and
the cost of enforcing it. It does not demonstrate an actual backdating attack being defeated;
the anchor here goes stale because heartbeats stop, which is the same observable condition a
suppressing gateway would create, but no backdated proposal was ever constructed. See below.

## Not measured

- **End-to-end backdating demonstration.** Neither the `peer` CLI nor the Java gateway SDK
  exposes the proposal timestamp - both set it from the local clock - so demonstrating a
  backdated proposal against a live peer requires hand-building and signing the proposal
  protobuf. Not attempted.
- **Heartbeat cost in throughput terms.** One submit per interval (default 60 s) against a
  measured capacity of 66-70 TPS is ~0.025% of capacity by arithmetic, but this has not been
  confirmed against a throughput run.

## Scope of the security claim, as currently evidenced

Stated plainly so the manuscript does not outrun the evidence:

1. **Measured:** the latency cost of the freshness read.
2. **Unit-tested only:** that `CheckAccess` refuses a proposal far behind the anchor, that
   the anchor refuses to move backwards, and that a live grant with a fresh or stale anchor
   is still authorised. These run against `shimtest.MockStub`.
3. **Argued, not tested:** that a compromised gateway cannot commit a backdated *anchor*.
   This rests on each endorsing peer validating the heartbeat timestamp against its own
   clock, and multi-peer endorsement is exactly what a single mock stub cannot exercise. The
   unit tests do not cover this property, and the live network has not been used to test it
   either.

Point 3 is the load-bearing security claim, and it is currently the least evidenced. The
manuscript should say so rather than let the presence of tests imply otherwise.

## Reproduce

```bash
# Prerequisites: 3-org network + backend up; a fixture document with an active grant.
# Write the JWT, docId to tok.txt / doc.txt alongside the script, then:
bash experiments/timeanchor_expiry_trust/measure-checkaccess-latency.sh anchor_on 150

# For the paired control, flip disableFreshnessCheckForMeasurement to true in
# pangochain-chaincode/legalcc/types.go and redeploy with an incremented sequence:
CC_VERSION=1.4 CC_SEQUENCE=5 bash pangochain-fabric/scripts/deploy-chaincode.sh
# Restore it to false and redeploy again afterwards - it must never ship as true.

# Staleness-ceiling sweep. Deploys once per ceiling, so pass a start sequence above
# whatever is currently committed (querycommitted will tell you):
PANGOCHAIN_SWEEP_DOC=$PWD/experiments/timeanchor_expiry_trust/doc.txt \
PANGOCHAIN_SWEEP_GRANTEE=$PWD/experiments/timeanchor_expiry_trust/grantee.txt \
PANGOCHAIN_SWEEP_START_SEQ=9 \
bash experiments/timeanchor_expiry_trust/sweep-staleness-ceiling.sh
```

The sweep orders its ceilings so the disabled case runs **last**, leaving both the network
and `types.go` in the shipped configuration when it finishes. Confirm before trusting a run:

```bash
docker exec fabric-cli peer lifecycle chaincode querycommitted -C legal-channel -n legalcc
grep -nP '^\t(MaxAnchorStalenessSeconds|disableFreshnessCheckForMeasurement) = ' \
  pangochain-chaincode/legalcc/types.go
```

State after the runs recorded here: **legalcc v1.18, sequence 8**, freshness check enabled,
staleness ceiling disabled (0), measurement control false - i.e. the shipping configuration.
Note the version string is cosmetic and derived from the sweep's sequence counter; the
sequence number is what Fabric's lifecycle actually orders on.
