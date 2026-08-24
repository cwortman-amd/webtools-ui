"""Coverage intelligence ranks behavioral gaps, not uncovered line ranges."""

from __future__ import annotations

import importlib.util
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location(
    "coverage_intelligence",
    ROOT / "scripts" / "coverage_intelligence.py",
)
mod = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(mod)


def test_priority_is_product_of_factors():
    assert mod.priority({"I": 5, "E": 4, "C": 2, "D": 4, "R": 5}) == 800


def test_gap_kind_unverified_beats_line_ranges():
    control = {
        "id": "queue.retryToggle",
        "label": "Retry toggle",
        "status": "gap",
        "critical": True,
        "backend": {"type": "http", "method": "POST", "path": "/api/jobs/retry-policy"},
        "tests": {},
        "uiConfirmation": "#retryStatus",
        "selector": "#retryToggle",
        "action": "click",
    }
    kind = mod.gap_kind(control)
    assert kind == "unverified-documented-behavior"
    obj = mod.objective_for("llm-benchmark", control, kind)
    assert "Retry toggle" in obj
    assert "/api/jobs/retry-policy" in obj
    assert "lines " not in obj.lower()


def test_excluded_controls_are_not_gaps():
    assert mod.gap_kind({"status": "excluded", "tests": {}}) is None


def test_linked_with_anchored_tests_is_not_a_gap():
    control = {
        "status": "linked",
        "backend": {"type": "http", "path": "/api/x"},
        "uiConfirmation": "#ok",
        "tests": {"e2e": ["tests/e2e/tab-linkage.spec.js#plan-load"]},
    }
    assert mod.gap_kind(control) is None


def test_ledger_counts_obligations_not_lines():
    inventory = {
        "consumers": [
            {
                "id": "demo",
                "controls": [
                    {
                        "id": "a",
                        "status": "linked",
                        "selector": "#a",
                        "backend": {"type": "http", "path": "/api/a"},
                        "uiConfirmation": "#out",
                        "tests": {"e2e": ["t.js#a"]},
                    },
                    {
                        "id": "b",
                        "status": "gap",
                        "selector": "#b",
                        "backend": {"type": "none"},
                        "tests": {},
                    },
                ],
            }
        ]
    }
    ledger = mod.ledger_from_inventory(inventory)
    assert ledger["applicableObligations"] == 7  # 5 + 2
    # Linked control meets all five obligations; the gap control still meets
    # frontend-control-reachable because a selector is present.
    assert ledger["verifiedObligations"] == 6
    assert ledger["features"][1]["status"] == "conditionally-covered"
