# Two-Host Validation — Client Bundle (runs on the GENERATOR machine)

Purpose: one cross-host datapoint answering the reviewer objection that
co-locating the load generator with the network distorted the published
throughput. The **network stays on the original server host**; this
bundle runs on a separate physical machine on the same LAN (wired
preferred — if Wi-Fi, record it in `environment.json`'s
`network_note`). Never run the network here; never substitute a
VM/container for this machine.

The harness (`loadtest.js`) is the canonical duration60s closed-loop
tool from the campaign, byte-faithful except that the gateway URL is
parameterized (the original hardcoded localhost:8080).

## Reference values being validated (co-located, committed)

- **Config A** — BatchTimeout=500 ms, MaxMessageCount=500, conc 50,
  duration60s, 1 discarded warm-up + 10 trials:
  **193.0 TPS, 95 % CI [182.8, 203.2]**
  (`results/exp_batchtimeout_sens.summary.json`).
- **Config B** — BatchTimeout=2 s, same tool, conc 50, 1 warm-up +
  5 trials: **66.3 TPS mean [63.7, 68.9]**
  (`results/exp1_throughput.summary.json`, duration60s row).

The server session rebuilds the network at the right BatchTimeout
before each block and tells you (via the user) when to start.

## One-time setup

```bash
git clone https://github.com/meteorboyF/Fardeen_Codex_Dhaka_Meetup_Hackathon.git
cd Fardeen_Codex_Dhaka_Meetup_Hackathon
git checkout linux-validation
cd experiments/twohost_validation/client_bundle
cp config.env.example config.env   # fill URL + FIRM_ID from the server session
source config.env
python3 setup_bench_data.py > creds.env   # idempotent; see note below
source creds.env
```

Activation note: fresh registrations start PENDING_APPROVAL. The
server session activates the bench user on its side with:
`docker exec pangochain-postgres psql -U pangochain -d pangochain -c
"UPDATE users SET status='ACTIVE' WHERE email='bench@pangochain.test';"`
— then rerun `setup_bench_data.py`.

## Config A (server at 500 ms BatchTimeout) — run when told "RUN CONFIG A"

```bash
source config.env && source creds.env
bash run_trials.sh A 10
```

## Config B (server at 2 s BatchTimeout) — run when told "RUN CONFIG B"

```bash
source config.env && source creds.env
bash run_trials.sh B 5
```

Each block automatically records: 100 ping-RTT samples to the server
before AND after the block, one discarded warm-up trial, the N measured
trials with per-trial client CPU% (GNU `time -v`), `trials.csv`, raw
per-trial logs, and `environment.json` (edit its `network_note` field
to say wired/Wi-Fi before committing).

## After each block

```bash
cd ../../..   # repo root
git add experiments/twohost_validation/results/
git commit -m "twohost: config <A|B> client trials"
git push origin linux-validation
```

Then tell the user to relay completion to the server session, which
pulls, sanity-checks, and (after Config B) computes the comparison in
`experiments/twohost_validation/RESULTS.md`.

**Never fabricate or retouch numbers. If a trial fails, its row records
the failure — that is the correct outcome.**
