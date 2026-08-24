"""Slide Presenter extension packs must collect under pytest without --noconftest."""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SLIDE = ROOT.parent / "slide-presenter"


def test_extension_pytest_collects_without_noconftest():
    assert SLIDE.is_dir(), f"missing sibling {SLIDE}"
    env = os.environ.copy()
    env["PYTHONDONTWRITEBYTECODE"] = "1"
    proc = subprocess.run(
        [sys.executable, "-m", "pytest", "extensions", "--collect-only", "-q"],
        cwd=SLIDE,
        capture_output=True,
        text=True,
        env=env,
        check=False,
    )
    output = proc.stdout + proc.stderr
    assert proc.returncode == 0, output
    assert "error" not in output.lower() or "collected" in output.lower()


def test_test_sh_does_not_disable_conftest_for_packs():
    script = (SLIDE / "test.sh").read_text(encoding="utf-8")
    assert "--noconftest" not in script


def test_retired_notes_and_export_packs_are_absent():
    assert not (SLIDE / "extensions" / "notes").exists()
    assert not (SLIDE / "extensions" / "export").exists()
    notes = (SLIDE / "pages" / "notes.html").read_text(encoding="utf-8")
    export = (SLIDE / "pages" / "export.html").read_text(encoding="utf-8")
    assert "extensions/present/" in notes
    assert "extensions/build/" in export
    assert "extensions/notes/" not in notes
    assert "extensions/export/" not in export
