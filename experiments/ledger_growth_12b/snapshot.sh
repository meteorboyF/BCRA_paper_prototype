#!/usr/bin/env bash
# One ledger-size sample: block height + peer block store + CouchDB state DB.
#
# Identical measurement points to Experiment 12's `disk_row`
# (experiments/ledger_growth/run.sh) so the two campaigns are directly
# comparable: same peer, same CouchDB, same `du -sb` paths.
#
#   snapshot.sh <csv-path> <phase-label>
set -euo pipefail

CSV="${1:?usage: snapshot.sh <csv> <label>}"
LABEL="${2:?usage: snapshot.sh <csv> <label>}"
PEER_CONTAINER="peer0.firma.pangochain.com"
COUCH_CONTAINER="couchdb.firma"

prod="$(docker exec "$PEER_CONTAINER" du -sb /var/hyperledger/production | cut -f1)"
chains="$(docker exec "$PEER_CONTAINER" du -sb /var/hyperledger/production/ledgersData/chains | cut -f1)"
couch="$(docker exec "$COUCH_CONTAINER" du -sb /opt/couchdb/data | cut -f1)"
height="$(docker exec fabric-cli peer channel getinfo -c legal-channel 2>/dev/null \
  | grep -o '"height":[0-9]*' | cut -d: -f2 || echo '')"

if [[ ! -f "$CSV" ]]; then
  echo "phase,epoch_s,iso,block_height,peer_production_bytes,blockstore_bytes,couchdb_bytes" > "$CSV"
fi
echo "$LABEL,$(date +%s),$(date -Iseconds),$height,$prod,$chains,$couch" >> "$CSV"
echo "[snap] $LABEL height=$height blockstore=$chains couchdb=$couch production=$prod"
