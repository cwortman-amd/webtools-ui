#!/usr/bin/env bash
# Build source archive zip packages for Tools Hub install modal downloads.
#
# Each archive contains webtools-ui + the target consumer as siblings under a
# workspace/ prefix — the same layout the curl installers expect.
#
# Usage:
#   ./scripts/build-source-archives.sh              # all consumers
#   ./scripts/build-source-archives.sh slide-presenter dc-planner
#
# Output: archives/<tool>-source.zip

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
OUT_DIR="$ROOT/archives"
WORKSPACE="${WT_WORKSPACE:-$HOME/workspace}"

ALL_TOOLS=(
  cluster-manager
  dc-planner
  llm-benchmark
  demo-portal
  slide-presenter
  knowledge-exchange
)

have_cmd() { command -v "$1" >/dev/null 2>&1; }

zip_dir() {
  local src="$1"
  local archive="$2"
  if have_cmd zip; then
    (cd "$src" && zip -qr "$archive" .)
    return 0
  fi
  ROOT="$src" ARCHIVE="$archive" python3 <<'PY'
import os, zipfile
root = os.environ["ROOT"]
archive = os.environ["ARCHIVE"]
skip_dirs = {".git", "node_modules", "__pycache__", ".test-artifacts"}
skip_suffix = "-venv"
with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_DEFLATED) as zf:
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in skip_dirs and not d.endswith(skip_suffix)]
        for name in filenames:
            path = os.path.join(dirpath, name)
            rel = os.path.relpath(path, root)
            zf.write(path, rel)
PY
}

build_one() {
  local tool="$1"
  local tool_dir="$WORKSPACE/$tool"
  local platform_dir="$WORKSPACE/webtools-ui"
  local archive="$OUT_DIR/${tool}-source.zip"
  local stage
  stage="$(mktemp -d)"

  if [[ ! -d "$platform_dir" ]]; then
    echo "ERROR: webtools-ui not found at $platform_dir" >&2
    rm -rf "$stage"
    return 1
  fi
  if [[ ! -d "$tool_dir" ]]; then
    echo "ERROR: $tool not found at $tool_dir" >&2
    rm -rf "$stage"
    return 1
  fi

  mkdir -p "$stage/workspace/webtools-ui" "$stage/workspace/$tool"
  echo "Building ${tool}-source.zip ..."
  if have_cmd rsync; then
    rsync -a --exclude '.git' --exclude 'node_modules' --exclude '__pycache__' \
      --exclude '.test-artifacts' --exclude '.*-venv' \
      "$platform_dir/" "$stage/workspace/webtools-ui/"
    rsync -a --exclude '.git' --exclude 'node_modules' --exclude '__pycache__' \
      --exclude '.test-artifacts' --exclude '.*-venv' \
      "$tool_dir/" "$stage/workspace/$tool/"
  else
    cp -a "$platform_dir/." "$stage/workspace/webtools-ui/"
    cp -a "$tool_dir/." "$stage/workspace/$tool/"
  fi

  cat >"$stage/workspace/README-INSTALL.txt" <<EOF
${tool} source archive
=====================

1. Unzip into your home directory (or any parent path):
     unzip ${tool}-source.zip -d ~/

2. You should have:
     ~/workspace/webtools-ui/
     ~/workspace/${tool}/

3. Bootstrap:
     cd ~/workspace/${tool}
     ./setup.sh

   Or use the one-liner (needs network + git):
     curl -fsSL https://curt.wortman.ai/tools/install-${tool}.sh | bash
EOF

  rm -f "$archive"
  zip_dir "$stage" "$archive"
  rm -rf "$stage"
  echo "  -> $archive ($(du -h "$archive" | awk '{print $1}'))"
}

mkdir -p "$OUT_DIR"

tools=()
if [[ $# -gt 0 ]]; then
  tools=("$@")
else
  tools=("${ALL_TOOLS[@]}")
fi

for tool in "${tools[@]}"; do
  build_one "$tool"
done

echo "Done. Serve archives/ from https://curt.wortman.ai/archives/ for production downloads."
