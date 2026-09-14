#!/usr/bin/env bash
# Claim a task. The file IS the lock. Usage: .work/claim.sh T-18 <owner>
cd "$(dirname "$0")" || exit 1
set -o noclobber
cat TEMPLATE.md > "$1.md" 2>/dev/null \
  || { echo "$1 is already claimed:"; head -6 "$1.md"; exit 1; }
sed -i "s/^id:.*/id: $1/; s/^owner:.*/owner: ${2:-unknown}/; s/^claimed:.*/claimed: $(date -u +%F)/" "$1.md"
echo "claimed $1"
