#!/usr/bin/env python3
"""Validate Agent Gateway manifest declarations vs platform modules."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SUITE_MODULES = (
    "js/agent-gateway.js",
    "js/plugin-services.js",
    "js/plugin-bootstrap.js",
)


def load_json(path: Path):
    with path.open(encoding="utf-8") as fh:
        return json.load(fh)


def agent_enabled(manifest: dict) -> bool:
    svc = (manifest.get("contributes") or {}).get("services", {}).get("agent")
    if svc is False:
        return False
    if svc is True:
        return True
    if isinstance(svc, dict):
        return svc.get("enabled", True)
    return False


def check_repo(repo: Path) -> list[str]:
    errors: list[str] = []
    manifest_path = repo / "plugin.manifest.json"
    if not manifest_path.is_file():
        return [f"{repo.name}: missing plugin.manifest.json"]

    manifest = load_json(manifest_path)
    enabled = agent_enabled(manifest)
    if manifest.get("id") == "knowledge-exchange":
        return errors

    webtools = manifest.get("webtools") or {}
    js_modules = webtools.get("js") or []

    if enabled:
        for mod in SUITE_MODULES:
            if mod not in js_modules:
                errors.append(f"{manifest_path}: agent enabled but webtools.js missing {mod}")
        knowledge = (manifest.get("registrations") or {}).get("knowledge")
        if not knowledge:
            errors.append(f"{manifest_path}: agent enabled but registrations.knowledge missing")
    else:
        if "js/agent-gateway.js" in js_modules and manifest.get("id") != "knowledge-exchange":
            pass

    return errors


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", type=Path, action="append")
    parser.add_argument("--workspace", type=Path, default=ROOT.parent)
    args = parser.parse_args(argv)

    repos = args.repo or []
    if not repos:
        registry = load_json(ROOT / "plugins.registry.json")
        for entry in registry.get("plugins", []):
            mp = entry.get("manifestPath")
            if mp:
                repos.append((ROOT / mp).resolve().parent)

    errors: list[str] = []
    for repo in repos:
        errors.extend(check_repo(repo.resolve()))

    if errors:
        for err in errors:
            print("ERROR:", err, file=sys.stderr)
        return 1
    print(f"OK: agent gateway check passed ({len(repos)} repos)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
