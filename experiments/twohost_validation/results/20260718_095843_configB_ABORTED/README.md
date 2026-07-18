# ABORTED — not used in analysis

First Config B attempt, aborted when the client laptop (Vivobook) shut
down mid-block. Preserved for completeness, per campaign practice.

What exists vs. a complete block:

- `ping_pre.txt` — complete (100/100 samples).
- Warm-up + trial 1 recorded in `trials.csv` (warmup 67.0 TPS,
  trial 1 67.0 TPS, 0 errors).
- Trial 2 was in flight at shutdown: its `.out`/`.time` files exist
  but it has **no row** in `trials.csv`.
- Trials 3–5, `ping_post.txt`, and `environment.json` were never
  produced.

The verified full rerun used in the analysis is
`../20260718_101840_configB/`.
