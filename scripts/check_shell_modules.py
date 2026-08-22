#!/usr/bin/env python3
"""Validate shell-modules.json against sibling dashboard HTML/manifest wiring.

Usage:
  python3 scripts/check_shell_modules.py [--repo PATH]

Exit 0 when all checks pass; non-zero otherwise.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path


def load_json(path: Path) -> dict:
    with path.open(encoding="utf-8") as fh:
        return json.load(fh)


def extension_sidebar(manifest: dict) -> bool:
    contributes = manifest.get("contributes") or {}
    views = contributes.get("views") or {}
    sidebar = views.get("sidebar")
    reg_ext = (manifest.get("registrations") or {}).get("extensions")
    return sidebar == "data/extensions.json" and reg_ext == "data/extensions.json"


def check_repo(repo: Path) -> list[str]:
    errors: list[str] = []
    manifest_path = repo / "plugin.manifest.json"
    modules_path = repo / "data" / "shell-modules.json"
    index_path = repo / "pages" / "index.html"
    mount_path = repo / "js" / "plugin-mount.js"

    if not manifest_path.is_file():
        errors.append(f"missing {manifest_path}")
        return errors

    manifest = load_json(manifest_path)
    plugin_id = manifest.get("id", repo.name)
    ext_sidebar = extension_sidebar(manifest)

    if not ext_sidebar:
        if not modules_path.is_file():
            errors.append(f"{plugin_id}: missing data/shell-modules.json")
            return errors

        modules_doc = load_json(modules_path)
        modules = modules_doc.get("modules") or []
        if not modules:
            errors.append(f"{plugin_id}: shell-modules.json has no modules")

        module_ids = [m.get("id") for m in modules if m.get("id")]
        if len(module_ids) != len(set(module_ids)):
            errors.append(f"{plugin_id}: duplicate module ids in shell-modules.json")

        default_tab = modules_doc.get("defaultTab")
        if default_tab and default_tab not in module_ids:
            errors.append(f"{plugin_id}: defaultTab {default_tab!r} not in modules")

        for mod in modules:
            mid = mod.get("id")
            panel = mod.get("panel") or {}
            src = panel.get("src")
            if panel.get("type") == "iframe" and src:
                iframe_path = repo / "pages" / src
                if not iframe_path.is_file():
                    errors.append(f"{plugin_id}: module {mid!r} panel src missing: pages/{src}")

    contributes = manifest.get("contributes") or {}
    views = contributes.get("views") or {}
    sidebar = views.get("sidebar")
    registrations = manifest.get("registrations") or {}
    reg_shell = registrations.get("shellModules")
    reg_ext = registrations.get("extensions")

    if ext_sidebar:
        if sidebar != "data/extensions.json":
            errors.append(
                f"{plugin_id}: extension-sourced sidebar should be data/extensions.json"
            )
        if reg_ext != "data/extensions.json":
            errors.append(
                f"{plugin_id}: registrations.extensions should be data/extensions.json"
            )
        ext_catalog = repo / "data" / "extensions.json"
        if not ext_catalog.is_file():
            errors.append(f"{plugin_id}: missing data/extensions.json")
    else:
        if sidebar != "data/shell-modules.json":
            errors.append(
                f"{plugin_id}: contributes.views.sidebar should be data/shell-modules.json"
            )
        if reg_shell != "data/shell-modules.json":
            errors.append(
                f"{plugin_id}: registrations.shellModules should be data/shell-modules.json"
            )

    entry = manifest.get("entry") or {}
    mount = entry.get("mount")
    if mount != "js/plugin-mount.js":
        errors.append(f"{plugin_id}: entry.mount should be js/plugin-mount.js (got {mount!r})")

    deps = ((manifest.get("dependencies") or {}).get("webtoolsModules")) or []
    if "shell-modules" not in deps:
        errors.append(f"{plugin_id}: dependencies.webtoolsModules must include shell-modules")

    if index_path.is_file():
        index = index_path.read_text(encoding="utf-8")
        for needle in (
            'src="../shared/js/shell-modules.js"',
            'src="../js/plugin-mount.js"',
        ):
            if needle not in index:
                errors.append(f"{plugin_id}: pages/index.html missing {needle}")
        if re.search(r"<script>\s*// Skin order:", index):
            errors.append(f"{plugin_id}: pages/index.html still has inline shell bootstrap")

    if mount_path.is_file():
        mount_src = mount_path.read_text(encoding="utf-8")
        if ext_sidebar:
            if "ExtensionHost.boot" not in mount_src and "extensions.json" not in mount_src:
                errors.append(
                    f"{plugin_id}: plugin-mount.js should boot ExtensionHost from extensions.json"
                )
        else:
            if "hooksOnly" not in mount_src:
                errors.append(f"{plugin_id}: plugin-mount.js should use hooksOnly")
            if "shell-modules.json" not in mount_src:
                errors.append(f"{plugin_id}: plugin-mount.js should load shell-modules.json")

    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--repo",
        type=Path,
        default=Path.cwd(),
        help="Dashboard repo root (default: cwd)",
    )
    args = parser.parse_args()
    repo = args.repo.resolve()
    errors = check_repo(repo)
    if errors:
        for err in errors:
            print(f"FAIL: {err}", file=sys.stderr)
        return 1
    print(f"OK: shell modules validated for {repo.name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
