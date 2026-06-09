#!/usr/bin/env bash
# Generates a new IPFS private swarm key.
# Run ONCE and share the resulting pangochain-ipfs/swarm.key with your team
# via a secrets manager (never commit to git).

OUTDIR="$(dirname "$0")/../pangochain-ipfs"
OUTFILE="$OUTDIR/swarm.key"

mkdir -p "$OUTDIR"

if [ -f "$OUTFILE" ]; then
  echo "swarm.key already exists at $OUTFILE — delete it first if you want to regenerate."
  exit 0
fi

# Generate 32 random bytes as hex
KEY_HEX=$(node -e "process.stdout.write(require('crypto').randomBytes(32).toString('hex'))")

cat > "$OUTFILE" <<EOF
/key/swarm/psk/1.0.0/
/base16/
$KEY_HEX
EOF

echo "✅ swarm.key written to $OUTFILE"
echo ""
echo "IMPORTANT: Share this file with your team via a secure channel (not git)."
echo "Everyone running the project needs the SAME swarm.key to connect to the private IPFS swarm."
