#!/usr/bin/env python3
"""Validate MCP registrations in consumer plugin manifests."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def load_json(path: Path):
    with path.open(encoding="utf-8") as fh:
        return json.load(fh)


def check_repo(repo: Path) -> list[str]:
    errors: list[str] = []
    manifest_path = repo / "plugin.manifest.json"
    if not manifest_path.is_file():
        return [f"{repo.name}: missing plugin.manifest.json"]

    manifest = load_json(manifest_path)
    services = (manifest.get("contributes") or {}).get("services") or {}
    mcp_svc = services.get("mcp")
    mcp_enabled = False
    if isinstance(mcp_svc, bool):
        mcp_enabled = mcp_svc
    elif isinstance(mcp_svc, dict):
        mcp_enabled = mcp_svc.get("enabled", True)

    reg = (manifest.get("registrations") or {}).get("mcp")
    if mcp_enabled and not reg:
        errors.append(f"{manifest_path}: contributes.services.mcp enabled but registrations.mcp missing")

    if not reg:
        return errors

    if isinstance(reg, str):
        stdio = repo / reg
        if not stdio.is_file():
            errors.append(f"{manifest_path}: stdio bridge missing: {stdio}")
        return errors

    if isinstance(reg, dict):
        stdio = reg.get("stdio")
        if stdio:
            p = repo / stdio
            if not p.is_file():
                errors.append(f"{manifest_path}: stdio bridge missing: {p}")
        bridge = reg.get("browserBridge")
        if bridge:
            p = repo / bridge
            if not p.is_file():
                errors.append(f"{manifest_path}: browser bridge missing: {p}")
        tool_manifest = reg.get("toolManifest")
        if tool_manifest:
            p = repo / tool_manifest
            if not p.is_file():
                errors.append(f"{manifest_path}: tool manifest missing: {p}")
    else:
        errors.append(f"{manifest_path}: registrations.mcp must be string or object")

    return errors


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", type=Path, action="append", help="Consumer repo path")
    parser.add_argument("--workspace", type=Path, default=ROOT.parent)
    parser.add_argument("--strict", action="store_true", help="Require MCP enabled on all plugins")
    args = parser.parse_args(argv)

    repos = args.repo or []
    if not repos:
        registry = load_json(ROOT / "plugins.registry.json")
        for entry in registry.get("plugins", []):
            mp = entry.get("manifestPath")
            if not mp:
                continue
            repos.append((ROOT / mp).resolve().parent)

    errors: list[str] = []
    for repo in repos:
        repo = repo.resolve()
        errors.extend(check_repo(repo))
        if args.strict:
            manifest = load_json(repo / "plugin.manifest.json")
            mcp_svc = (manifest.get("contributes") or {}).get("services", {}).get("mcp")
            if not mcp_svc:
                errors.append(f"{repo / 'plugin.manifest.json'}: --strict requires contributes.services.mcp")

    if errors:
        for err in errors:
            print("ERROR:", err, file=sys.stderr)
        return 1
    print(f"OK: MCP registration check passed ({len(repos)} repos)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
