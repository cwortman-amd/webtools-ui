#!/usr/bin/env bash
# webtools-ui — CI plugin gate: validate manifests and consumer shared mounts.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKSPACE="${WORKSPACE:-$(dirname "$ROOT")}"

cd "$ROOT"

echo "[ci] plugin manifest registry (--strict)"
python3 scripts/check_plugin_manifests.py --strict --workspace "$WORKSPACE"

declare -A PROFILE=(
  [cluster-manager]=dashboard
  [dc-planner]=dashboard
  [llm-benchmark]=dashboard
  [knowledge-exchange]=catalog
  [demo-portal]=hub
)

for repo in "${!PROFILE[@]}"; do
  consumer="$WORKSPACE/$repo"
  if [[ ! -d "$consumer" ]]; then
    echo "ERROR: missing consumer repo: $consumer" >&2
    exit 1
  fi
  echo "[ci] shared mount ($repo / ${PROFILE[$repo]})"
  python3 scripts/check_shared_mount.py --profile "${PROFILE[$repo]}" --root "$consumer"
done

echo "[ci] PASS"
