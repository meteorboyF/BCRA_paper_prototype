# Equivalence testing for the ledger-vs-database access decision (reviewer M7 / item 6)

## The problem

Experiment 2 reported Mann-Whitney *U* = 4500.0, *p* = 0.22 and concluded the ledger check
was "statistically indistinguishable" from a PostgreSQL-only ACL. Failure to reject the null
is not evidence of equivalence, and the review is right that the claim is unsupportable as
written. RQ2 already fixes a margin — 50 ms — so the correct instrument is a two one-sided
tests (TOST) procedure against that margin.

## Result

Computed from the Experiment 14b run's per-request samples
(`results/20260731_150414/samples.csv`), concurrency 10, successful requests only:

| Arm | n | P50 | mean | SD |
|---|---|---|---|---|
| On-path, ledger `CheckAccess` decides | 1000 | 16.55 ms | 21.16 ms | 13.70 ms |
| PostgreSQL ACL decides | 1000 | 15.52 ms | 25.24 ms | 26.49 ms |

Mean difference (on-path minus database) = **−4.08 ms**.
90 % confidence interval on the difference = **[−5.63, −2.52] ms**, lying entirely inside
±50 ms.

**TOST against the pre-specified ±50 ms margin: equivalent** (both one-sided tests
*p* < 10⁻¹⁵; the computation underflows to 0 and is reported as a bound rather than as zero).

So the claim survives, but it is now the claim the evidence actually supports: not "we failed
to find a difference" but "the difference is bounded well inside the margin that matters."
Note the direction is mildly counter-intuitive — the on-path arm has the *lower* mean, while
the database arm has the higher one and roughly double the standard deviation, because its
asynchronous anchoring work lands unevenly on the request path.

## Scope — what this does and does not replace

This is the **end-to-end request comparison** at concurrency 10, taken from a load run. It is
**not** the function-level isolation that produced Experiment 2's headline 6.51 vs 7.16 ms
figures, which came from a different harness (`measure-latency.sh`, sequential, n = 100).
Those numbers are still outstanding for re-measurement, and they need it independently: since
they were taken, `CheckAccess` has gained the time-anchor freshness read (+0.78 ms, Experiment
17), lost the organization fallback (M5), and begun anchoring denials.

Two consequences for the manuscript:

1. The equivalence claim can and should be restated with TOST, as above.
2. The 6.51 / 7.16 ms figures must not be presented alongside this TOST as if the test
   validated them — the test was run on different data. Either re-run `measure-latency.sh`
   on the current build and apply TOST to that, or scope the old figures to the build that
   produced them.

## Reproduce

```bash
python3 - <<'PY'
# see the commit for the full script; reads samples.csv, filters conc=10 & status=200,
# and runs TOST on the two arms against a 50 ms margin.
PY
```
