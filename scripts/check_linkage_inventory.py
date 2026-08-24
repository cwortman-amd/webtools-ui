#!/usr/bin/env python3
"""Validate linkage-inventory.json and ensure critical controls have test references."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INVENTORY = ROOT / "tests" / "contracts" / "linkage-inventory.json"
EXCLUSIONS = ROOT / "tests" / "contracts" / "linkage-exclusions.json"


def main() -> int:
    inv = json.loads(INVENTORY.read_text(encoding="utf-8"))
    exc = json.loads(EXCLUSIONS.read_text(encoding="utf-8"))
    excluded = {(e["consumer"], e["controlId"]) for e in exc.get("exclusions", [])}

    errors: list[str] = []
    warnings: list[str] = []

    for consumer in inv.get("consumers", []):
        cid = consumer.get("id", "")
        if not cid:
            errors.append("consumer missing id")
            continue
        tabs = consumer.get("tabs") or []
        tab_ids = {t.get("id") for t in tabs if t.get("id")}
        for ctrl in consumer.get("controls") or []:
            ctrl_id = ctrl.get("id", "")
            view = ctrl.get("view", "")
            status = ctrl.get("status", "linked")
            critical = ctrl.get("critical", False)
            tests = ctrl.get("tests") or {}
            has_test = any(tests.get(k) for k in ("unit", "integration", "e2e"))

            if view and view not in tab_ids and view not in ("shell", "module", "mcp", "report-action", "suite"):
                warnings.append(f"{cid}.{ctrl_id}: view '{view}' not in tab inventory")

            if (cid, ctrl_id) in excluded or status == "excluded":
                continue

            if status == "gap":
                errors.append(f"{cid}.{ctrl_id}: status=gap (unresolved linkage defect)")

            if critical and not has_test and status not in ("fixed",):
                errors.append(f"{cid}.{ctrl_id}: critical control has no tests registered")

            backend = ctrl.get("backend") or {}
            if critical and backend.get("type") not in ("none", "navigation") and not backend.get("path"):
                errors.append(f"{cid}.{ctrl_id}: critical control missing backend.path")

    for w in warnings:
        print(f"WARN: {w}")
    for e in errors:
        print(f"ERROR: {e}", file=sys.stderr)

    consumers = len(inv.get("consumers", []))
    controls = sum(len(c.get("controls") or []) for c in inv.get("consumers", []))
    print(f"linkage inventory OK: {consumers} consumers, {controls} controls, {len(errors)} errors")
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
