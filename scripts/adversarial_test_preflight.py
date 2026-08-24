#!/usr/bin/env python3
"""Adversarial test preflight: linkage inventory + on-disk test evidence."""

from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WORKSPACE = ROOT.parent
INVENTORY = ROOT / "tests" / "contracts" / "linkage-inventory.json"
EXCLUSIONS = ROOT / "tests" / "contracts" / "linkage-exclusions.json"

CONSUMER_ROOTS: dict[str, Path] = {
    "webtools-ui": ROOT,
    "llm-benchmark": WORKSPACE / "llm-benchmark",
    "dc-planner": WORKSPACE / "dc-planner",
    "cluster-manager": WORKSPACE / "cluster-manager",
    "demo-portal": WORKSPACE / "demo-portal",
    "knowledge-exchange": WORKSPACE / "knowledge-exchange",
    "slide-presenter": WORKSPACE / "slide-presenter",
}

TEST_REF_RE = re.compile(r"^([^#]+)(?:#(.+))?$")
CHECKED_BACKEND_TYPES = {
    "http",
    "static",
    "navigation",
    "mcp-stdio",
    "mcp-stdio",
    "mcp-bridge",
    "mcp-bridge",
}


def parse_test_ref(ref: str) -> tuple[str, str | None]:
    match = TEST_REF_RE.match(ref.strip())
    if not match:
        return ref.strip(), None
    return match.group(1).strip(), match.group(2)


def collect_test_refs(control: dict) -> list[str]:
    tests = control.get("tests") or {}
    refs: list[str] = []
    for tier in ("unit", "integration", "e2e"):
        for item in tests.get(tier) or []:
            if isinstance(item, str):
                refs.append(item)
    return refs


def anchor_in_source(source: str, anchor: str) -> bool:
    """True when the #fragment from an inventory test ref appears in the file."""
    if not anchor:
        return True
    return anchor in source


def contract_token(backend: dict) -> str | None:
    """Stable string the registered test must mention (path or MCP tool)."""
    btype = (backend or {}).get("type")
    path = (backend or {}).get("path") or ""
    if not path:
        return None
    if btype in ("http", "static", "navigation"):
        return path.split("?")[0]
    if "mcp" in btype:
        return path.split()[-1]
    return None


def source_mentions_contract(source: str, token: str) -> bool:
    if not token:
        return True
    if token in source:
        return True
    # Allow regex-escaped snippets such as /api/presets(?:\\?|$)
    compact = token.replace("/", r"\/")
    return compact in source


def main() -> int:
    inv = json.loads(INVENTORY.read_text(encoding="utf-8"))
    exc = json.loads(EXCLUSIONS.read_text(encoding="utf-8"))
    excluded = {(e["consumer"], e["controlId"]) for e in exc.get("exclusions", [])}

    errors: list[str] = []
    warnings: list[str] = []
    checked_files = 0

    checker = subprocess.run(
        [sys.executable, str(ROOT / "scripts" / "check_linkage_inventory.py")],
        cwd=ROOT,
        capture_output=True,
        text=True,
    )
    if checker.returncode != 0:
        print(checker.stdout, end="")
        print(checker.stderr, file=sys.stderr, end="")
        return checker.returncode
    print(checker.stdout.strip())

    prd = subprocess.run(
        [sys.executable, str(ROOT / "scripts" / "check_prd_p0_map.py")],
        cwd=ROOT,
        capture_output=True,
        text=True,
    )
    print(prd.stdout.strip())
    if prd.returncode != 0:
        print(prd.stderr, file=sys.stderr, end="")
        return prd.returncode

    for consumer in inv.get("consumers", []):
        cid = consumer.get("id", "")
        repo_root = CONSUMER_ROOTS.get(cid)
        if not repo_root:
            warnings.append(f"{cid}: no repo root mapped in adversarial_test_preflight.py")
            continue
        if not repo_root.is_dir():
            warnings.append(f"{cid}: repo root missing on disk: {repo_root}")
            continue

        for ctrl in consumer.get("controls") or []:
            ctrl_id = ctrl.get("id", "")
            status = ctrl.get("status", "linked")
            critical = ctrl.get("critical", False)
            backend = ctrl.get("backend") or {}

            if (cid, ctrl_id) in excluded or status == "excluded":
                continue
            if status == "gap":
                errors.append(f"{cid}.{ctrl_id}: status=gap (unresolved linkage defect)")
                continue

            refs = collect_test_refs(ctrl)
            if critical and not refs and status not in ("fixed",):
                errors.append(f"{cid}.{ctrl_id}: critical control has no tests registered")

            file_bodies: list[str] = []
            for ref in refs:
                rel_path, anchor = parse_test_ref(ref)
                test_path = repo_root / rel_path
                checked_files += 1
                if not test_path.is_file():
                    errors.append(
                        f"{cid}.{ctrl_id}: registered test file missing: {rel_path} "
                        f"(expected at {test_path})"
                    )
                    continue
                source = test_path.read_text(encoding="utf-8", errors="replace")
                file_bodies.append(source)
                if anchor and not anchor_in_source(source, anchor):
                    errors.append(
                        f"{cid}.{ctrl_id}: test anchor #{anchor} not found in {rel_path}"
                    )

            token = contract_token(backend)
            if (
                critical
                and token
                and backend.get("type") in CHECKED_BACKEND_TYPES
                and file_bodies
                and not any(source_mentions_contract(body, token) for body in file_bodies)
            ):
                errors.append(
                    f"{cid}.{ctrl_id}: registered tests never mention backend contract "
                    f"'{token}' (tests would not fail if the path drifted)"
                )

    for w in warnings:
        print(f"WARN: {w}")
    for e in errors:
        print(f"ERROR: {e}", file=sys.stderr)

    controls = sum(len(c.get("controls") or []) for c in inv.get("consumers", []))
    print(
        f"adversarial preflight: {len(inv.get('consumers', []))} consumers, "
        f"{controls} controls, {checked_files} test refs checked, {len(errors)} errors"
    )
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
