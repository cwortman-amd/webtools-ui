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
trap 'rm -f "$TMP"' EXIT

# `git rev-parse HEAD` prints "HEAD" to STDOUT *and* exits non-zero in a repo
# with no commits, so a bare `||` fallback appends and yields a two-line value
# that lands as a raw newline inside a JSON string. --verify suppresses that.
HEAD_REF=$(git rev-parse --verify HEAD 2>/dev/null || echo "uncommitted")

# Walk, hash, and serialize in one Python pass.
#
# This used to be a shell loop that printf'd paths straight into JSON. Any
# filename containing a quote, backslash, or newline either corrupted the
# output or silently forged an entry (a crafted name could close the string
# and inject a second object, pinning a real file to a chosen hash). Paths
# also came from `find` via a newline-joined string, so a filename with a
# newline split into two bogus entries, and GNU sha256sum's backslash-escaped
# output form corrupted the hash field. json.dump handles all of it.
python3 - "$TMP" "$OUT" <<'PY'
import hashlib, json, os, subprocess, sys, datetime

tmp_path, out_rel = sys.argv[1], sys.argv[2]
SUFFIXES = (".js", ".css", ".json", ".md", ".woff2", ".html")
SKIP_DIRS = {".git", "node_modules"}

files = []
for root, dirs, names in os.walk("."):
    dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
    for name in names:
        if not name.endswith(SUFFIXES):
            continue
        rel = os.path.relpath(os.path.join(root, name), ".")
        if rel == out_rel:
            continue
        h = hashlib.sha256()
        with open(rel, "rb") as fh:
            for chunk in iter(lambda: fh.read(1 << 20), b""):
                h.update(chunk)
        files.append({
            "path": rel.replace(os.sep, "/"),
            "sha256": h.hexdigest(),
            "size": os.path.getsize(rel),
        })

files.sort(key=lambda f: f["path"])

head = subprocess.run(
    ["git", "rev-parse", "--verify", "HEAD"],
    capture_output=True, text=True,
).stdout.strip() or "uncommitted"

# Hand-rolled layout keeps one file per line so diffs stay reviewable;
# json.dumps still does the escaping for every individual value.
lines = [
    "{",
    '  "generated_at": %s,' % json.dumps(
        datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")),
    '  "head": %s,' % json.dumps(head),
    '  "files": [',
]
lines += [
    "    { \"path\": %s, \"sha256\": %s, \"size\": %d }%s" % (
        json.dumps(f["path"]), json.dumps(f["sha256"]), f["size"],
        "," if i < len(files) - 1 else "",
    )
    for i, f in enumerate(files)
]
lines += ["  ]", "}", ""]

with open(tmp_path, "w", encoding="utf-8") as fh:
    fh.write("\n".join(lines))

# Validate what we just wrote rather than trusting the serializer.
with open(tmp_path, encoding="utf-8") as fh:
    json.load(fh)

print("files: %d" % len(files))
PY

# mktemp creates 0600 and `mv` preserves it, which is how the committed
# manifest ended up mode 600. It is a public checked-in file.
chmod 644 "$TMP"
mv "$TMP" "$OUT"
trap - EXIT
echo "wrote $OUT ($(wc -l < "$OUT") lines, $(stat -c%s "$OUT") B)"
