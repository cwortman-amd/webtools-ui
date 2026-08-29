#!/usr/bin/env python3
"""Validate a consumer repo's webtools-ui shared mount.

Profiles (match plugin type):
  dashboard — cluster-manager, dc-planner, llm-benchmark
  catalog   — knowledge-exchange
  hub       — demo-portal

Usage:
  python3 check_shared_mount.py [--profile dashboard|catalog|hub] [--root DIR]
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

PROFILES: dict[str, tuple[str, ...]] = {
    "dashboard": (
        "css/material-symbols.css",
        "css/base.css",
        "css/chat-orb.css",
        "css/demo-mode.css",
        "css/shell.css",
        "css/shortcuts.css",
        "css/settings.css",
        "js/shell.js",
        "js/settings.js",
        "js/chat-orb.js",
        "js/slash-router.js",
        "js/slash-catalog.js",
        "js/demo-engine.js",
        "js/demo-ui.js",
        "js/voice.js",
        "js/platform.js",
        "plugins.registry.json",
        "schemas/plugin.manifest.schema.json",
    ),
    "catalog": (
        "css/material-symbols.css",
        "css/tokens.css",
        "css/base.css",
        "css/chat-orb.css",
        "css/chrome.css",
        "css/components.css",
        "css/shortcuts.css",
        "css/settings.css",
        "js/shortcuts.js",
        "js/settings.js",
        "js/chat-orb.js",
        "js/slash-router.js",
        "js/slash-catalog.js",
        "js/chrome.js",
        "js/platform.js",
        "plugins.registry.json",
        "schemas/plugin.manifest.schema.json",
    ),
    "hub": (
        "css/material-symbols.css",
        "css/base.css",
        "css/chrome.css",
        "css/components.css",
        "css/chat-orb.css",
        "css/shortcuts.css",
        "css/settings.css",
        "js/shortcuts.js",
        "js/settings.js",
        "js/chat-orb.js",
        "js/slash-router.js",
        "js/slash-catalog.js",
        "js/chrome.js",
        "js/platform.js",
        "plugins.registry.json",
        "schemas/plugin.manifest.schema.json",
    ),
}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--profile", choices=sorted(PROFILES), required=True)
    parser.add_argument("--root", type=Path, default=Path.cwd())
    args = parser.parse_args(argv)

    root = args.root.resolve()
    shared = root / "shared"
    errors: list[str] = []

    if not shared.exists():
        errors.append("shared/ mount missing")
    elif shared.is_symlink():
        if not shared.resolve().exists():
            errors.append(f"shared/ symlink target missing: {shared.readlink()}")
    elif not (shared / "css" / "base.css").exists():
        errors.append("shared/ is not a valid webtools-ui mount")

    manifest = root / "plugin.manifest.json"
    if not manifest.exists():
        errors.append("missing plugin.manifest.json at repo root")

    for rel in PROFILES[args.profile]:
        if not (shared / rel).exists():
            errors.append(f"missing shared/{rel}")

    if args.profile == "hub":
        snapshot = root / "data" / "plugins.registry.json"
        if not snapshot.exists():
            errors.append("missing data/plugins.registry.json (run: make sync-plugin-registry)")

    for msg in errors:
        print(f"ERROR: {msg}", file=sys.stderr)

    if errors:
        return 1

    print(f"OK: webtools-ui shared mount ({args.profile} profile)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
