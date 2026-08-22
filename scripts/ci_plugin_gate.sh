#!/usr/bin/env bash
# webtools-ui — CI plugin gate: validate manifests and consumer shared mounts.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKSPACE="${WORKSPACE:-$(dirname "$ROOT")}"

cd "$ROOT"

echo "[ci] plugin manifest registry (--strict)"
python3 scripts/check_plugin_manifests.py --strict --workspace "$WORKSPACE"

echo "[ci] demo-portal registry snapshot (--strict)"
python3 scripts/sync_plugin_registry_snapshot.py --strict --workspace "$WORKSPACE"

declare -A PROFILE=(
  [cluster-manager]=dashboard
  [dc-planner]=dashboard
  [llm-benchmark]=dashboard
  [knowledge-exchange]=catalog
  [demo-portal]=hub
  [slide-presenter]=dashboard
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

echo "[ci] modular infrastructure (L1c)"
python3 scripts/check_extensions.py --workspace "$WORKSPACE"
python3 scripts/check_mcp_registration.py --strict --workspace "$WORKSPACE"
python3 scripts/check_agent_gateway.py --workspace "$WORKSPACE"

echo "[ci] PASS"
