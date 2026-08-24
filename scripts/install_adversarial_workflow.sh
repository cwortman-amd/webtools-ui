#!/usr/bin/env bash
# Install the adversarial-documentation-driven-testing skill and /test workflow
# into webtools-ui, every consumer, and optionally ~/.cursor.
#
# Usage:
#   scripts/install_adversarial_workflow.sh           # all sibling consumers + user
#   scripts/install_adversarial_workflow.sh --repo DIR
#   scripts/install_adversarial_workflow.sh --user-only
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLATFORM_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
WORKSPACE="$(cd "${PLATFORM_ROOT}/.." && pwd)"

SKILL_NAME="adversarial-documentation-driven-testing"
SKILL_SRC="${PLATFORM_ROOT}/skills/${SKILL_NAME}"
CMD_PLATFORM="${PLATFORM_ROOT}/.cursor/commands/test.md"
CMD_TEMPLATE="${PLATFORM_ROOT}/.cursor/templates/test.consumer.md"
CMD_USER="${PLATFORM_ROOT}/.cursor/templates/test.user.md"
COV_PLATFORM="${PLATFORM_ROOT}/.cursor/commands/coverage.md"
COV_TEMPLATE="${PLATFORM_ROOT}/.cursor/templates/coverage.consumer.md"
COV_USER="${PLATFORM_ROOT}/.cursor/templates/coverage.user.md"
RULE_SRC="${PLATFORM_ROOT}/.cursor/rules/adversarial-testing.mdc"
RULE_USER="${PLATFORM_ROOT}/.cursor/templates/adversarial-testing.user.mdc"
MK_MARKER="# --- webtools-ui adversarial testing (do not duplicate) ---"
MK_INCLUDE="-include shared/makefiles/adversarial-testing.mk"

CONSUMERS=(
  llm-benchmark
  dc-planner
  cluster-manager
  demo-portal
  knowledge-exchange
  slide-presenter
)

TESTING_SECTION_BODY='## Testing

This repo ships the **adversarial-documentation-driven-testing** skill so any agent (or a human at a shell) can run the same workflow.

| Invoke | Where |
| :--- | :--- |
| Cursor **`/test`** | `.cursor/commands/test.md` |
| Cursor **`/coverage`** | `.cursor/commands/coverage.md` (statement / branch / condition; `/test` Phase 2) |
| Skill (project) | `.cursor/skills/adversarial-documentation-driven-testing/SKILL.md` (symlink to `shared/skills/`) |
| Shell | `bash scripts/run_test_workflow.sh` (platform) or `bash shared/scripts/run_test_workflow.sh` (consumer); `make adversarial-preflight`; then this repo'\''s documented test entry |

Do not run the product suite until preflight exits 0 or an owned dated exception exists.
'

consumer_test_cmd() {
  case "$1" in
    llm-benchmark)
      echo "Software gate (not the GPU \`./test.sh\` harness): \`python3 -m pytest tests/ -q\` and \`./test_offline.sh\`. Playwright: this repo's Playwright config / tab-linkage specs."
      ;;
    dc-planner)
      echo "\`./test.sh --quick\` (skip Playwright) or \`./test.sh\` for the full self-check including e2e."
      ;;
    cluster-manager)
      echo "Python: \`coverage run -m unittest discover -s tests -t . -p 'test_*.py'\` (see CI). Ansible: \`make check\`. Playwright tab-linkage specs under \`e2e/\`. Do **not** treat \`./test.sh cpu|gpu|...\` cluster health playbooks as the documentation-linkage suite."
      ;;
    demo-portal)
      echo "\`make test\` / \`./test.sh\` (validate + unit). Playwright: \`make test-e2e\` or \`tests/e2e\`."
      ;;
    knowledge-exchange)
      echo "\`make test\` (fast pytest) and/or \`make ci\` (lint + schema + MCP). Portal UI: Playwright specs under \`tests/ui\`."
      ;;
    slide-presenter)
      echo "\`make test\` / \`./test.sh\` (lint + unit + integration + e2e). Narrower: \`./test.sh unit\` or \`./test.sh ci\`."
      ;;
    *)
      echo "Use this repo's documented local entry: \`./test.sh\`, \`./test_offline.sh\`, \`make test\`, or \`make ci\`."
      ;;
  esac
}

say() { printf '==> %s\n' "$*"; }
warn() { printf '! %s\n' "$*" >&2; }

_cp_if_different() {
  local src="$1"
  local dest="$2"
  mkdir -p "$(dirname "$dest")"
  if [ -e "$dest" ] && [ "$(readlink -f "$src")" = "$(readlink -f "$dest")" ]; then
    return 0
  fi
  cp -a "$src" "$dest"
}

# Replace dest with a symlink. Removes a previous file/directory copy.
_symlink_replace() {
  local src="$1"
  local dest="$2"
  mkdir -p "$(dirname "$dest")"
  rm -rf "$dest"
  ln -sfn "$src" "$dest"
}

# Suite consumers: skill dir → shared/skills/<name> (canonical tree).
install_skill_dir() {
  local dest_root="$1"
  local dest="${dest_root}/.cursor/skills/${SKILL_NAME}"
  _symlink_replace "../../shared/skills/${SKILL_NAME}" "$dest"
}

install_rule() {
  local dest_root="$1"
  _cp_if_different "${RULE_SRC}" "${dest_root}/.cursor/rules/adversarial-testing.mdc"
}

install_consumer_command() {
  local dest_root="$1"
  local name="$2"
  local cmd
  cmd="$(consumer_test_cmd "$name")"
  mkdir -p "${dest_root}/.cursor/commands"
  # Portable template fill (no GNU sed -i assumptions).
  python3 - "$CMD_TEMPLATE" "${dest_root}/.cursor/commands/test.md" "$cmd" <<'PY'
import pathlib, sys
src, dest, cmd = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2]), sys.argv[3]
text = src.read_text(encoding="utf-8").replace("__CONSUMER_TEST_CMD__", cmd)
dest.write_text(text, encoding="utf-8")
PY
  _cp_if_different "$COV_TEMPLATE" "${dest_root}/.cursor/commands/coverage.md"
}

ensure_makefile_include() {
  local mk="$1"
  if [ ! -f "$mk" ]; then
    warn "no Makefile at ${mk}; skipping include"
    return 0
  fi
  if grep -qF "makefiles/adversarial-testing.mk" "$mk"; then
    return 0
  fi
  printf '\n%s\n%s\n' "$MK_MARKER" "$MK_INCLUDE" >> "$mk"
}

ensure_product_skill_section() {
  local skill="$1"
  if [ ! -f "$skill" ]; then
    warn "product skill missing: ${skill}"
    return 0
  fi
  if grep -qF "## Testing" "$skill"; then
    return 0
  fi
  python3 - "$skill" "$TESTING_SECTION_BODY" <<'PY'
from pathlib import Path
import sys
path = Path(sys.argv[1])
section = sys.argv[2]
text = path.read_text(encoding="utf-8")
needle = "## Safety"
if needle in text:
    text = text.replace(needle, section + "\n" + needle, 1)
else:
    text = text.rstrip() + "\n\n" + section
path.write_text(text, encoding="utf-8")
PY
}

install_consumer() {
  local name="$1"
  local dest="${WORKSPACE}/${name}"
  if [ ! -d "$dest" ]; then
    warn "skip ${name}: not found at ${dest}"
    return 0
  fi
  say "install ${name}"
  install_skill_dir "$dest"
  install_rule "$dest"
  install_consumer_command "$dest" "$name"
  ensure_makefile_include "${dest}/Makefile"
  ensure_product_skill_section "${dest}/.cursor/skills/${name}/SKILL.md"
}

install_platform() {
  say "platform skill already canonical at ${SKILL_SRC}"
  mkdir -p "${PLATFORM_ROOT}/.cursor/commands" "${PLATFORM_ROOT}/.cursor/rules"
  install_rule "${PLATFORM_ROOT}"
}

install_user() {
  local home_skill="${HOME}/.cursor/skills/${SKILL_NAME}"
  local home_cmd="${HOME}/.cursor/commands/test.md"
  local home_rule="${HOME}/.cursor/rules/adversarial-testing.mdc"
  mkdir -p "${HOME}/.cursor/skills" "${HOME}/.cursor/commands" "${HOME}/.cursor/rules"
  _symlink_replace "${SKILL_SRC}" "${home_skill}"
  _cp_if_different "$CMD_USER" "$home_cmd"
  _cp_if_different "$COV_USER" "${HOME}/.cursor/commands/coverage.md"
  _cp_if_different "$RULE_USER" "$home_rule"
  say "user skill → symlink ${home_skill} -> ${SKILL_SRC}"
  say "user /test → ${home_cmd} (generic; project overlay wins when present)"
  say "user /coverage → ${HOME}/.cursor/commands/coverage.md"
}

usage() {
  cat <<EOF
Usage: $0 [--repo DIR] [--user-only] [--no-user]
EOF
}

DO_USER=1
REPO_ONLY=""
USER_ONLY=0
while [ $# -gt 0 ]; do
  case "$1" in
    --repo) REPO_ONLY="${2:?}"; shift 2 ;;
    --user-only) USER_ONLY=1; shift ;;
    --no-user) DO_USER=0; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "unknown arg: $1" >&2; usage; exit 2 ;;
  esac
done

[ -f "${SKILL_SRC}/SKILL.md" ] || { echo "missing skill at ${SKILL_SRC}" >&2; exit 1; }
[ -f "$CMD_TEMPLATE" ] || { echo "missing template ${CMD_TEMPLATE}" >&2; exit 1; }
[ -f "$CMD_USER" ] || { echo "missing template ${CMD_USER}" >&2; exit 1; }
[ -f "$COV_TEMPLATE" ] || { echo "missing template ${COV_TEMPLATE}" >&2; exit 1; }
[ -f "$COV_USER" ] || { echo "missing template ${COV_USER}" >&2; exit 1; }
[ -f "$COV_PLATFORM" ] || { echo "missing ${COV_PLATFORM}" >&2; exit 1; }
[ -f "$RULE_USER" ] || { echo "missing template ${RULE_USER}" >&2; exit 1; }

if [ "$USER_ONLY" = "1" ]; then
  install_user
  exit 0
fi

if [ -n "$REPO_ONLY" ]; then
  repo_abs="$(cd "$REPO_ONLY" && pwd)"
  base="$(basename "$repo_abs")"
  if [ "$base" = "webtools-ui" ]; then
    install_platform
  else
    # Allow installing into a path that is not under WORKSPACE by copying dest layout.
    if [ "$repo_abs" = "${WORKSPACE}/${base}" ]; then
      install_consumer "$base"
    else
      say "install custom repo ${repo_abs} as ${base}"
      WORKSPACE="$(cd "${repo_abs}/.." && pwd)"
      install_consumer "$base"
    fi
  fi
  [ "$DO_USER" = "1" ] && install_user
  exit 0
fi

install_platform
for c in "${CONSUMERS[@]}"; do
  install_consumer "$c"
done
[ "$DO_USER" = "1" ] && install_user
say "done"
