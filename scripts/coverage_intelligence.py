#!/usr/bin/env python3
"""Rank behavioral coverage gaps — not uncovered line ranges.

Maps linkage-inventory controls (and optional coverage-snapshot JSON) to a
prioritized gap backlog. Priority is I×E×C×D×R (impact, exposure, change,
documentation, regression). Line coverage is a clue, never the rank key.

Usage:
  python3 scripts/coverage_intelligence.py
  python3 scripts/coverage_intelligence.py --write
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INVENTORY = ROOT / "tests" / "contracts" / "linkage-inventory.json"
SNAPSHOT = ROOT / "artifacts" / "coverage-snapshot.json"
OUT_DIR = ROOT / "artifacts" / "coverage-intelligence"
BACKLOG_JSON = OUT_DIR / "gap-backlog.json"
BACKLOG_MD = OUT_DIR / "gap-backlog.md"
LEDGER_JSON = OUT_DIR / "behavioral-coverage-ledger.json"

RISK_BY_BACKEND = {
    "http": "api-compatibility",
    "static": "user-visible-behavior",
    "navigation": "user-visible-behavior",
    "mcp-stdio": "configuration",
    "mcp-http": "api-compatibility",
    "mcp-bridge": "api-compatibility",
    "none": "user-visible-behavior",
}


def load_inventory(path: Path = INVENTORY) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def control_tests(control: dict) -> list[str]:
    tests = control.get("tests") or {}
    refs: list[str] = []
    for _tier, items in tests.items():
        if isinstance(items, list):
            refs.extend(str(x) for x in items)
        elif isinstance(items, str):
            refs.append(items)
    return refs


def gap_kind(control: dict) -> str | None:
    """Behavioral gap class, or None if currently verified."""
    status = (control.get("status") or "").lower()
    refs = control_tests(control)
    backend = (control.get("backend") or {}) if isinstance(control.get("backend"), dict) else {}
    btype = (backend.get("type") or "none").lower()
    if status in {"gap", "unverified", "missing"}:
        return "unverified-documented-behavior"
    if status == "excluded":
        return None
    if not refs:
        return "implementation-without-test-evidence"
    if btype not in {"", "none"} and not (control.get("uiConfirmation") or control.get("ui_confirmation")):
        return "backend-without-visible-confirmation"
    if btype not in {"", "none"} and not any("#" in r for r in refs):
        return "weak-linkage-proof"
    return None


def score_factors(control: dict, kind: str) -> dict[str, int]:
    """Return I, E, C, D, R in 1–5. Line coverage is not used as I/E/C/D/R."""
    critical = bool(control.get("critical"))
    backend = (control.get("backend") or {}) if isinstance(control.get("backend"), dict) else {}
    btype = (backend.get("type") or "none").lower()
    impact = 5 if critical else 3
    if btype in {"http", "mcp-http", "mcp-stdio", "mcp-bridge"}:
        impact = max(impact, 4)
    exposure = 4 if critical else 2
    if btype == "http":
        exposure = max(exposure, 3)
    change = 2  # raised by callers when a file is in the PR diff
    documentation = 4 if critical else 3
    regression = 3
    if kind == "unverified-documented-behavior":
        regression = 5
    elif kind == "implementation-without-test-evidence":
        regression = 4
    elif kind == "weak-linkage-proof":
        regression = 3
    return {"I": impact, "E": exposure, "C": change, "D": documentation, "R": regression}


def priority(factors: dict[str, int]) -> int:
    return int(factors["I"] * factors["E"] * factors["C"] * factors["D"] * factors["R"])


def objective_for(consumer_id: str, control: dict, kind: str) -> str:
    label = control.get("label") or control.get("id")
    backend = (control.get("backend") or {}) if isinstance(control.get("backend"), dict) else {}
    path = backend.get("path") or ""
    action = control.get("action") or "use"
    if kind == "unverified-documented-behavior":
        if path:
            return (
                f"{consumer_id}: {action} «{label}» must issue {backend.get('method', '')} {path} "
                f"and show {control.get('uiConfirmation') or 'a visible confirmation'}."
            )
        return f"{consumer_id}: «{label}» has a documented behavior with no verified test evidence."
    if kind == "implementation-without-test-evidence":
        return f"{consumer_id}: «{label}» is implemented but has no registered test."
    if kind == "backend-without-visible-confirmation":
        return f"{consumer_id}: «{label}» hits {path} but has no UI confirmation selector."
    if kind == "weak-linkage-proof":
        return (
            f"{consumer_id}: «{label}» tests exist but lack an #anchor that can be falsified "
            f"against {path or 'the backend contract'}."
        )
    return f"{consumer_id}: «{label}» — {kind}"


def build_backlog(inventory: dict) -> list[dict]:
    rows: list[dict] = []
    for consumer in inventory.get("consumers") or []:
        cid = consumer.get("id") or "unknown"
        for control in consumer.get("controls") or []:
            kind = gap_kind(control)
            if not kind:
                continue
            factors = score_factors(control, kind)
            backend = (control.get("backend") or {}) if isinstance(control.get("backend"), dict) else {}
            rows.append(
                {
                    "id": f"{cid}.{control.get('id')}",
                    "consumer": cid,
                    "controlId": control.get("id"),
                    "feature": control.get("label") or control.get("id"),
                    "objective": objective_for(cid, control, kind),
                    "kind": kind,
                    "riskCategory": RISK_BY_BACKEND.get(
                        (backend.get("type") or "none").lower(), "user-visible-behavior"
                    ),
                    "frontend": {
                        "view": control.get("view"),
                        "selector": control.get("selector"),
                        "action": control.get("action"),
                    },
                    "backend": backend,
                    "priority": priority(factors),
                    "factors": factors,
                    "clue": "inventory-status-and-tests",
                    "lineRanges": [],
                    "existingTests": control_tests(control),
                    "critical": bool(control.get("critical")),
                }
            )
    rows.sort(key=lambda r: (-r["priority"], r["id"]))
    return rows


def ledger_from_inventory(inventory: dict) -> dict:
    """Behavioral coverage = verified obligations / applicable obligations."""
    features = []
    verified = 0
    total = 0
    for consumer in inventory.get("consumers") or []:
        cid = consumer.get("id") or "unknown"
        for control in consumer.get("controls") or []:
            if (control.get("status") or "").lower() == "excluded":
                continue
            obligations = [
                "frontend-control-reachable",
                "test-evidence",
            ]
            backend = (control.get("backend") or {}) if isinstance(control.get("backend"), dict) else {}
            if (backend.get("type") or "none").lower() not in {"", "none"}:
                obligations.extend(
                    ["request-contract", "backend-effect", "visible-confirmation"]
                )
            refs = control_tests(control)
            status = (control.get("status") or "").lower()
            met = []
            unmet = []
            for ob in obligations:
                ok = False
                if ob == "frontend-control-reachable":
                    ok = bool(control.get("selector") or control.get("view"))
                elif ob == "test-evidence":
                    ok = bool(refs) and status == "linked"
                elif ob == "request-contract":
                    ok = bool(backend.get("path")) and status == "linked"
                elif ob == "backend-effect":
                    ok = status == "linked"
                elif ob == "visible-confirmation":
                    ok = bool(control.get("uiConfirmation") or control.get("ui_confirmation"))
                (met if ok else unmet).append(ob)
            total += len(obligations)
            verified += len(met)
            features.append(
                {
                    "id": f"{cid}.{control.get('id')}",
                    "consumer": cid,
                    "label": control.get("label"),
                    "obligations": len(obligations),
                    "verified": len(met),
                    "open": unmet,
                    "status": "covered"
                    if not unmet
                    else ("conditionally-covered" if met else "uncovered"),
                }
            )
    pct = round(100.0 * verified / total, 1) if total else 100.0
    return {
        "date": date.today().isoformat(),
        "behavioralCoveragePercent": pct,
        "verifiedObligations": verified,
        "applicableObligations": total,
        "features": features,
    }


def print_backlog(rows: list[dict], ledger: dict) -> None:
    print()
    print("Ranked behavioral coverage-gap backlog")
    print(
        f"Behavioral coverage: {ledger['verifiedObligations']}/"
        f"{ledger['applicableObligations']} obligations "
        f"({ledger['behavioralCoveragePercent']}%)"
    )
    print("Rank key: P = I×E×C×D×R. Uncovered lines are clues, not the objective.")
    print()
    print(f"{'#':>3} {'P':>5} {'Kind':<36} {'Objective'}")
    print("-" * 100)
    for i, row in enumerate(rows[:25], 1):
        obj = row["objective"]
        if len(obj) > 70:
            obj = obj[:67] + "..."
        print(f"{i:>3} {row['priority']:>5} {row['kind']:<36} {obj}")
    if len(rows) > 25:
        print(f"... {len(rows) - 25} more (see {BACKLOG_JSON})")
    print()


def write_outputs(rows: list[dict], ledger: dict) -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    payload = {
        "date": date.today().isoformat(),
        "priorityFormula": "P = I × E × C × D × R",
        "note": "Objectives are feature behaviors. lineRanges stay empty unless a coverage snapshot maps a path.",
        "gaps": rows,
    }
    BACKLOG_JSON.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    LEDGER_JSON.write_text(json.dumps(ledger, indent=2) + "\n", encoding="utf-8")
    lines = [
        "# Coverage-gap backlog (generated)",
        "",
        f"Behavioral coverage: **{ledger['behavioralCoveragePercent']}%** "
        f"({ledger['verifiedObligations']}/{ledger['applicableObligations']} obligations).",
        "",
        "| Rank | P | Feature | Objective | Kind |",
        "| --- | --- | --- | --- | --- |",
    ]
    for i, row in enumerate(rows, 1):
        lines.append(
            f"| {i} | {row['priority']} | `{row['id']}` | {row['objective']} | {row['kind']} |"
        )
    BACKLOG_MD.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--write", action="store_true", help="write artifacts/coverage-intelligence/")
    args = parser.parse_args()
    if not INVENTORY.is_file():
        print(f"missing inventory {INVENTORY}", file=sys.stderr)
        return 2
    inventory = load_inventory()
    rows = build_backlog(inventory)
    ledger = ledger_from_inventory(inventory)
    print_backlog(rows, ledger)
    if args.write:
        write_outputs(rows, ledger)
        print(f"Wrote {BACKLOG_JSON}")
        print(f"Wrote {LEDGER_JSON}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
