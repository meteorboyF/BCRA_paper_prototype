# Fail-Closed Fabric Outage Run

Generated: 2026-06-08T12:57:17Z

This run measures document ciphertext requests while Fabric peers are stopped.
Expected outage behavior is HTTP 503 denial, zero protected bytes, and
FABRIC_OUTAGE_ACCESS_DENIED audit rows with zero ACL_FABRIC_FALLBACK rows.

Files:
- summary.json
- per_second.csv
- requests.csv
- audit_counts.json
- environment.json
- fig_failclosed_outage.pdf/png, if plotting dependencies are available
