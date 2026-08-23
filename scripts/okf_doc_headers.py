#!/usr/bin/env python3
"""Ensure project documentation markdown files carry OKF v0.2 frontmatter."""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

try:
    import yaml
except ImportError as exc:  # pragma: no cover
    raise SystemExit("PyYAML required: pip install pyyaml") from exc

WORKSPACE = Path(__file__).resolve().parents[2]

DOC_GLOBS = [
    WORKSPACE / "webtools-ui" / "docs",
    WORKSPACE / "webtools-ui" / "tests" / "BUTTON-VISUAL-CONTRACT.md",
    WORKSPACE / "webtools-ui" / "README.md",
    WORKSPACE / "cluster-manager" / "docs",
    WORKSPACE / "cluster-manager" / "README.md",
    WORKSPACE / "dc-planner" / "docs",
    WORKSPACE / "dc-planner" / "README.md",
    WORKSPACE / "llm-benchmark" / "docs",
    WORKSPACE / "llm-benchmark" / "README.md",
    WORKSPACE / "demo-portal" / "docs",
    WORKSPACE / "demo-portal" / "README.md",
    WORKSPACE / "slide-presenter" / "docs",
    WORKSPACE / "slide-presenter" / "README.md",
    WORKSPACE / "knowledge-exchange" / "docs",
    WORKSPACE / "knowledge-exchange" / "README.md",
]

TYPE_RULES: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"templates/.+\.skeleton\.md$", re.I), "Template"),
    (re.compile(r"(TEST|TESTING|BUTTON-VISUAL|DASHBOARD_TESTS)", re.I), "Test Plan"),
    (re.compile(r"(PRD|KNOWLEDGE_CHAT|TELEMETRY_PRD|CLUSTER_MANAGER_PRD|CHAT\.md$)", re.I), "Product Requirements"),
    (re.compile(r"(IMPLEMENTATION|ROADMAP|HARMONIZATION|INTEGRATION_PLAN|PROPOSAL|WORKSTREAM)", re.I), "Implementation Plan"),
    (re.compile(r"(DESIGN|STYLE|TOKENS|CSS_HARMONIZATION|PITCH\.md$)", re.I), "Design System"),
    (re.compile(r"(USER_GUIDE|WORKFLOW|INSTALL|GUIDE|DEMO\.md$|SOP\.md$|GETTING_STARTED)", re.I), "Playbook"),
    (re.compile(r"README\.md$", re.I), "Reference"),
    (re.compile(r"(CHANGELOG|GLOSSARY|ARCHITECTURE|SDK|PLUGIN|SHELL_|PLATFORM_|CONTRIBUTIONS|SECURITY|COMPLIANCE|AUDIT|SCHEMA|API|MCP_|INDEX\.md$|DELIVERABLES|PORTAL\.md$|LLM_WIKI|TRACK_DOCS|BUILD_AND_PORTAL)", re.I), "Reference"),
    (re.compile(r"docs/meta/", re.I), "Reference"),
    (re.compile(r"docs/training-agent/", re.I), "Reference"),
    (re.compile(r"docs/design-system/", re.I), "Design System"),
]


def infer_type(path: Path) -> str:
    text = str(path).replace("\\", "/")
    for pattern, doc_type in TYPE_RULES:
        if pattern.search(text):
            return doc_type
    return "Reference"


def split_frontmatter(content: str) -> tuple[dict | None, str, str | None]:
    """Return (frontmatter dict or None, body, lint comment if immediately after FM)."""
    if not content.startswith("---"):
        return None, content, None

    end = content.find("\n---", 3)
    if end == -1:
        return None, content, None

    fm_raw = content[4:end]
    rest = content[end + 4 :]
    if rest.startswith("\r\n"):
        rest = rest[2:]
    elif rest.startswith("\n"):
        rest = rest[1:]
    else:
        return None, content, None

    try:
        parsed = yaml.safe_load(fm_raw)
    except yaml.YAMLError:
        return None, content, None
    if not isinstance(parsed, dict):
        return None, content, None

    lint = None
    lint_match = re.match(r"^(<!-- markdownlint-disable MD025 -->\n)", rest)
    if lint_match:
        lint = lint_match.group(1)
        rest = rest[len(lint) :]

    return parsed, rest, lint


HARMONIZE_NOTE_RE = re.compile(
    r"^<!--\s*harmonize:[^>]+-->\s*.*?\s*<!--\s*/harmonize:[^>]+-->\s*",
    re.S,
)


def strip_leading_directives(body: str) -> str:
    text = body.lstrip("\n")
    while True:
        new_text = HARMONIZE_NOTE_RE.sub("", text, count=1).lstrip("\n")
        if new_text != text.lstrip("\n"):
            text = new_text
            continue
        if text.startswith("<!--"):
            end = text.find("-->")
            if end == -1:
                break
            text = text[end + 3 :].lstrip("\n")
            continue
        break
    return text


def title_from_body(body: str) -> str | None:
    body = strip_leading_directives(body)
    match = re.search(r"^#\s+(.+?)\s*$", body, re.M)
    return match.group(1).strip() if match else None


def description_from_body(body: str) -> str | None:
    body = strip_leading_directives(body)
    lines: list[str] = []
    for line in body.splitlines():
        if line.startswith("#"):
            continue
        if line.strip().startswith("<!--"):
            continue
        if line.strip() == "":
            if lines:
                break
            continue
        if line.startswith(">"):
            lines.append(line.lstrip("> ").strip())
            continue
        if line.startswith("|") or line.startswith("```"):
            break
        lines.append(line.strip())
        if len(" ".join(lines)) > 240:
            break
    text = " ".join(lines).strip()
    return text or None


def reorder_frontmatter(data: dict) -> dict:
    preferred = [
        "type",
        "title",
        "description",
        "aliases",
        "domain",
        "tags",
        "summary",
        "status",
        "audience",
        "owner",
        "updated",
        "related",
        "resources",
        "applies_to",
    ]
    ordered: dict = {}
    for key in preferred:
        if key in data:
            ordered[key] = data.pop(key)
    for key in sorted(data.keys()):
        ordered[key] = data[key]
    return ordered


def dump_frontmatter(data: dict) -> str:
    text = yaml.safe_dump(
        data,
        sort_keys=False,
        allow_unicode=True,
        default_flow_style=False,
        width=1000,
    ).strip()
    return text


def collect_files() -> list[Path]:
    files: list[Path] = []
    seen: set[Path] = set()
    for target in DOC_GLOBS:
        if target.is_file() and target.suffix == ".md":
            resolved = target.resolve()
            if resolved not in seen:
                seen.add(resolved)
                files.append(resolved)
            continue
        if not target.is_dir():
            continue
        for path in sorted(target.rglob("*.md")):
            resolved = path.resolve()
            if "/shared/" in str(resolved):
                continue
            if resolved not in seen:
                seen.add(resolved)
                files.append(resolved)
    return files


def process_file(path: Path, dry_run: bool) -> tuple[bool, str]:
    original = path.read_text(encoding="utf-8")
    data, body, lint = split_frontmatter(original)
    if data is None:
        data = {}

    changed = False
    doc_type = infer_type(path)
    if not data.get("type"):
        data["type"] = doc_type
        changed = True

    body_for_meta = strip_leading_directives(body)

    if not data.get("title"):
        inferred = title_from_body(body_for_meta)
        if inferred:
            data["title"] = inferred
            changed = True

    desc = data.get("description")
    bad_desc = isinstance(desc, str) and (
        desc.strip().startswith("<!--")
        or desc.strip().startswith("#")
        or "harmonize:phase-7-note" in desc
    )
    if not desc or bad_desc:
        if data.get("summary") and not bad_desc:
            data["description"] = data["summary"]
            changed = True
        else:
            inferred = description_from_body(body_for_meta)
            if inferred and inferred != desc:
                data["description"] = inferred
                changed = True

    if not changed:
        return False, "ok"

    data = reorder_frontmatter(data)
    rebuilt = "---\n" + dump_frontmatter(data) + "\n---\n"
    if lint:
        rebuilt += lint
    rebuilt += body.lstrip("\n")
    if not body.endswith("\n"):
        rebuilt += "\n"

    if dry_run:
        return True, f"would set type={data['type']!r}"

    path.write_text(rebuilt, encoding="utf-8")
    return True, f"set type={data['type']!r}"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    updated = 0
    for path in collect_files():
        changed, detail = process_file(path, args.dry_run)
        if changed:
            updated += 1
            rel = path.relative_to(WORKSPACE)
            print(f"{'DRY' if args.dry_run else 'OK'}  {rel}  ({detail})")

    print(f"\n{'Would update' if args.dry_run else 'Updated'} {updated} files.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
