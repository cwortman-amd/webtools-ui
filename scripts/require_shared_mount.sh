#!/usr/bin/env bash
# webtools-ui/scripts/require_shared_mount.sh
# Fail fast when consumer shared/ symlink is unresolved (CI + local gates).
set -euo pipefail
ROOT="${1:-.}"
if [[ ! -f "$ROOT/shared/css/base.css" ]]; then
  echo "ERROR: $ROOT/shared/ is unresolved — checkout sibling webtools-ui next to this repo." >&2
  echo "  Expected: shared/css/base.css" >&2
  exit 1
fi
echo "OK: shared mount resolved at $ROOT/shared/"
