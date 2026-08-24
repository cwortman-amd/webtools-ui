"""/coverage and /test must be wired for the 80% expansion loop."""

from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def test_coverage_command_requires_three_metrics_and_floor():
    text = (ROOT / ".cursor" / "commands" / "coverage.md").read_text(encoding="utf-8")
    assert "**statement**" in text or "statement" in text.lower()
    assert "branch" in text.lower()
    assert "condition" in text.lower()
    assert "80%" in text
    assert "coverage-report.md" in text
    assert "make coverage-snapshot" in text


def test_test_command_invokes_coverage_loop():
    text = (ROOT / ".cursor" / "commands" / "test.md").read_text(encoding="utf-8")
    assert "`/coverage`" in text
    assert "80%" in text
    assert "expansion loop" in text.lower() or "expansion" in text.lower()
    assert "coverage-report.md" in text


def test_consumer_and_user_templates_call_coverage():
    consumer = (ROOT / ".cursor" / "templates" / "test.consumer.md").read_text(encoding="utf-8")
    user = (ROOT / ".cursor" / "templates" / "test.user.md").read_text(encoding="utf-8")
    assert "`/coverage`" in consumer
    assert "80%" in consumer
    assert "`/coverage`" in user
    cov_c = (ROOT / ".cursor" / "templates" / "coverage.consumer.md").read_text(encoding="utf-8")
    cov_u = (ROOT / ".cursor" / "templates" / "coverage.user.md").read_text(encoding="utf-8")
    assert "80%" in cov_c and "statement" in cov_c.lower()
    assert "80%" in cov_u and "branch" in cov_u.lower()
