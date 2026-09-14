# Run manifest — 2026-09 hardening campaign (audit responses)

All runs below were measured on the second host: Intel Core i5-1035G1, 14 GB
RAM, Linux (`uname -srm` per each run's environment.json), Docker-hosted
Fabric 2.4 network (3 orgs, 3 Raft orderers), Kubo IPFS, PostgreSQL 16 in a
container on host port 5433. The original campaign's host (Core Ultra 5 125H,
8 GB) is documented in the paper's testbed section; no figure mixes hosts.

A provenance caveat, disclosed rather than repaired: the 2026-09-07
environment records capture the repository HEAD at run time, and for the
sweep and first reruns that HEAD (`7ec7556`) predates the commit of the code
under test — the repaired code was present in the working tree but not yet
committed. The 2026-09-14 runs were taken with the repaired code present as
uncommitted working-tree changes on top of `fc662f1` and are superseded run
records only where noted; their binaries are reproducible from the branch
tip at the commit that follows this manifest.

| Run family | Date | Chaincode | Gateway build | What it measures |
|---|---|---|---|---|
| `timeanchor_expiry_trust/results/sweepv2_20260907_201505` | 09-07 | legalcc v1.29–1.32, seq 9–12 (one deploy per ceiling), peer-clock freshness | heartbeat stopped; no gateway | staleness ceiling enforcement (S1 repair) |
| `timeanchor_expiry_trust/results/unit_redgreen_20260908` | 09-08 | source-level, `fabric-ccenv:2.4 go test` | n/a | red on old circular check, green on peer-clock check + replay test |
| `outbox_forgery_20/results/20260914_*` | 09-14 | legalcc v1.33 seq 13 (command-id closure) | jar w/ signed outbox (id-covered HMAC), secret configured | forged / retargeted / replayed outbox rows (S2 + replay) |
| `pubkey_substitution_19/results/20260914_*` | 09-14 | legalcc v1.33 seq 13 | same | substitution + full-client-flow restore race (S4), immutability, unbound posture |
| `orderer_outage_reconciliation_16b/results/20260914_*` | 09-14 | legalcc v1.33 seq 13 | same | revoke divergence windows, final build, n=5 |
| `grant_outage_reconciliation_18/results/{grant,fifo}_20260914_*` | 09-14 | legalcc v1.33 seq 13 | same | grant divergence n=5; mixed-queue FIFO n=2 |
| superseded: `orderer_outage_reconciliation_16b/results/20260907_*`, `grant_outage_reconciliation_18/results/*_20260907_*`, `*_20260831_*` | 09-07 / 08-31 | pre-final builds | pre-final jars | same protocols on superseded code; retained |

Gateway launch for the 09-14 runs:
`java -jar target/pangochain-backend-2.0.0.jar --server.port=8080
--DB_PORT=5433 --DB_PASSWORD=... --access.outbox-hmac-secret=<set>
--documents.material-db-fallback-enabled=false`

Consolidated statistics: `consolidated/build_table_v2.py` (central median,
10,000-resample bootstrap percentile CI, seed 42, single sequential RNG
stream — reproduce by running the script, not by re-seeding per row).

Manuscript build: Tectonic 0.15.0, `tectonic --keep-intermediates main.tex`;
the final build log is released alongside the PDF.
