#!/usr/bin/env python3
"""
check_index_skeleton.py — strict-diff guard for the cross-repo index.html head.

The canonical template lives at `webtools-ui/templates/index.skeleton.html` and
encodes the agreed shape of every consumer's `pages/index.html` head, scoped
from `<!doctype html>` through a sentinel comment `<!-- end:skeleton -->`:

    <!doctype html>
    <html …>
    <head>
      <meta charset…>
      <meta viewport…>
      <title>{{TITLE}}</title>
      {{ICON_LINK}}
      {{?STRUCTURED_DATA}}
      …canonical stylesheets in canonical order…
      {{?PER_REPO_STYLESHEETS}}
      …canonical skin + chat-orb…
      {{?MANIFEST_LINK}}
      {{?THEME_COLOR_META}}
      <!-- end:skeleton -->

Anything BELOW the sentinel (per-repo inline `<style>`, scripts, etc.) is
out of scope and unchecked — the sentinel demarcates "everything above is
template-driven, everything below diverges intentionally."

Each consumer ships `pages/index.skeleton.values.json` filling the placeholders.
This script renders the template with those values, extracts lines 1 through
the `<!-- end:skeleton -->` sentinel from `pages/index.html`, and asserts
byte-for-byte equality. On mismatch it prints a unified diff and exits non-zero.

Placeholder syntax
    {{NAME}}             required, inline substitution within a line
    {{?NAME}}            optional, whole-line replacement (line omitted if value
                         is null/missing); value is a literal string (may include
                         '\n' for multi-line content) and must include any
                         desired indentation

USAGE

    python3 scripts/check_index_skeleton.py --repo /path/to/consumer
    python3 scripts/check_index_skeleton.py --repo .  # if run from consumer

EXIT CODES
    0  head matches rendered template
    1  head diverges (diff printed to stderr)
    2  invocation / IO error
"""

from __future__ import annotations

import argparse
import difflib
import json
import os
import re
import sys
from pathlib import Path

# Resolve template path relative to this script so the check works regardless
# of how it's invoked (consumer's CI, webtools-ui CI, manual run).
SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_TEMPLATE = SCRIPT_DIR.parent / "templates" / "index.skeleton.html"

LINE_PLACEHOLDER = re.compile(r"^(\s*)\{\{(\??)([A-Z_]+)\}\}\s*$")
INLINE_PLACEHOLDER = re.compile(r"\{\{([A-Z_]+)\}\}")


def render_template(template_text: str, values: dict) -> str:
    """Render template with placeholder substitutions.

    Lines that are entirely a placeholder (e.g. `{{ICON_LINK}}` or
    `  {{?STRUCTURED_DATA}}`) are treated as line-blocks. Optional blocks
    (`{{?NAME}}`) whose value is None/missing are dropped from the output;
    required blocks (`{{NAME}}`) raise on missing values. The substituted
    value is inserted as-is (multi-line allowed, value provides its own
    indentation). Inline placeholders within a line are substituted by
    string replacement.
    """
    out = []
    for line in template_text.split("\n"):
        m = LINE_PLACEHOLDER.match(line)
        if m:
            _indent, optional, name = m.groups()
            value = values.get(name)
            if value is None:
                if optional:
                    continue  # drop the line entirely
                raise KeyError(
                    f"Required placeholder {{{{{name}}}}} has no value in "
                    f"index.skeleton.values.json"
                )
            out.append(value)
            continue

        def _sub(match: re.Match) -> str:
            name = match.group(1)
            if name in values and values[name] is not None:
                return str(values[name])
            raise KeyError(
                f"Required placeholder {{{{{name}}}}} has no value in "
                f"index.skeleton.values.json (line: {line!r})"
            )

        out.append(INLINE_PLACEHOLDER.sub(_sub, line))

    return "\n".join(out)


SKELETON_END_SENTINEL = "<!-- end:skeleton -->"


def extract_skeleton(index_html_path: Path) -> str:
    """Return lines 1 through the `<!-- end:skeleton -->` sentinel (inclusive).

    The sentinel demarcates the template-driven prefix from per-repo head
    content (inline `<style>`, page-specific scripts) that diverges
    intentionally below it.
    """
    text = index_html_path.read_text(encoding="utf-8")
    lines = text.split("\n")
    end_idx = None
    for i, line in enumerate(lines):
        if line.strip() == SKELETON_END_SENTINEL:
            end_idx = i
            break
    if end_idx is None:
        raise ValueError(
            f"{index_html_path}: could not find the `{SKELETON_END_SENTINEL}` "
            f"sentinel. Add it on its own line below your last canonical "
            f"resource (e.g. after the chat-orb.css link or theme-color meta) "
            f"to mark where the template-driven prefix ends and per-repo head "
            f"content begins."
        )
    return "\n".join(lines[: end_idx + 1])


def unified_diff(expected: str, actual: str, expected_label: str, actual_label: str) -> str:
    diff_lines = difflib.unified_diff(
        expected.splitlines(keepends=False),
        actual.splitlines(keepends=False),
        fromfile=expected_label,
        tofile=actual_label,
        lineterm="",
    )
    return "\n".join(diff_lines)


def parse_args(argv: list[str]) -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Diff a consumer's pages/index.html head against the "
        "canonical webtools-ui/templates/index.skeleton.html template."
    )
    p.add_argument(
        "--repo",
        type=Path,
        default=Path("."),
        help="Path to the consumer repo root (default: current directory). "
        "Must contain pages/index.html and pages/index.skeleton.values.json.",
    )
    p.add_argument(
        "--template",
        type=Path,
        default=DEFAULT_TEMPLATE,
        help=f"Path to the skeleton template (default: {DEFAULT_TEMPLATE}).",
    )
    p.add_argument(
        "--quiet",
        action="store_true",
        help="On match, print nothing. On mismatch, still print the diff.",
    )
    return p.parse_args(argv)


def main(argv: list[str]) -> int:
    args = parse_args(argv)

    repo = args.repo.resolve()
    index_html = repo / "pages" / "index.html"
    values_path = repo / "pages" / "index.skeleton.values.json"
    template_path = args.template.resolve()

    for path, label in [
        (index_html, "pages/index.html"),
        (values_path, "pages/index.skeleton.values.json"),
        (template_path, "skeleton template"),
    ]:
        if not path.is_file():
            sys.stderr.write(f"error: {label} not found at {path}\n")
            return 2

    try:
        values = json.loads(values_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        sys.stderr.write(f"error: {values_path} is not valid JSON: {e}\n")
        return 2

    template_text = template_path.read_text(encoding="utf-8")
    # The template itself ends with a newline after `</head>`; drop the trailing
    # empty string from split() so we compare just through `</head>`.
    template_text = template_text.rstrip("\n")

    try:
        rendered = render_template(template_text, values)
    except KeyError as e:
        sys.stderr.write(f"error: {e}\n")
        return 2

    try:
        actual = extract_skeleton(index_html)
    except ValueError as e:
        sys.stderr.write(f"error: {e}\n")
        return 2

    if rendered == actual:
        if not args.quiet:
            sys.stdout.write(
                f"OK  {os.path.relpath(index_html, repo)} skeleton matches "
                f"canonical template.\n"
            )
        return 0

    sys.stderr.write(
        f"FAIL  {os.path.relpath(index_html, repo)} skeleton diverges from "
        f"canonical template:\n\n"
    )
    diff = unified_diff(
        rendered, actual,
        expected_label=f"rendered({template_path.name} + index.skeleton.values.json)",
        actual_label=os.path.relpath(index_html, repo),
    )
    sys.stderr.write(diff + "\n")
    sys.stderr.write(
        "\nTo align: either update pages/index.html to match the rendered "
        "template, or (if the divergence is intentional) update "
        "pages/index.skeleton.values.json. The template itself lives at "
        f"{template_path} — change it only with all 3 consumers in mind.\n"
    )
    return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
