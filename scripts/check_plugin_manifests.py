#!/usr/bin/env python3
"""Validate webtools-ui community plugin manifests and registry alignment.

Usage:
  python3 scripts/check_plugin_manifests.py [--strict] [--workspace DIR]

Exits 0 when all registered plugins have valid manifests; non-zero on errors.
With --strict, warnings (missing sibling manifest files) also fail.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
REGISTRY = ROOT / "plugins.registry.json"
SCHEMA = ROOT / "schemas" / "plugin.manifest.schema.json"
AGENT_DEFAULTS = ROOT / "data" / "agent-knowledge-defaults.json"

REQUIRED_MANIFEST_KEYS = ("id", "name", "version", "minWebtoolsVersion", "type", "entry")
VALID_TYPES = {"dashboard", "catalog", "hub"}
VALID_STATUS = {"active", "draft", "harmonization-in-progress", "deprecated"}


def load_json(path: Path) -> Any:
    with path.open(encoding="utf-8") as fh:
        return json.load(fh)


def check_manifest(manifest: dict, path: Path) -> list[str]:
    errors: list[str] = []
    for key in REQUIRED_MANIFEST_KEYS:
        if key not in manifest:
            errors.append(f"{path}: missing required field {key!r}")
    if manifest.get("type") not in VALID_TYPES:
        errors.append(f"{path}: invalid type {manifest.get('type')!r}")
    status = manifest.get("status", "active")
    if status not in VALID_STATUS:
        errors.append(f"{path}: invalid status {status!r}")
    entry = manifest.get("entry")
    if isinstance(entry, dict):
        if "html" not in entry:
            errors.append(f"{path}: entry.html required")
    else:
        errors.append(f"{path}: entry must be an object")
    return errors


def check_agent_harmonization(manifest: dict, path: Path, defaults: dict) -> list[str]:
    """Ensure dashboard agents share the platform knowledge base."""
    errors: list[str] = []
    pid = manifest.get("id") or ""
    if pid == "knowledge-exchange":
        return errors
    services = (manifest.get("contributes") or {}).get("services") or {}
    agent = services.get("agent")
    if not agent or agent is False:
        return errors
    if agent is True:
        errors.append(f"{path}: agent enabled but missing harmonized corpora block")
        return errors
    corpora = list(agent.get("corpora") or [])
    shared = list(defaults.get("sharedCorpora") or [])
    missing = [c for c in shared if c not in corpora]
    if missing:
        errors.append(f"{path}: agent.corpora missing shared corpora {missing!r}")
    expected_product = list((defaults.get("productCorpora") or {}).get(pid) or [])
    missing_product = [c for c in expected_product if c not in corpora]
    if missing_product:
        errors.append(f"{path}: agent.corpora missing product corpora {missing_product!r}")
    if not agent.get("keHubUrl"):
        errors.append(f"{path}: agent.keHubUrl required for harmonized KE hub access")
    reg_knowledge = list((manifest.get("registrations") or {}).get("knowledge") or [])
    if reg_knowledge:
        reg_missing = [c for c in corpora if c not in reg_knowledge]
        if reg_missing:
            errors.append(
                f"{path}: registrations.knowledge missing agent corpora {reg_missing!r}"
            )
    return errors


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--strict", action="store_true", help="Treat missing sibling manifests as errors")
    parser.add_argument(
        "--workspace",
        type=Path,
        default=ROOT.parent,
        help="Workspace root containing sibling consumer repos (default: parent of webtools-ui)",
    )
    args = parser.parse_args(argv)

    if not REGISTRY.exists():
        print(f"ERROR: registry not found: {REGISTRY}", file=sys.stderr)
        return 1

    registry = load_json(REGISTRY)
    plugins = registry.get("plugins")
    if not isinstance(plugins, list):
        print("ERROR: plugins.registry.json must contain a plugins array", file=sys.stderr)
        return 1

    errors: list[str] = []
    warnings: list[str] = []
    seen_ids: set[str] = set()
    agent_defaults: dict = {}
    if AGENT_DEFAULTS.is_file():
        agent_defaults = load_json(AGENT_DEFAULTS)
    else:
        warnings.append(f"agent defaults not found: {AGENT_DEFAULTS}")

    for entry in plugins:
        pid = entry.get("id")
        if not pid:
            errors.append("registry entry missing id")
            continue
        if pid in seen_ids:
            errors.append(f"duplicate registry id: {pid}")
        seen_ids.add(pid)

        manifest_path = entry.get("manifestPath")
        if manifest_path:
            resolved = (ROOT / manifest_path).resolve()
        else:
            resolved = (args.workspace / pid / "plugin.manifest.json").resolve()

        if not resolved.exists():
            msg = f"{pid}: manifest not found at {resolved}"
            if args.strict:
                errors.append(msg)
            else:
                warnings.append(msg)
            continue

        manifest = load_json(resolved)
        errors.extend(check_manifest(manifest, resolved))
        if agent_defaults:
            errors.extend(check_agent_harmonization(manifest, resolved, agent_defaults))

        if manifest.get("id") != pid:
            errors.append(f"{pid}: registry id != manifest id ({manifest.get('id')!r})")

        reg_wt = entry.get("webtools") or {}
        man_wt = manifest.get("webtools") or {}
        for key in ("defaultSkin", "shellLayout"):
            rv, mv = reg_wt.get(key), man_wt.get(key)
            if rv is not None and mv is not None and rv != mv:
                errors.append(f"{pid}: registry webtools.{key}={rv!r} != manifest {mv!r}")

        reg_mods = set((entry.get("dependencies") or {}).get("webtoolsModules") or [])
        man_mods = set((manifest.get("dependencies") or {}).get("webtoolsModules") or [])
        if reg_mods != man_mods:
            errors.append(
                f"{pid}: registry webtoolsModules {sorted(reg_mods)!r} != manifest {sorted(man_mods)!r}"
            )

        reg_repo = entry.get("repository")
        man_repo = manifest.get("repository")
        if reg_repo and man_repo and reg_repo != man_repo:
            warnings.append(f"{pid}: repository URL differs between registry and manifest")

    if SCHEMA.exists():
        pass  # JSON Schema validation can be added when jsonschema is a declared dep

    for w in warnings:
        print(f"WARN: {w}")
    for e in errors:
        print(f"ERROR: {e}", file=sys.stderr)

    if errors:
        print(f"\n{len(errors)} error(s), {len(warnings)} warning(s)", file=sys.stderr)
        return 1

    print(f"OK: {len(plugins)} plugin(s) validated, {len(warnings)} warning(s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
