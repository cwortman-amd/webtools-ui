#!/usr/bin/env bash
# Link canonical Agent Skills (skills/) into every agent discovery path.
#
# Canonical layout (agentskills.io):
#   <repo>/skills/<name>/SKILL.md
#
# Adapters (symlinks, never copies):
#   .cursor/skills  .agents/skills  .gemini/skills
#   .claude/skills  .codex/skills   .hermes/skills
#
# User-global (optional --user):
#   ~/.cursor/skills  ~/.agents/skills  ~/.gemini/skills
#   ~/.claude/skills  ~/.codex/skills   ~/.hermes/skills
#
# Usage:
#   scripts/link_agent_skills.sh                  # this repo
#   scripts/link_agent_skills.sh --root DIR
#   scripts/link_agent_skills.sh --user           # also link $HOME adapters
#   scripts/link_agent_skills.sh --suite          # this repo + sibling consumers
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEFAULT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
WORKSPACE="$(cd "${DEFAULT_ROOT}/.." && pwd)"

PROJECT_ADAPTERS=(.cursor .agents .gemini .claude .codex .hermes)
USER_ADAPTERS=(.cursor .agents .gemini .claude .codex .hermes)
CONSUMERS=(
  llm-benchmark dc-planner cluster-manager
  demo-portal knowledge-exchange slide-presenter
)

ROOT="$DEFAULT_ROOT"
DO_USER=0
DO_SUITE=0

say() { printf '==> %s\n' "$*"; }
warn() { printf '! %s\n' "$*" >&2; }

_symlink_replace() {
  local src="$1"
  local dest="$2"
  mkdir -p "$(dirname "$dest")"
  rm -rf "$dest"
  ln -sfn "$src" "$dest"
}

canonical_dir() {
  local root="$1"
  if [ -d "${root}/skills" ]; then
    echo "${root}/skills"
  elif [ -d "${root}/.cursor/skills" ]; then
    echo "${root}/.cursor/skills"
  else
    echo ""
  fi
}

link_project() {
  local root="$1"
  local canon
  canon="$(canonical_dir "$root")"
  if [ -z "$canon" ]; then
    warn "no skills/ or .cursor/skills in ${root}"
    return 0
  fi
  local rel
  if [ "$canon" = "${root}/skills" ]; then
    rel="../../skills"
  else
    rel="../../.cursor/skills"
  fi
  local name dest
  for skill in "${canon}"/*; do
    [ -d "$skill" ] || continue
    [ -f "${skill}/SKILL.md" ] || continue
    name="$(basename "$skill")"
    # Skip if this skill dir is already an adapter symlink to shared
    for adapter in "${PROJECT_ADAPTERS[@]}"; do
      dest="${root}/${adapter}/skills/${name}"
      if [ "$canon" = "${root}/skills" ]; then
        _symlink_replace "${rel}/${name}" "$dest"
      elif [ "$(basename "$(dirname "$canon")")" = ".cursor" ] && [ "$adapter" = ".cursor" ]; then
        continue
      else
        _symlink_replace "${rel}/${name}" "$dest"
      fi
    done
  done
  say "linked project adapters under ${root}"
}

# Point every consumer adapter at platform skills/ (via shared/ or ../webtools-ui).
link_platform_skills_into() {
  local dest_root="$1"
  local rel=""
  if [ -d "${dest_root}/shared/skills" ]; then
    rel="../../shared/skills"
  elif [ -d "${dest_root}/../webtools-ui/skills" ]; then
    rel="../../webtools-ui/skills"
  else
    return 0
  fi
  local name dest
  for skill in "${DEFAULT_ROOT}/skills"/*; do
    [ -d "$skill" ] || continue
    [ -f "${skill}/SKILL.md" ] || continue
    name="$(basename "$skill")"
    for adapter in "${PROJECT_ADAPTERS[@]}"; do
      dest="${dest_root}/${adapter}/skills/${name}"
      _symlink_replace "${rel}/${name}" "$dest"
    done
  done
  say "linked platform skills into ${dest_root}"
}

link_user_from() {
  local canon="$1"
  [ -d "$canon" ] || return 0
  local name dest abs
  for skill in "${canon}"/*; do
    [ -d "$skill" ] || continue
    [ -f "${skill}/SKILL.md" ] || continue
    name="$(basename "$skill")"
    abs="$(readlink -f "$skill")"
    for adapter in "${USER_ADAPTERS[@]}"; do
      dest="${HOME}/${adapter}/skills/${name}"
      _symlink_replace "$abs" "$dest"
    done
  done
  say "linked user adapters in \$HOME for $(basename "$canon")/*"
}

while [ $# -gt 0 ]; do
  case "$1" in
    --root) ROOT="${2:?}"; shift 2 ;;
    --user) DO_USER=1; shift ;;
    --suite) DO_SUITE=1; shift ;;
    -h|--help)
      sed -n '2,22p' "$0"
      exit 0
      ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
done

ROOT="$(cd "$ROOT" && pwd)"
link_project "$ROOT"
if [ "$DO_SUITE" = "1" ]; then
  for c in "${CONSUMERS[@]}"; do
    if [ -d "${WORKSPACE}/${c}" ]; then
      link_project "${WORKSPACE}/${c}"
      link_platform_skills_into "${WORKSPACE}/${c}"
    else
      warn "skip missing ${c}"
    fi
  done
fi
if [ "$DO_USER" = "1" ]; then
  link_user_from "$(canonical_dir "$ROOT")"
  # Product skills from sibling consumers (so any workspace can load them)
  if [ "$DO_SUITE" = "1" ]; then
    for c in "${CONSUMERS[@]}"; do
      [ -d "${WORKSPACE}/${c}" ] || continue
      link_user_from "$(canonical_dir "${WORKSPACE}/${c}")"
    done
  fi
fi
