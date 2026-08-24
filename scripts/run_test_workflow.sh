#!/usr/bin/env bash
# Agent-agnostic test workflow. Run from any repo root with no Cursor/Gemini/Hermes.
#
# Discovers make targets or common test entrypoints. Exit 1 if nothing runnable.
set -euo pipefail

ROOT="$(pwd)"
if [ -n "${1:-}" ] && [ -d "$1" ]; then
  ROOT="$(cd "$1" && pwd)"
  shift
fi
cd "$ROOT"

have_make_target() {
  [ -f Makefile ] || return 1
  make -q "$1" >/dev/null 2>&1
  local st=$?
  [ "$st" -eq 0 ] || [ "$st" -eq 1 ]
}

run() {
  printf '==> %s\n' "$*"
  "$@"
}

ran=0

if have_make_target adversarial-preflight; then
  run make adversarial-preflight
  ran=1
elif have_make_target check-linkage; then
  run make check-linkage
  ran=1
fi

if have_make_target coverage-snapshot; then
  run make coverage-snapshot
  ran=1
fi

if have_make_target coverage-intelligence; then
  run make coverage-intelligence
  ran=1
fi

if have_make_target ci; then
  run make ci
  ran=1
elif have_make_target test; then
  run make test
  ran=1
elif [ -x ./test.sh ]; then
  run ./test.sh "$@"
  ran=1
elif [ -f package.json ] && command -v npm >/dev/null && npm run | grep -qE '^  test$'; then
  run npm test
  ran=1
elif command -v pytest >/dev/null && [ -d tests ]; then
  run pytest tests -q
  ran=1
fi

if [ "$ran" -eq 0 ]; then
  echo "no test entry found in ${ROOT} (Makefile ci/test, ./test.sh, npm test, pytest)" >&2
  exit 1
fi
