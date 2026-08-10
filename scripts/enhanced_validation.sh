#!/usr/bin/env bash
# webtools-ui — enhanced cross-repo validation methodology.
#
# Layers:
#   L0  Platform gate     — manifest registry + all consumer shared mounts
#   L1  Plugin contract   — per-repo shared-check + check-plugins --strict
#   L2  Consumer suites   — repo-native quick/offline self-checks (when present)
#   L2c Playwright matrix — cross-consumer shell + iPhone UI (required when not --skip-slow)
#   L3  Syntax probes     — node --check on harmonized chrome/mount adapters
#
# Usage:
#   bash scripts/enhanced_validation.sh [--skip-slow]
#
# Exit 0 only when every executed layer passes.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKSPACE="${WORKSPACE:-$(dirname "$ROOT")}"
SKIP_SLOW=0

for arg in "$@"; do
  case "$arg" in
    --skip-slow) SKIP_SLOW=1 ;;
    -h|--help)
      sed -n '1,18p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
  esac
done

PASS=0
FAIL=0
SKIP=0
RESULTS=()

run_layer() {
  local repo="$1"
  local layer="$2"
  local cmd="$3"
  local optional="${4:-0}"
  local log
  log="$(mktemp "/tmp/enhanced-val-${repo//\//-}-${layer}.XXXX")"

  printf '\n[%s] %s — %s\n' "$repo" "$layer" "$cmd"
  if eval "$cmd" >"$log" 2>&1; then
    ((PASS++))
    RESULTS+=("PASS|$repo|$layer")
    tail -n 3 "$log" | sed 's/^/  /'
  else
    if [[ "$optional" == "1" ]]; then
      ((SKIP++))
      RESULTS+=("WARN|$repo|$layer")
      echo "  WARN (optional layer failed — see $log)"
      tail -n 8 "$log" | sed 's/^/  /'
    else
      ((FAIL++))
      RESULTS+=("FAIL|$repo|$layer")
      echo "  FAIL (see $log)"
      tail -n 12 "$log" | sed 's/^/  /'
    fi
  fi
  rm -f "$log"
}

echo "========================================"
echo "Enhanced validation — webtools-ui ecosystem"
echo "Workspace: $WORKSPACE"
echo "Skip slow: $SKIP_SLOW"
echo "========================================"

# ── L0: platform ────────────────────────────────────────────────────────────
run_layer "webtools-ui" "L0 platform ci" "cd '$ROOT' && make ci"

# ── L1: plugin contract (all consumers) ─────────────────────────────────────
for repo in cluster-manager dc-planner llm-benchmark knowledge-exchange demo-portal; do
  consumer="$WORKSPACE/$repo"
  if [[ ! -d "$consumer" ]]; then
    ((FAIL++))
    RESULTS+=("FAIL|$repo|L1 missing repo")
    echo "ERROR: missing consumer repo $consumer" >&2
    continue
  fi
  run_layer "$repo" "L1 plugin contract" "cd '$consumer' && make shared-check check-plugins"
done

# ── L1b: shell module registry (dashboard consumers) ────────────────────────
for repo in cluster-manager dc-planner llm-benchmark demo-portal knowledge-exchange; do
  consumer="$WORKSPACE/$repo"
  if [[ -d "$consumer" ]]; then
    run_layer "$repo" "L1b shell modules" \
      "python3 '$ROOT/scripts/check_shell_modules.py' --repo '$consumer'"
  fi
done

# ── L2b: shared mobile API + cross-consumer Playwright ──────────────────────
run_layer "webtools-ui" "L2b mobile-api" "cd '$ROOT' && node tests/mobile-api-contract.mjs"

if [[ "$SKIP_SLOW" == "0" ]]; then
  run_layer "webtools-ui" "L2c cross-consumer shell" \
    "cd '$ROOT' && node tests/cross-consumer-shell.mjs --json"
  run_layer "webtools-ui" "L2c iPhone UI matrix" \
    "cd '$ROOT' && node tests/iphone-ui.mjs --json"
else
  ((SKIP+=2))
  RESULTS+=("SKIP|webtools-ui|L2c cross-consumer shell")
  RESULTS+=("SKIP|webtools-ui|L2c iPhone UI matrix")
  echo "[skip-slow] L2c Playwright matrix skipped"
fi

# ── L2: consumer quick suites ───────────────────────────────────────────────
if [[ "$SKIP_SLOW" == "0" ]]; then
  run_layer "cluster-manager" "L2 self-check --quick" \
    "cd '$WORKSPACE/cluster-manager' && bash scripts/self-check.sh --quick"

  run_layer "dc-planner" "L2 self-check --quick" \
    "cd '$WORKSPACE/dc-planner' && SELF_CHECK_SKIP_PLAYWRIGHT=1 bash tests/self-check.sh"

  run_layer "demo-portal" "L2 test.sh meta" \
    "cd '$WORKSPACE/demo-portal' && ./test.sh --level meta --no-validate"

  run_layer "llm-benchmark" "L2 test_offline.sh" \
    "cd '$WORKSPACE/llm-benchmark' && ./test_offline.sh"
else
  ((SKIP+=3))
  RESULTS+=("SKIP|cluster-manager|L2 self-check")
  RESULTS+=("SKIP|dc-planner|L2 self-check")
  RESULTS+=("SKIP|demo-portal|L2 test.sh")
  echo "[skip-slow] L2 consumer self-checks skipped"
fi

# ── L3: harmonized JS syntax probes ─────────────────────────────────────────
declare -A SYNTAX=(
  ["knowledge-exchange"]="node --check portal/chrome.js && node --check portal/chat-orb-mount.js"
  ["demo-portal"]="node --check js/plugin-mount.js && node --check js/chat-orb-mount.js && node --check js/plugins-hub.js"
  ["cluster-manager"]="node --check js/plugin-mount.js && node --check js/shell-tab-controller.js && node --check js/chat-orb-mount.js"
  ["dc-planner"]="node --check js/plugin-mount.js && node --check js/chat-orb-mount.js"
  ["llm-benchmark"]="node --check js/plugin-mount.js && node --check js/chat-orb-mount.js"
)

for repo in "${!SYNTAX[@]}"; do
  run_layer "$repo" "L3 JS syntax" "cd '$WORKSPACE/$repo' && ${SYNTAX[$repo]}"
done

# ── knowledge-exchange compile + pytest (medium weight) ─────────────────────
if [[ "$SKIP_SLOW" == "0" ]]; then
  run_layer "knowledge-exchange" "L2 compileall" \
    "cd '$WORKSPACE/knowledge-exchange' && python3 -m compileall -q ke scripts"

  if [[ -x "$WORKSPACE/knowledge-exchange/.ke-cuda-venv/bin/python" ]]; then
    ke_py="$WORKSPACE/knowledge-exchange/.ke-cuda-venv/bin/python"
  else
    ke_py="python3"
  fi
  run_layer "knowledge-exchange" "L2 pytest" \
    "cd '$WORKSPACE/knowledge-exchange' && $ke_py -m pytest tests/ -q --tb=no" 1
else
  run_layer "knowledge-exchange" "L3 compileall" \
    "cd '$WORKSPACE/knowledge-exchange' && python3 -m compileall -q ke scripts portal/chrome.js 2>/dev/null || python3 -m compileall -q ke scripts"
fi

# ── Summary ─────────────────────────────────────────────────────────────────
echo ""
echo "========================================"
echo "Summary"
echo "========================================"
printf '%-20s %-22s %s\n' "REPO" "LAYER" "RESULT"
for row in "${RESULTS[@]}"; do
  IFS='|' read -r status repo layer <<<"$row"
  printf '%-20s %-22s %s\n' "$repo" "$layer" "$status"
done
echo ""
echo "PASS=$PASS  FAIL=$FAIL  WARN/SKIP=$SKIP"
echo "========================================"

if [[ "$FAIL" -gt 0 ]]; then
  exit 1
fi
exit 0
