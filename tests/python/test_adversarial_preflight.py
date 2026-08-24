"""Falsification tests for adversarial preflight helpers.

These tests must fail if inventory anchors or backend contract tokens are
ignored — proof that preflight is not a file-existence rubber stamp.
"""

from __future__ import annotations

import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location(
    "adversarial_test_preflight",
    ROOT / "scripts" / "adversarial_test_preflight.py",
)
preflight = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(preflight)


def test_parse_test_ref_splits_anchor():
    path, anchor = preflight.parse_test_ref("tests/e2e/tab-linkage.spec.js#plan-validate")
    assert path == "tests/e2e/tab-linkage.spec.js"
    assert anchor == "plan-validate"


def test_anchor_in_source_fails_when_title_missing():
    source = 'test("plan-load: boot fetches catalog", async () => {});'
    assert preflight.anchor_in_source(source, "plan-load") is True
    assert preflight.anchor_in_source(source, "plan-validate") is False


def test_source_mentions_contract_fails_when_path_removed():
    source = r"expect(hits).toMatch(/\/api\/validate\/sweep/);"
    assert preflight.source_mentions_contract(source, "/api/validate/sweep") is True
    broken = source.replace(r"\/api\/validate\/sweep", r"\/api\/validate\/wrong")
    assert "/api/validate/sweep" not in broken.replace("\\", "")
    assert preflight.source_mentions_contract(broken, "/api/validate/sweep") is False


def test_contract_token_uses_last_mcp_tool_name():
    token = preflight.contract_token(
        {"type": "mcp-stdio", "path": "tools/call list_demos"}
    )
    assert token == "list_demos"


def test_main_accepts_committed_inventory():
    assert preflight.main() == 0


def test_main_fails_when_registered_test_file_is_missing(tmp_path, monkeypatch, capsys):
    inv = {
        "consumers": [
            {
                "id": "webtools-ui",
                "controls": [
                    {
                        "id": "suite.registryLoad",
                        "status": "linked",
                        "critical": True,
                        "backend": {"type": "http", "path": "/plugins.registry.json"},
                        "tests": {"e2e": ["does-not-exist.mjs#suite-registry-load"]},
                    }
                ],
            }
        ]
    }
    inventory = tmp_path / "inv.json"
    exclusions = tmp_path / "exc.json"
    inventory.write_text(json.dumps(inv), encoding="utf-8")
    exclusions.write_text(json.dumps({"exclusions": []}), encoding="utf-8")
    monkeypatch.setattr(preflight, "INVENTORY", inventory)
    monkeypatch.setattr(preflight, "EXCLUSIONS", exclusions)

    class _Ok:
        returncode = 0
        stdout = "ok\n"
        stderr = ""

    monkeypatch.setattr(preflight.subprocess, "run", lambda *a, **k: _Ok())
    assert preflight.main() == 1
    err = capsys.readouterr().err
    assert "registered test file missing" in err or "registered test file missing" in err
