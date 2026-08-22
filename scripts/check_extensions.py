#!/usr/bin/env python3
"""Validate extension pack registrations (stub — full gate in P11)."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def check_repo(repo: Path) -> list[str]:
    errors: list[str] = []
    manifest_path = repo / "plugin.manifest.json"
    if not manifest_path.is_file():
        return [f"{repo.name}: missing plugin.manifest.json"]

    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    reg = manifest.get("registrations") or {}
    ext = reg.get("extensions") or (manifest.get("contributes") or {}).get("extensions")
    if not ext:
        return errors

    catalog_path = ext if isinstance(ext, str) else None
    if isinstance(ext, list):
        for item in ext:
            p = repo / item
            if not p.is_file():
                errors.append(f"{manifest_path}: extension manifest missing: {p}")
        return errors

    if catalog_path:
        cat = repo / catalog_path
        if not cat.is_file():
            errors.append(f"{manifest_path}: extensions catalog missing: {cat}")
            return errors
        data = json.loads(cat.read_text(encoding="utf-8"))
        for entry in data.get("extensions") or []:
            pack: Path | None = None
            if entry.get("manifest"):
                pack = (cat.parent / entry["manifest"]).resolve()
            elif entry.get("path"):
                pack = (repo / entry["path"] / "extension.json").resolve()
            elif entry.get("id"):
                pack = (repo / "extensions" / entry["id"] / "extension.json").resolve()
            if pack and not pack.is_file():
                errors.append(f"{catalog_path}: pack manifest missing: {pack}")
    return errors


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", type=Path, action="append")
    parser.add_argument("--workspace", type=Path, default=ROOT.parent)
    args = parser.parse_args(argv)

    repos = args.repo or []
    if not repos:
        registry = json.loads((ROOT / "plugins.registry.json").read_text(encoding="utf-8"))
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
    print(f"OK: extension registration check passed ({len(repos)} repos)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
