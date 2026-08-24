"""In-process coverage of check_linkage_inventory.py (preflight subprocess is not measured)."""

from __future__ import annotations

import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location(
    "check_linkage_inventory",
    ROOT / "scripts" / "check_linkage_inventory.py",
)
check = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(check)


def test_main_accepts_committed_inventory():
    assert check.main() == 0


def test_main_reports_gap_and_missing_critical_fields(tmp_path, monkeypatch, capsys):
    inv = {
        "consumers": [
            {"controls": []},
            {
                "id": "demo",
                "tabs": [{"id": "plan"}],
                "controls": [
                    {
                        "id": "orphan.view",
                        "view": "missing-tab",
                        "status": "linked",
                        "critical": False,
                        "backend": {"type": "none"},
                        "tests": {},
                    },
                    {
                        "id": "broken.gap",
                        "view": "plan",
                        "status": "gap",
                        "critical": True,
                        "backend": {"type": "http"},
                        "tests": {},
                    },
                    {
                        "id": "skipped.one",
                        "view": "plan",
                        "status": "excluded",
                        "critical": True,
                        "backend": {"type": "http"},
                        "tests": {},
                    },
                ],
            },
        ]
    }
    inventory = tmp_path / "inv.json"
    exclusions = tmp_path / "exc.json"
    inventory.write_text(json.dumps(inv), encoding="utf-8")
    exclusions.write_text(json.dumps({"exclusions": []}), encoding="utf-8")
    monkeypatch.setattr(check, "INVENTORY", inventory)
    monkeypatch.setattr(check, "EXCLUSIONS", exclusions)
    assert check.main() == 1
    captured = capsys.readouterr()
    combined = captured.out + captured.err
    assert "consumer missing id" in combined or "consumer missing id" in combined
    assert "status=gap" in combined
    assert "backend.path" in combined
    assert "no tests" in combined
    assert "not in tab inventory" in combined
