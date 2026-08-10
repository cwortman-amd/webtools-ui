#!/usr/bin/env bash
# webtools-ui — cross-consumer smoke: L0 node contracts + L2 mobile/shell Playwright.
#
# Usage:
#   bash scripts/run_cross_consumer_smoke.sh
#   bash scripts/run_cross_consumer_smoke.sh --skip-playwright
#   WEBTOOLS_UI_CONSUMERS=dc-planner bash scripts/run_cross_consumer_smoke.sh
#
# Exit 0 only when every executed check passes.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKSPACE="${WORKSPACE:-$(dirname "$ROOT")}"
SKIP_PW=0

for arg in "$@"; do
  case "$arg" in
    --skip-playwright) SKIP_PW=1 ;;
    -h|--help)
      sed -n '1,10p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
  esac
done

export WORKSPACE
PASS=0
FAIL=0

run_step() {
  local name="$1"
  local cmd="$2"
  printf '\n[smoke] %s\n' "$name"
  if eval "$cmd"; then
    ((PASS++))
    echo "  PASS"
  else
    ((FAIL++))
    echo "  FAIL"
  fi
}

echo "========================================"
echo "Cross-consumer smoke — webtools-ui"
echo "Workspace: $WORKSPACE"
echo "Skip Playwright: $SKIP_PW"
echo "========================================"

run_step "L0 shared node tests" "cd '$ROOT' && node --test tests/lib/*.test.mjs"
run_step "L0 mobile-api contract" "cd '$ROOT' && node tests/mobile-api-contract.mjs"

if [[ "$SKIP_PW" == "0" ]]; then
  run_step "L2 cross-consumer shell regression" \
    "cd '$ROOT' && node tests/cross-consumer-shell.mjs --json"
  run_step "L2 iPhone UI matrix" \
    "cd '$ROOT' && node tests/iphone-ui.mjs --json"
else
  echo "[skip] Playwright layers skipped (--skip-playwright)"
fi

echo ""
echo "========================================"
echo "Smoke summary: PASS=$PASS  FAIL=$FAIL"
echo "========================================"

[[ "$FAIL" -eq 0 ]]
