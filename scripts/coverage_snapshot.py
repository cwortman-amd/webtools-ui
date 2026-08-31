#!/usr/bin/env python3
"""Print statement / branch / condition coverage by core module.

Condition % uses coverage.py / c8 branch (partial-branch) data — the closest
instrumented signal without a dedicated MC/DC tool.

Usage:
  python3 scripts/coverage_snapshot.py
  python3 scripts/coverage_snapshot.py --no-run
  python3 scripts/coverage_snapshot.py --iteration 3
  python3 scripts/coverage_snapshot.py --fail-under 80
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import unquote, urlparse

ROOT = Path(__file__).resolve().parents[1]
TARGETS = ROOT / "tests" / "contracts" / "coverage-targets.json"
ART = ROOT / "artifacts"
PY_JSON = ART / "coverage-python.json"
JS_JSON = ART / "coverage-node.json"
OUT_JSON = ART / "coverage-snapshot.json"
REPORT_MD = ART / "coverage-report.md"

DEFAULT_FLOOR = 80.0


def pct(covered: float, total: float) -> float:
    if total <= 0:
        return 100.0
    return round(100.0 * covered / total, 1)


def load_targets() -> dict:
    data = json.loads(TARGETS.read_text(encoding="utf-8"))
    tgt = data.setdefault("target", {})
    if "statements" not in tgt and "lines" in tgt:
        tgt["statements"] = tgt["lines"]
    if "lines" not in tgt and "statements" in tgt:
        tgt["lines"] = tgt["statements"]
    data.setdefault("loopFloor", DEFAULT_FLOOR)
    data["coreModules"] = data.get("coreModules") or data.get("coreModules") or []
    return data


load_targets = load_targets


def _matches(file_key: str, rel: str) -> bool:
    key = file_key.replace("\\", "/")
    needle = rel.rstrip("/")
    if rel.endswith("/"):
        return f"/{needle}/" in f"/{key}/" or key.endswith(f"/{needle}") or needle in key
    return key.endswith(rel) or key.endswith("/" + rel)


_matches = _matches


def summarize_python_file(entry: dict) -> dict:
    summary = entry.get("summary") or {}
    lines = summary.get("num_statements") or 0
    covered_lines = summary.get("covered_lines") or 0
    branches = summary.get("num_branches") or 0
    covered_branches = summary.get("covered_branches") or 0
    statements = pct(covered_lines, lines)
    branch_pct = pct(covered_branches, branches) if branches else 100.0
    return {
        "statements": statements,
        "lines": statements,
        "branches": branch_pct,
        "conditions": branch_pct,
        "num_statements": lines,
        "covered_statements": covered_lines,
        "num_branches": branches,
        "covered_branches": covered_branches,
    }


def summarize_c8_file(entry: dict) -> dict | None:
    stmts = entry.get("s")
    if not isinstance(stmts, dict):
        return None
    line_total = len(stmts)
    line_hit = sum(1 for v in stmts.values() if v)
    branches = entry.get("b") or {}
    branch_total = 0
    branch_hit = 0
    for counts in branches.values():
        for c in counts:
            branch_total += 1
            if c:
                branch_hit += 1
    statements = pct(line_hit, line_total)
    branch_pct = pct(branch_hit, branch_total) if branch_total else 100.0
    return {
        "statements": statements,
        "lines": statements,
        "branches": branch_pct,
        "conditions": branch_pct,
        "num_statements": line_total,
        "covered_statements": line_hit,
        "num_branches": branch_total,
        "covered_branches": branch_hit,
    }


def collect_stats(py_report: dict, js_report: dict, paths: list[str]) -> list[dict]:
    stats: list[dict] = []
    py_files = py_report.get("files") or {}
    for rel in paths:
        for key, val in py_files.items():
            if _matches(key, rel):
                stats.append(summarize_python_file(val))
        for key, val in (js_report or {}).items():
            if not isinstance(val, dict):
                continue
            if _matches(str(key), rel):
                summarized = summarize_c8_file(val)
                if summarized:
                    stats.append(summarized)
    return stats


def score_status(statements: float, branches: float, conditions: float, floor: float, stretch: float) -> str:
    lowest = min(statements, branches, conditions)
    if lowest >= stretch:
        return "STRETCH"
    if lowest >= floor:
        return "FLOOR_OK"
    return "BELOW_FLOOR"


def module_row(mod: dict, py_report: dict, js_report: dict, floor: float, stretch: float) -> dict:
    stats = collect_stats(py_report, js_report, mod.get("paths") or [])
    if not stats:
        return {
            "id": mod["id"],
            "statements": 0.0,
            "lines": 0.0,
            "branches": 0.0,
            "conditions": 0.0,
            "status": "NO_DATA",
        }
    n = len(stats)
    statements = round(sum(s["statements"] for s in stats) / n, 1)
    branches = round(sum(s["branches"] for s in stats) / n, 1)
    conditions = round(sum(s["conditions"] for s in stats) / n, 1)
    return {
        "id": mod["id"],
        "statements": statements,
        "lines": statements,
        "branches": branches,
        "conditions": conditions,
        "status": score_status(statements, branches, conditions, floor, stretch),
    }


def overall_from_python(py_report: dict) -> dict | None:
    totals = py_report.get("totals") or {}
    stmts = totals.get("num_statements") or 0
    if stmts <= 0 and not totals:
        return None
    covered = totals.get("covered_lines") or 0
    branches = totals.get("num_branches") or 0
    covered_branches = totals.get("covered_branches") or 0
    statements = pct(covered, stmts)
    branch_pct = pct(covered_branches, branches) if branches else 100.0
    return {
        "id": "overall.python",
        "statements": statements,
        "lines": statements,
        "branches": branch_pct,
        "conditions": branch_pct,
        "num_statements": stmts,
        "covered_statements": covered,
        "num_branches": branches,
        "covered_branches": covered_branches,
        "status": "MEASURED",
    }


def overall_from_rows(rows: list[dict], floor: float, stretch: float) -> dict:
    measured = [r for r in rows if r.get("status") != "NO_DATA"]
    if not measured:
        return {
            "id": "overall.core-modules",
            "statements": 0.0,
            "lines": 0.0,
            "branches": 0.0,
            "conditions": 0.0,
            "status": "NO_DATA",
        }
    n = len(measured)
    statements = round(sum(r["statements"] for r in measured) / n, 1)
    branches = round(sum(r["branches"] for r in measured) / n, 1)
    conditions = round(sum(r["conditions"] for r in measured) / n, 1)
    return {
        "id": "overall.core-modules",
        "statements": statements,
        "lines": statements,
        "branches": branches,
        "conditions": conditions,
        "status": score_status(statements, branches, conditions, floor, stretch),
    }


def measured_meet_floor(rows: list[dict], extra: list[dict], floor: float) -> bool:
    pool = [r for r in rows + extra if r.get("status") not in {"NO_DATA", None}]
    measured = [r for r in pool if r.get("status") != "NO_DATA"]
    if not measured:
        return False
    return all(
        r["statements"] >= floor and r["branches"] >= floor and r["conditions"] >= floor
        for r in measured
        if r.get("id") != "overall.python"  # python overall is informational; core-modules + floor
    ) and all(
        r["statements"] >= floor and r["branches"] >= floor and r["conditions"] >= floor
        for r in measured
        if r.get("id") == "overall.core-modules"
    )


def run_python_coverage() -> dict:
    ART.mkdir(parents=True, exist_ok=True)
    cmd = [
        sys.executable,
        "-m",
        "pytest",
        "tests/python",
        "-q",
        "--cov=python",
        "--cov=scripts",
        "--cov-branch",
        f"--cov-report=json:{PY_JSON}",
        "--cov-report=term-missing",
        "--cov-fail-under=0",
    ]
    proc = subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True)
    sys.stdout.write(proc.stdout)
    sys.stderr.write(proc.stderr)
    if not PY_JSON.is_file():
        return {"files": {}, "totals": {}}
    return json.loads(PY_JSON.read_text(encoding="utf-8"))


def _file_url_to_path(url: str) -> str | None:
    if not url or not str(url).startswith("file:"):
        return None
    parsed = urlparse(url)
    path = unquote(parsed.path or "")
    if os.name == "nt" and path.startswith("/") and len(path) > 2 and path[2] == ":":
        path = path[1:]
    return path or None


def v8_scripts_to_c8(payload: dict) -> dict:
    """Map V8 NODE_V8_COVERAGE JSON onto the c8 `s`/`b` maps snapshot reads."""
    out: dict[str, dict] = {}
    for script in payload.get("result") or []:
        path = _file_url_to_path(script.get("url") or "")
        if not path:
            continue
        stmts: dict[str, int] = {}
        branches: dict[str, list[int]] = {}
        si = 0
        bi = 0
        for fn in script.get("functions") or []:
            ranges = fn.get("ranges") or []
            counts = [int(r.get("count") or 0) for r in ranges]
            for count in counts:
                stmts[str(si)] = count
                si += 1
            if len(counts) > 1:
                branches[str(bi)] = counts
                bi += 1
        if path not in out:
            out[path] = {"s": stmts, "b": branches}
            continue
        existing = out[path]
        for key, count in stmts.items():
            prev = existing["s"].get(key, 0)
            existing["s"][key] = max(prev, count)
        for key, counts in branches.items():
            prev = existing["b"].get(key)
            if prev is None:
                existing["b"][key] = counts
            else:
                existing["b"][key] = [max(a, b) for a, b in zip(prev, counts)]
    return out


def _merge_c8_maps(base: dict, extra: dict) -> dict:
    merged = dict(base)
    for path, entry in extra.items():
        if path not in merged:
            merged[path] = entry
            continue
        for key, count in (entry.get("s") or {}).items():
            prev = merged[path].setdefault("s", {}).get(key, 0)
            merged[path]["s"][key] = max(prev, count)
        for key, counts in (entry.get("b") or {}).items():
            prev = merged[path].setdefault("b", {}).get(key)
            if prev is None:
                merged[path]["b"][key] = counts
            else:
                merged[path]["b"][key] = [max(a, b) for a, b in zip(prev, counts)]
    return merged


def _node_test_files() -> list[str]:
    files = sorted(
        str(p.relative_to(ROOT)) for p in (ROOT / "tests" / "lib").glob("*.test.mjs")
    )
    files += sorted(str(p.relative_to(ROOT)) for p in (ROOT / "js").glob("*.test.mjs"))
    return files


def run_node_coverage() -> dict:
    ART.mkdir(parents=True, exist_ok=True)
    test_files = _node_test_files()
    local_c8 = ROOT / "node_modules" / ".bin" / "c8"
    if local_c8.is_file() and test_files:
        cmd = [
            str(local_c8),
            "--reporter=json",
            f"--temp-directory={ART / 'c8-tmp'}",
            "--src=js",
            "node",
            "--test",
            *test_files,
        ]
        proc = subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True)
        sys.stdout.write(proc.stdout)
        sys.stderr.write(proc.stderr)
        candidates = [
            ROOT / "coverage" / "coverage-final.json",
            ART / "coverage-final.json",
            JS_JSON,
        ]
        for path in candidates:
            if path.is_file():
                data = json.loads(path.read_text(encoding="utf-8"))
                JS_JSON.write_text(json.dumps(data), encoding="utf-8")
                return data

    v8dir = ART / "v8-coverage"
    if v8dir.exists():
        shutil.rmtree(v8dir)
    v8dir.mkdir(parents=True, exist_ok=True)
    env = os.environ.copy()
    env["NODE_V8_COVERAGE"] = str(v8dir)
    cmd = [
        "node",
        "--experimental-test-coverage",
        "--test-coverage-include=js/**",
        "--test",
        *test_files,
    ]
    proc = subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True, env=env)
    sys.stdout.write(proc.stdout)
    sys.stderr.write(proc.stderr)
    merged: dict = {}
    for path in v8dir.glob("*.json"):
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            continue
        merged = _merge_c8_maps(merged, v8_scripts_to_c8(payload))
    if merged:
        JS_JSON.write_text(json.dumps(merged), encoding="utf-8")
    return merged


def print_table(
    iteration: int | None,
    rows: list[dict],
    overall_core: dict,
    py_overall: dict | None,
    target: dict,
    floor: float,
    floor_met: bool,
) -> None:
    hdr = "Statement / branch / condition coverage by core module"
    if iteration is not None:
        hdr += f"  (iteration {iteration})"
    print()
    print(hdr)
    print(
        f"Loop floor: {floor:.0f}%  ·  Stretch: statements {target.get('statements', target.get('lines'))}% · "
        f"branches {target['branches']}% · conditions {target['conditions']}%"
    )
    print("Condition % is partial-branch (coverage.py / c8), not MC/DC.")
    print()
    print(f"{'Module':<28} {'Statements':>11} {'Branches':>10} {'Conditions':>12} {'Status':>12}")
    print("-" * 78)
    for row in rows:
        print(
            f"{row['id']:<28} {row['statements']:>10.1f}% {row['branches']:>9.1f}% "
            f"{row['conditions']:>11.1f}% {row['status']:>12}"
        )
    print("-" * 78)
    print(
        f"{overall_core['id']:<28} {overall_core['statements']:>10.1f}% "
        f"{overall_core['branches']:>9.1f}% {overall_core['conditions']:>11.1f}% "
        f"{overall_core['status']:>12}"
    )
    if py_overall:
        print(
            f"{py_overall['id']:<28} {py_overall['statements']:>10.1f}% "
            f"{py_overall['branches']:>9.1f}% {py_overall['conditions']:>11.1f}% "
            f"{py_overall['status']:>12}"
        )
    print()
    if floor_met:
        print(f"FLOOR MET: measured statement/branch/condition all ≥ {floor:.0f}%.")
        print(f"Final report: {REPORT_MD}")
    else:
        print(f"INTERIM: keep /test expansion until measured scores are ≥ {floor:.0f}%.")
        below = [r["id"] for r in rows if r["status"] in {"BELOW_FLOOR", "NO_DATA"}]
        if below:
            print("Still open: " + ", ".join(below))
    print()


def write_report(
    *,
    iteration: int | None,
    rows: list[dict],
    overall_core: dict,
    py_overall: dict | None,
    floor: float,
    floor_met: bool,
    target: dict,
) -> None:
    ART.mkdir(parents=True, exist_ok=True)
    kind = "Final" if floor_met else "Interim"
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    lines = [
        f"# {kind} coverage report",
        "",
        f"Generated: {now}",
        f"Iteration: {iteration if iteration is not None else 'n/a'}",
        f"Loop floor: {floor:.0f}% statement **and** branch **and** condition",
        f"Stretch: {target.get('statements', target.get('lines'))}% / "
        f"{target['branches']}% / {target['conditions']}%",
        "",
        "Condition coverage is coverage.py / c8 **partial-branch**, not MC/DC.",
        "",
        "| Module | Statements | Branches | Conditions | Status |",
        "| :--- | ---: | ---: | ---: | :--- |",
    ]
    for row in rows + [overall_core] + ([py_overall] if py_overall else []):
        lines.append(
            f"| {row['id']} | {row['statements']:.1f}% | {row['branches']:.1f}% | "
            f"{row['conditions']:.1f}% | {row['status']} |"
        )
    lines.extend(
        [
            "",
            f"Floor met: **{'yes' if floor_met else 'no'}**",
            "",
            "Do not treat this as adversarial-program complete. Residual P0 docs "
            "and `NO_DATA` modules still need tests or dated exceptions.",
            "",
        ]
    )
    REPORT_MD.write_text("\n".join(lines), encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--no-run", action="store_true")
    parser.add_argument("--iteration", type=int, default=None)
    parser.add_argument("--fail-under", type=float, default=None)
    parser.add_argument("--floor", type=float, default=None, help="loop floor %% (default: coverage-targets loopFloor or 80)")
    args = parser.parse_args()

    cfg = load_targets()
    target = cfg["target"]
    floor = args.floor if args.floor is not None else float(cfg.get("loopFloor", DEFAULT_FLOOR))
    stretch = float(target.get("statements") or target.get("lines") or 100)

    if args.no_run:
        py_report = json.loads(PY_JSON.read_text()) if PY_JSON.is_file() else {"files": {}, "totals": {}}
        js_report = json.loads(JS_JSON.read_text()) if JS_JSON.is_file() else {}
    else:
        py_report = run_python_coverage()
        js_report = run_node_coverage()

    modules = cfg.get("coreModules") or []
    rows = [module_row(m, py_report, js_report, floor, stretch) for m in modules]
    overall_core = overall_from_rows(rows, floor, stretch)
    py_overall = overall_from_python(py_report)
    if py_overall:
        py_overall["status"] = score_status(
            py_overall["statements"], py_overall["branches"], py_overall["conditions"], floor, stretch
        )

    extras = [overall_core] + ([py_overall] if py_overall else [])
    floor_met = measured_meet_floor(rows, extras, floor)

    ART.mkdir(parents=True, exist_ok=True)
    payload = {
        "iteration": args.iteration,
        "floor": floor,
        "floorMet": floor_met,
        "reportKind": "final" if floor_met else "interim",
        "target": target,
        "modules": rows,
        "overallCoreModules": overall_core,
        "overallPython": py_overall,
    }
    OUT_JSON.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    write_report(
        iteration=args.iteration,
        rows=rows,
        overall_core=overall_core,
        py_overall=py_overall,
        floor=floor,
        floor_met=floor_met,
        target=target,
    )
    print_table(args.iteration, rows, overall_core, py_overall, target, floor, floor_met)

    gate = args.fail_under
    if gate is not None:
        failed = [
            r
            for r in rows + extras
            if r.get("status") == "NO_DATA"
            or r["statements"] < gate
            or r["branches"] < gate
            or r["conditions"] < gate
        ]
        if failed:
            return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
