"""PRD P0 map: every documented P0 id is mapped or explicitly deferred.

Independent oracle: consumer docs/TEST.md table rows, not the map file itself.
"""

from __future__ import annotations

import importlib.util
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location(
    "check_prd_p0_map",
    ROOT / "scripts" / "check_prd_p0_map.py",
)
checker = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(checker)

SAMPLE = """
| ID | Feature | Priority | Expectation |
| --- | --- | --- | --- |
| DEP-003 | Enqueue button | P0 | Enqueue creates a backlog card |
| DEP-007 | Compact toggle | P1 | Density changes |
| API-006 | Pre-flight validators | P0 | POST /api/validate/sweep |
"""


def test_extract_p0_ids_uses_priority_column_not_row_count():
    ids = checker.extract_p0_ids(SAMPLE)
    assert ids == ["DEP-003", "API-006"]


def test_llm_benchmark_p0_rows_are_accounted_in_map():
    errors = checker.check_consumer("llm-benchmark")
    assert errors == [], errors
