"""Unit tests for coverage snapshot helpers (no full suite run)."""

from __future__ import annotations

import importlib.util
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location(
    "coverage_snapshot",
    ROOT / "scripts" / "coverage_snapshot.py",
)
snap = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(snap)


def test_pct_empty_is_complete():
    assert snap.pct(0, 0) == 100.0


def test_pct_partial():
    assert snap.pct(1, 4) == 25.0


def test_matches_file_suffix():
    assert snap._matches("/x/webtools-ui/js/shell.js", "js/shell.js") is True
    assert snap._matches("/x/webtools-ui/js/other.js", "js/shell.js") is False


def test_matches_directory_prefix():
    assert snap._matches("/x/python/webtools_mcp/host.py", "python/webtools_mcp/") is True


def test_targets_json_has_core_modules():
    cfg = snap.load_targets()
    assert cfg["target"]["lines"] == 100
    assert cfg["target"]["statements"] == 100
    assert cfg["loopFloor"] == 80
    assert cfg["coreModules"]
    ids = {m["id"] for m in cfg["coreModules"]}
    assert "js.plugin-bootstrap" in ids
    assert "python.webtools-mcp" in ids


def test_score_status_uses_loop_floor():
    assert snap.score_status(80, 80, 80, 80, 100) == "FLOOR_OK"
    assert snap.score_status(100, 100, 100, 80, 100) == "STRETCH"
    assert snap.score_status(79, 90, 90, 80, 100) == "BELOW_FLOOR"


def test_v8_scripts_to_c8_counts_ranges():
    payload = {
        "result": [
            {
                "url": "file:///home/cwortman/workspace/webtools-ui/js/shell.js",
                "functions": [
                    {
                        "ranges": [
                            {"startOffset": 0, "endOffset": 10, "count": 3},
                            {"startOffset": 10, "endOffset": 20, "count": 0},
                        ]
                    }
                ],
            }
        ]
    }
    mapped = snap.v8_scripts_to_c8(payload)
    key = "/home/cwortman/workspace/webtools-ui/js/shell.js"
    assert key in mapped
    assert mapped[key]["s"]["0"] == 3
    assert mapped[key]["s"]["1"] == 0
    assert mapped[key]["b"]["0"] == [3, 0]


def test_file_url_to_path_rejects_non_file():
    assert snap._file_url_to_path("https://example.test/x.js") is None


def test_summarize_c8_file_computes_partial_branch():
    row = snap.summarize_c8_file({"s": {"1": 1, "2": 0}, "b": {"0": [1, 0]}})
    assert row["statements"] == 50.0
    assert row["branches"] == 50.0
    assert row["conditions"] == 50.0


def test_measured_meet_floor_ignores_no_data_modules():
    rows = [
        {"id": "js.shell", "statements": 0, "branches": 0, "conditions": 0, "status": "NO_DATA"},
        {"id": "python.webtools-mcp", "statements": 82, "branches": 81, "conditions": 81, "status": "FLOOR_OK"},
    ]
    overall = snap.overall_from_rows(rows, 80, 100)
    assert overall["status"] == "FLOOR_OK"
    assert snap.measured_meet_floor(rows, [overall], 80) is True
