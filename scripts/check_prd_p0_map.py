#!/usr/bin/env python3
"""Ensure consumer TEST.md P0 ids are mapped to tests or explicitly deferred."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WORKSPACE = ROOT.parent
MAP_PATH = ROOT / "tests" / "contracts" / "prd-p0-map.json"

CONSUMER_ROOTS: dict[str, Path] = {
    "webtools-ui": ROOT,
    "llm-benchmark": WORKSPACE / "llm-benchmark",
    "dc-planner": WORKSPACE / "dc-planner",
    "cluster-manager": WORKSPACE / "cluster-manager",
    "demo-portal": WORKSPACE / "demo-portal",
    "knowledge-exchange": WORKSPACE / "knowledge-exchange",
    "slide-presenter": WORKSPACE / "slide-presenter",
}

P0_ID_RE = re.compile(r"^[A-Z][A-Z0-9]{0,7}-\d+$")
PRIORITY_P0_RE = re.compile(r"(?:^|[^A-Z0-9-])P0(?:[^0-9]|$)")
TEST_REF_RE = re.compile(r"^([^#]+)(?:#(.+))?$")


def extract_p0_ids(markdown: str) -> list[str]:
    """IDs from markdown tables whose Priority cell is P0 (not P0-09 / P1)."""
    found: list[str] = []
    seen: set[str] = set()
    for line in markdown.splitlines():
        if not line.startswith("|"):
            continue
        cells = [c.strip() for c in line.strip("|").split("|")]
        if len(cells) < 3:
            continue
        claim_id, priority = cells[0], cells[2]
        if not P0_ID_RE.match(claim_id):
            continue
        if priority != "P0" and not (
            PRIORITY_P0_RE.search(priority) and not re.search(r"P0-\d", priority)
        ):
            continue
        if claim_id not in seen:
            seen.add(claim_id)
            found.append(claim_id)
    return found


def _load_map() -> dict:
    return json.loads(MAP_PATH.read_text(encoding="utf-8"))


def check_consumer(consumer_id: str) -> list[str]:
    data = _load_map()
    entry = (data.get("consumers") or {}).get(consumer_id)
    if not entry:
        return [f"{consumer_id}: missing from {MAP_PATH.name}"]

    repo = CONSUMER_ROOTS.get(consumer_id)
    if repo is None or not repo.is_dir():
        return [f"{consumer_id}: repo root missing"]

    plan_rel = entry.get("testPlan") or entry.get("testPlan") or "docs/TEST.md"
    plan = repo / plan_rel
    if not plan.is_file():
        return [f"{consumer_id}: test plan missing: {plan_rel}"]

    documented = extract_p0_ids(plan.read_text(encoding="utf-8"))
    mapped_rows = entry.get("mapped") or []
    deferred_rows = entry.get("deferred") or []
    mapped_ids = [row["id"] for row in mapped_rows if row.get("id")]
    deferred_ids = [row["id"] for row in deferred_rows if row.get("id")]
    accounted = set(mapped_ids) | set(deferred_ids)

    errors: list[str] = []
    if entry.get("enforce", True):
        missing = [i for i in documented if i not in accounted]
        extra = sorted(accounted - set(documented))
        if missing:
            errors.append(f"{consumer_id}: P0 ids not mapped or deferred: {missing}")
        if extra:
            errors.append(f"{consumer_id}: map ids not in TEST.md P0 rows: {extra}")
        dupes = [i for i in mapped_ids if i in deferred_ids]
        if dupes:
            errors.append(f"{consumer_id}: ids both mapped and deferred: {dupes}")

    for row in mapped_rows:
        cid = row.get("id", "")
        tests = row.get("tests") or []
        if not tests:
            errors.append(f"{consumer_id}.{cid}: mapped row has no tests")
            continue
        for ref in tests:
            match = TEST_REF_RE.match(ref.strip())
            rel = match.group(1) if match else ref
            path = repo / rel
            if not path.is_file():
                errors.append(f"{consumer_id}.{cid}: test missing: {rel}")
    return errors


extract_p0_ids = extract_p0_ids
check_consumer = check_consumer


def main() -> int:
    data = _load_map()
    errors: list[str] = []
    for consumer_id in data.get("consumers") or {}:
        errors.extend(check_consumer(consumer_id))
    for err in errors:
        print(f"ERROR: {err}", file=sys.stderr)
    n = len(data.get("consumers") or {})
    print(f"prd-p0-map: {n} consumers, {len(errors)} errors")
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
