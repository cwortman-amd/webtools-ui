#!/usr/bin/env bash
# shared-ui/scripts/build-vendor-manifest.sh
#
# Regenerates scripts/vendor-manifest.json — a canonical list of every
# shared-ui-owned file with its SHA256 + size + path. This is the
# reference manifest that each consumer's offline test_offline.sh §25
# (Phase 8 cross-repo CI gate) checks against to detect drift between
# what the consumer's shared/ subtree contains and what shared-ui's
# main branch publishes.
#
# Run this from the shared-ui repo root AFTER any change to shared
# assets and BEFORE committing. The manifest is checked into git so
# it can be subtree-pulled into each consumer.
#
# Usage:
#     bash scripts/build-vendor-manifest.sh
#
# Idempotent. Output is sorted by path so diffs are stable.

set -euo pipefail

cd "$(dirname "$0")/.."   # repo root

OUT=scripts/vendor-manifest.json
TMP=$(mktemp)
HEAD_REF=$(git rev-parse HEAD 2>/dev/null || echo "uncommitted")
GENERATED_AT=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Files that belong in the manifest. Pattern matches shared-ui's
# subtree-mounted layout in each consumer (under their `shared/` dir).
PATHS=$(find . -type f \
   \( -name '*.js' -o -name '*.css' -o -name '*.json' -o -name '*.md' \) \
   -not -path './.git/*' \
   -not -path './node_modules/*' \
   -not -path "./$OUT" \
   | sed 's|^\./||' \
   | sort)

{
  echo '{'
  printf '  "generated_at": "%s",\n' "$GENERATED_AT"
  printf '  "head": "%s",\n' "$HEAD_REF"
  echo '  "files": ['
  first=1
  while IFS= read -r p; do
    [ -z "$p" ] && continue
    sha=$(sha256sum "$p" | cut -d' ' -f1)
    sz=$(stat -c%s "$p")
    if [ "$first" -eq 1 ]; then first=0; else echo ","; fi
    printf '    { "path": "%s", "sha256": "%s", "size": %d }' "$p" "$sha" "$sz"
  done <<< "$PATHS"
  echo ""
  echo '  ]'
  echo '}'
} > "$TMP"

# Validate JSON.
if command -v node >/dev/null 2>&1; then
  if ! node -e "JSON.parse(require('fs').readFileSync('$TMP','utf8'))" 2>/dev/null; then
    echo "ERROR: generated manifest is not valid JSON" >&2
    cat "$TMP" >&2
    rm -f "$TMP"
    exit 1
  fi
fi

mv "$TMP" "$OUT"
echo "wrote $OUT ($(wc -l < "$OUT") lines, $(stat -c%s "$OUT") B)"
echo "files: $(echo "$PATHS" | wc -l)"
