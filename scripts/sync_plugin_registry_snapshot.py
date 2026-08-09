#!/usr/bin/env python3
"""Copy plugins.registry.json to demo-portal/data/ for static deploy fallback.

When demo-portal is served without a sibling webtools-ui checkout, the hub can
load data/plugins.registry.json instead of ../shared/plugins.registry.json.

Usage:
  python3 scripts/sync_plugin_registry_snapshot.py [--workspace DIR]
"""

from __future__ import annotations

import argparse
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REGISTRY = ROOT / "plugins.registry.json"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--workspace",
        type=Path,
        default=ROOT.parent,
        help="Workspace root containing demo-portal (default: parent of webtools-ui)",
    )
    args = parser.parse_args(argv)

    if not REGISTRY.exists():
        print(f"ERROR: missing {REGISTRY}", file=sys.stderr)
        return 1

    dest_dir = args.workspace / "demo-portal" / "data"
    dest = dest_dir / "plugins.registry.json"
    if not dest_dir.exists():
        print(f"WARN: {dest_dir} not found — skipping snapshot", file=sys.stderr)
        return 0

    shutil.copy2(REGISTRY, dest)
    print(f"OK: synced {REGISTRY.name} -> {dest}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
