"""Installer must treat skills/ as the canonical skill tree, not .cursor/skills."""

from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
INSTALLER = ROOT / "scripts" / "install_adversarial_workflow.sh"


def test_skill_src_is_platform_skills_directory():
    text = INSTALLER.read_text(encoding="utf-8")
    assert 'SKILL_SRC="${PLATFORM_ROOT}/skills/${SKILL_NAME}"' in text
    assert 'SKILL_SRC="${PLATFORM_ROOT}/.cursor/skills/${SKILL_NAME}"' not in text


def test_consumer_skill_symlink_points_at_shared_skills():
    text = INSTALLER.read_text(encoding="utf-8")
    assert '../../shared/skills/${SKILL_NAME}' in text
    assert '../../shared/.cursor/skills/${SKILL_NAME}' not in text


def test_testing_section_documents_agent_agnostic_runner():
    text = INSTALLER.read_text(encoding="utf-8")
    assert "scripts/run_test_workflow.sh" in text
    assert "coverage.consumer.md" in text
    assert ".cursor/commands/coverage.md" in text
