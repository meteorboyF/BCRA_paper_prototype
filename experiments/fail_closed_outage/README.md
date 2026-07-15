# Fail-Closed Fabric Outage Experiment

## Purpose

Validate the strict fail-closed access-control claim for protected document material:
when Fabric `CheckAccess` is unavailable, document ciphertext must not be served,
wrapped keys must not be served, PostgreSQL ACL fallback must not authorize access,
and `FABRIC_OUTAGE_ACCESS_DENIED` must be logged.

## Prerequisites

- Docker / Docker Compose.
- Java and Node.js.
- PostgreSQL, IPFS, Fabric, chaincode, and backend available through the normal PangoChain setup.
- A user/document with valid access. The script calls `experiments/setup-bench-data.py` if
  `PANGOCHAIN_JWT_TOKEN` and `PANGOCHAIN_TEST_DOC_ID` are not already set.

## Run

```bash
bash experiments/fail_closed_outage/run.sh
```

Useful overrides:

```bash
PANGOCHAIN_CONCURRENCY=50 \
PANGOCHAIN_PRE_OUTAGE_SECONDS=30 \
PANGOCHAIN_OUTAGE_SECONDS=45 \
PANGOCHAIN_POST_RECOVERY_SECONDS=60 \
bash experiments/fail_closed_outage/run.sh
```

After changing backend code, force the experiment to restart the backend process
started by `scripts/dev.sh`:

```bash
PANGOCHAIN_FORCE_BACKEND_RESTART=1 bash experiments/fail_closed_outage/run.sh
```

## Outage Method

The default outage method stops the three Fabric peer containers:

```text
peer0.firma.pangochain.com peer0.firmb.pangochain.com peer0.regulator.pangochain.com
```

Override with:

```bash
PANGOCHAIN_FABRIC_PEERS="peer0.firma.pangochain.com peer0.firmb.pangochain.com peer0.regulator.pangochain.com"
```

## Outputs

Each run writes to:

```text
experiments/fail_closed_outage/results/YYYYMMDD_HHMMSS/
```

Files:

- `summary.json`
- `per_second.csv`
- `requests.csv`
- `audit_counts.json`
- `environment.json`
- `README.md`
- `fig_failclosed_outage.pdf` and `fig_failclosed_outage.png` when matplotlib is available

## Pass Criteria

During outage:

- successful downloads: `0`
- unauthorized protected-material releases: `0`
- HTTP 503 responses: `> 0`
- `FABRIC_OUTAGE_ACCESS_DENIED` rows: at least the number of 503 denials
- `ACL_FABRIC_FALLBACK` rows: `0`

After recovery:

- successful downloads resume
- no fallback success is observed

## Limitations

The load generator exercises `GET /api/documents/{id}/ciphertext`. Backend unit tests cover
both ciphertext and wrapped-key protected-material gates. If a paper run needs independent
wrapped-key outage timing, add a second workload target for `/wrapped-key`.
