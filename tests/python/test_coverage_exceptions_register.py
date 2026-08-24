"""Exception register: keep dated product deferrals; do not claim the program is done."""

from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
REGISTER = ROOT / "docs" / "TEST_COVERAGE_EXCEPTIONS.md"


def test_register_keeps_prd_rbac_flags_and_nightly_rows():
    text = REGISTER.read_text(encoding="utf-8")
    for exc_id in (
        "EXC-PRD-MATRIX",
        "EXC-RBAC",
        "EXC-FLAGS",
        "EXC-NIGHTLY-NET",
        "EXC-JS-C8-TLS",
    ):
        assert exc_id in text, f"missing {exc_id}"
    assert "EXC-EXT-RETIRING" not in text
    assert "program complete" not in text.lower()
    assert "2026-09-30" in text
