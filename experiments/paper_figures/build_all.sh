#!/usr/bin/env bash
# Regenerate every paper figure from its own folder. Each figure is self-contained:
# fig*/make.py reads fig*/data/ and writes fig*/out/{pdf,png}. Shared style lives in
# pangostyle.py. Point PY at a Python with matplotlib/numpy (a venv is fine).
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PY="${PANGO_PY:-python3}"
for d in "$HERE"/fig*/; do
  [ -f "$d/make.py" ] || continue
  echo "== $(basename "$d")"
  ( cd "$d" && "$PY" make.py )
done
echo "all figures rebuilt"
