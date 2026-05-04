#!/usr/bin/env bash
# shared-ui/scripts/verify-vendor-manifest.sh
#
# Cross-repo CI gate (harmonization Phase 8). Verifies that a consumer's
# `shared/` subtree matches the canonical vendor manifest published by
# shared-ui. Used by each consumer's offline test rig (e.g.
# llm-benchmark/test_offline.sh §25) to detect drift between what the
# consumer has subtree-pulled and what shared-ui's main branch
# currently publishes.
#
# How it works:
#   - Reads scripts/vendor-manifest.json (produced by
#     build-vendor-manifest.sh).
#   - For each entry, computes the SHA256 of the file at the same
#     relative path under SHARED_DIR.
#   - Reports per-file pass/fail and exits non-zero on any mismatch
#     (or missing file).
#
# Usage (from a consumer repo, e.g. llm-benchmark):
#     bash shared/scripts/verify-vendor-manifest.sh
# Or with explicit args:
#     bash verify-vendor-manifest.sh \
#         <manifest-path> <shared-dir> [<repo-name>]
#
# Designed to be POSIX-ish. Requires sha256sum + jq OR python3.
# Exit code: 0 = all match, 1 = mismatch, 2 = setup error.

set -uo pipefail

MANIFEST="${1:-}"
SHARED_DIR="${2:-}"
REPO_NAME="${3:-$(basename "$(pwd)")}"

# Auto-locate when invoked as `bash shared/scripts/verify-vendor-manifest.sh`
# from a consumer repo root.
if [ -z "$MANIFEST" ]; then
  if [ -f "shared/scripts/vendor-manifest.json" ]; then
    MANIFEST="shared/scripts/vendor-manifest.json"
    SHARED_DIR="shared"
  elif [ -f "scripts/vendor-manifest.json" ]; then
    # Inside shared-ui itself — verify against its own working tree.
    MANIFEST="scripts/vendor-manifest.json"
    SHARED_DIR="."
  fi
fi

if [ -z "$MANIFEST" ] || [ ! -f "$MANIFEST" ]; then
  echo "FAIL  vendor-manifest.json not found (looked in shared/scripts/ and scripts/)"
  exit 2
fi
if [ -z "$SHARED_DIR" ] || [ ! -d "$SHARED_DIR" ]; then
  echo "FAIL  shared dir '$SHARED_DIR' does not exist"
  exit 2
fi

# Parse the manifest. Prefer python3 (always available); fall back to jq.
ENTRIES=""
if command -v python3 >/dev/null 2>&1; then
  ENTRIES=$(python3 -c "
import json, sys
m = json.load(open('$MANIFEST'))
for f in m.get('files', []):
    print(f\"{f['sha256']} {f['size']} {f['path']}\")
")
elif command -v jq >/dev/null 2>&1; then
  ENTRIES=$(jq -r '.files[] | "\(.sha256) \(.size) \(.path)"' "$MANIFEST")
else
  echo "FAIL  need python3 or jq to parse $MANIFEST"
  exit 2
fi

total=0
matched=0
mismatched=0
missing=0

while IFS=' ' read -r expected_sha expected_size rel_path; do
  [ -z "$rel_path" ] && continue
  total=$((total + 1))
  full_path="$SHARED_DIR/$rel_path"

  if [ ! -f "$full_path" ]; then
    echo "  MISS  $rel_path"
    missing=$((missing + 1))
    continue
  fi

  actual_sha=$(sha256sum "$full_path" | cut -d' ' -f1)
  if [ "$actual_sha" = "$expected_sha" ]; then
    matched=$((matched + 1))
  else
    actual_size=$(stat -c%s "$full_path" 2>/dev/null || echo "?")
    echo "  DRIFT $rel_path"
    echo "        expected sha=${expected_sha:0:12}… size=$expected_size"
    echo "        actual   sha=${actual_sha:0:12}… size=$actual_size"
    mismatched=$((mismatched + 1))
  fi
done <<< "$ENTRIES"

echo ""
echo "$REPO_NAME · vendor manifest: matched=$matched / $total · drift=$mismatched · missing=$missing"
if [ "$mismatched" -eq 0 ] && [ "$missing" -eq 0 ]; then
  exit 0
fi
exit 1
