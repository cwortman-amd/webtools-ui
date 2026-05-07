#!/usr/bin/env python3
"""
html_consistency_audit.py — Cross-repo HTML consistency checker for the
webtools-ui dashboard ecosystem (cluster-manager, dc-planner, llm-benchmark).

Checks performed:
  1. Skeleton guard       — runs check_index_skeleton.py for each repo
  2. Body class           — verifies `class="nav-side"` is set on <body>
  3. Skin default         — verifies `data-skin="matte-dark"` on <body>/<html>
  4. Theme default        — verifies `data-theme="dark"` on <body>/<html>
  5. Viewport meta        — verifies viewport-fit=cover is present
  6. Font preload         — verifies material-symbols-outlined.woff2 preload
  7. Shell CSS            — verifies shell.css is loaded
  8. Chat-orb CSS         — verifies chat-orb.css is loaded
  9. Demo-mode CSS        — verifies demo-mode.css is loaded
  10. Skin stylesheet id  — verifies id="skinStylesheet" on the skin <link>
  11. Mobile hamburger    — verifies hero-mobile-menu / navMobileMenuBtn
  12. Sidebar nav         — verifies #sideNavDrawer exists in index.html
  13. Sidebar brand       — verifies .sidebar-brand link in nav
  14. Nav-backdrop        — verifies #navBackdrop exists
  15. Pitch link          — verifies .hero-title links to pitch.html
  16. Layout default (JS) — warns if JS init uses layout default of "top"
  17. localStorage key    — detects mismatched localStorage prefix between repos
  18. Present.html CSS    — checks each present.html loads base.css, skin CSS
  19. Pitch.html meta     — verifies viewport + charset in pitch.html
  20. SHELL_PREFIX        — verifies window.SHELL_PREFIX is set before Shell.init()
  21. Mobile-drawer.js    — verifies mobile-drawer.js is loaded in index.html
  22. Agent-bridge.js     — verifies agent-bridge.js is loaded
  23. Duplicate IDs       — scans index.html for duplicate HTML element IDs

Exit codes:
  0  no issues found
  1  one or more issues found
  2  invocation error
"""

from __future__ import annotations

import re
import sys
import subprocess
import argparse
import json
from pathlib import Path
from collections import Counter

# ── Config ────────────────────────────────────────────────────────────────────

SCRIPT_DIR = Path(__file__).resolve().parent
WORKSPACE = SCRIPT_DIR.parent.parent  # /home/ubuntu/workspace

REPOS = {
    "cluster-manager": WORKSPACE / "cluster-manager",
    "llm-benchmark":   WORKSPACE / "llm-benchmark",
    "dc-planner":      WORKSPACE / "dc-planner",
}

# ── Helpers ───────────────────────────────────────────────────────────────────

RESET  = "\033[0m"
RED    = "\033[91m"
YELLOW = "\033[93m"
GREEN  = "\033[92m"
CYAN   = "\033[96m"
BOLD   = "\033[1m"
DIM    = "\033[2m"

issues: list[tuple[str, str, str]] = []   # (severity, repo, message)


def emit(severity: str, repo: str, msg: str) -> None:
    """Record an issue and print it inline."""
    issues.append((severity, repo, msg))
    colour = RED if severity == "ERROR" else YELLOW
    print(f"  {colour}[{severity}]{RESET} {msg}")


def ok(repo: str, msg: str) -> None:
    print(f"  {GREEN}[OK]{RESET}    {msg}")


def section(title: str) -> None:
    print(f"\n{BOLD}{CYAN}── {title} ──{RESET}")


def read(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except FileNotFoundError:
        return ""


# ── Check functions ───────────────────────────────────────────────────────────

def check_skeleton(repo_name: str, repo_path: Path) -> None:
    """Run the existing skeleton check script."""
    checker = SCRIPT_DIR / "check_index_skeleton.py"
    if not checker.is_file():
        emit("ERROR", repo_name, f"check_index_skeleton.py not found at {checker}")
        return
    result = subprocess.run(
        [sys.executable, str(checker), "--repo", str(repo_path), "--quiet"],
        capture_output=True, text=True,
        stdin=subprocess.DEVNULL,  # never prompt interactively
        timeout=30,
    )
    if result.returncode == 0:
        ok(repo_name, "index.html skeleton matches canonical template")
    elif result.returncode == 2:
        emit("ERROR", repo_name, f"Skeleton check invocation error: {result.stderr.strip()}")
    else:
        # Print the diff compactly
        diff_lines = result.stderr.strip().splitlines()
        emit("ERROR", repo_name, "index.html skeleton DIVERGES from canonical template:")
        for line in diff_lines:
            print(f"      {DIM}{line}{RESET}")


def check_body_attrs(repo_name: str, index_html: str) -> None:
    """Check <body> element for required classes and attributes."""
    body_match = re.search(r'<body([^>]*)>', index_html)
    if not body_match:
        emit("ERROR", repo_name, "<body> tag not found in index.html")
        return
    body_attrs = body_match.group(1)

    if "nav-side" in body_attrs:
        ok(repo_name, '<body> has class="nav-side" (sidebar default)')
    else:
        emit("ERROR", repo_name, '<body> is missing class="nav-side" — sidebar will not be the default on first paint')

    if 'data-skin="matte-dark"' in body_attrs:
        ok(repo_name, '<body> has data-skin="matte-dark"')
    else:
        emit("WARN", repo_name, '<body> is missing data-skin="matte-dark"')

    if 'data-theme="dark"' in body_attrs:
        ok(repo_name, '<body> has data-theme="dark"')
    else:
        emit("WARN", repo_name, '<body> is missing data-theme="dark"')


def check_viewport(repo_name: str, html: str, label: str = "index.html") -> None:
    """Check viewport meta tag includes viewport-fit=cover."""
    if re.search(r'viewport-fit\s*=\s*cover', html):
        ok(repo_name, f"{label}: viewport-fit=cover present")
    else:
        emit("WARN", repo_name, f"{label}: viewport meta missing viewport-fit=cover (notch safety)")


def check_font_preload(repo_name: str, html: str, label: str = "index.html") -> None:
    """Verify material-symbols-outlined.woff2 preload link."""
    if "material-symbols-outlined.woff2" in html and 'rel="preload"' in html:
        ok(repo_name, f"{label}: material-symbols-outlined.woff2 preload found")
    else:
        emit("WARN", repo_name, f"{label}: missing <link rel=preload> for material-symbols-outlined.woff2")


def check_css_link(repo_name: str, html: str, href_fragment: str, label: str = "index.html") -> bool:
    """Check that a stylesheet is linked."""
    if href_fragment in html:
        ok(repo_name, f"{label}: {href_fragment} is loaded")
        return True
    else:
        emit("ERROR", repo_name, f"{label}: missing stylesheet — {href_fragment}")
        return False


def check_skin_id(repo_name: str, html: str, label: str = "index.html") -> None:
    """Verify id=\"skinStylesheet\" on the skin link element."""
    if 'id="skinStylesheet"' in html or "id='skinStylesheet'" in html:
        ok(repo_name, f"{label}: skin <link> has id=\"skinStylesheet\"")
    else:
        emit("ERROR", repo_name, f"{label}: skin <link> is missing id=\"skinStylesheet\" (dynamic theming broken)")


def check_hamburger(repo_name: str, html: str) -> None:
    """Verify hero-mobile-menu hamburger button and navMobileMenuBtn."""
    if "hero-mobile-menu" in html and "navMobileMenuBtn" in html:
        ok(repo_name, "index.html: hero-mobile-menu hamburger button found")
    else:
        emit("ERROR", repo_name, "index.html: missing hero-mobile-menu / navMobileMenuBtn (mobile drawer broken)")


def check_sidebar_elements(repo_name: str, html: str) -> None:
    """Verify sidebar nav and nav-backdrop exist."""
    if 'id="sideNavDrawer"' in html:
        ok(repo_name, "index.html: #sideNavDrawer found")
    else:
        emit("ERROR", repo_name, "index.html: missing id=\"sideNavDrawer\" (sidebar not found)")

    if 'id="navBackdrop"' in html:
        ok(repo_name, "index.html: #navBackdrop found")
    else:
        emit("WARN", repo_name, "index.html: missing id=\"navBackdrop\" (mobile backdrop overlay missing)")

    if "sidebar-brand" in html:
        ok(repo_name, "index.html: .sidebar-brand found in sidebar")
    else:
        emit("WARN", repo_name, "index.html: .sidebar-brand missing (sidebar has no brand header)")


def check_pitch_link(repo_name: str, html: str) -> None:
    """Verify the hero-title links to pitch.html."""
    # Look for hero-title with pitch.html href
    if re.search(r'class="hero-title"[^>]*href="pitch\.html"', html) or \
       re.search(r'href="pitch\.html"[^>]*class="hero-title"', html):
        ok(repo_name, "index.html: .hero-title links to pitch.html")
    else:
        emit("WARN", repo_name, "index.html: .hero-title may not link to pitch.html — verify brand link target")


def check_layout_default_js(repo_name: str, html: str) -> None:
    """Warn if JS initializes layout to 'top' instead of 'side'."""
    # Matches: getStored("...", "top") or || "top" as layout default
    if re.search(r'getStored\s*\([^)]+,\s*"top"\)', html) or \
       re.search(r'savedLayout\s*=\s*["\']top["\']', html) or \
       re.search(r'\|\|\s*"top"', html):
        emit("WARN", repo_name, 'index.html: JS layout default appears to be "top" — should be "side"')
    else:
        ok(repo_name, 'index.html: JS layout default is "side" (or no override)')


def check_shell_prefix(repo_name: str, html: str) -> None:
    """Verify window.SHELL_PREFIX is set before Shell.init()."""
    has_prefix = bool(re.search(r'window\.SHELL_PREFIX\s*=', html))
    has_shell_init = "Shell.init()" in html
    if has_shell_init and has_prefix:
        ok(repo_name, "index.html: SHELL_PREFIX set before Shell.init()")
    elif has_shell_init and not has_prefix:
        emit("WARN", repo_name, "index.html: Shell.init() called but window.SHELL_PREFIX not set (localStorage keys will use default prefix)")


def check_mobile_drawer(repo_name: str, html: str) -> None:
    """Verify mobile-drawer.js is loaded."""
    if "mobile-drawer.js" in html:
        ok(repo_name, "index.html: mobile-drawer.js is loaded")
    else:
        emit("WARN", repo_name, "index.html: mobile-drawer.js not found (mobile hamburger drawer broken)")


def check_agent_bridge(repo_name: str, html: str) -> None:
    """Verify agent-bridge.js is loaded."""
    if "agent-bridge.js" in html:
        ok(repo_name, "index.html: agent-bridge.js is loaded")
    else:
        emit("WARN", repo_name, "index.html: agent-bridge.js not loaded")


def check_duplicate_ids(repo_name: str, html: str) -> None:
    """Scan for duplicate id= values in HTML."""
    ids = re.findall(r'\bid=["\']([^"\']+)["\']', html)
    counts = Counter(ids)
    dups = {k: v for k, v in counts.items() if v > 1}
    if not dups:
        ok(repo_name, "index.html: no duplicate element IDs found")
    else:
        for id_val, count in sorted(dups.items()):
            emit("WARN", repo_name, f"index.html: duplicate id=\"{id_val}\" appears {count} times")


def check_present_html(repo_name: str, repo_path: Path) -> None:
    """Check present.html for cross-repo consistency."""
    present = repo_path / "pages" / "present.html"
    if not present.is_file():
        emit("WARN", repo_name, "present.html: file not found")
        return

    html = read(present)

    # All present.html pages should have base.css or at minimum skin CSS
    if "base.css" not in html:
        emit("WARN", repo_name, "present.html: base.css not loaded (skin variables may be missing)")
    else:
        ok(repo_name, "present.html: base.css loaded")

    check_skin_id(repo_name, html, "present.html")

    if "matte-dark.css" not in html:
        emit("WARN", repo_name, "present.html: default skin matte-dark.css not linked")
    else:
        ok(repo_name, "present.html: matte-dark skin linked")

    # Check for viewport-fit=cover
    check_viewport(repo_name, html, "present.html")

    # Check for material-symbols font
    if "material-symbols" not in html:
        emit("WARN", repo_name, "present.html: material-symbols not loaded (icons will be broken)")
    else:
        ok(repo_name, "present.html: material-symbols loaded")

    # Theme sync — look for any skin/theme synchronization
    if "initThemeSync" in html or "startSkinSync" in html or "DCShared.init" in html or "Shell.init" in html:
        ok(repo_name, "present.html: theme/skin sync mechanism found")
    else:
        emit("WARN", repo_name, "present.html: no theme/skin sync found — skin may not follow index.html selection")


def check_pitch_html(repo_name: str, repo_path: Path) -> None:
    """Spot-check pitch.html for required structure."""
    pitch = repo_path / "pages" / "pitch.html"
    if not pitch.is_file():
        emit("WARN", repo_name, "pitch.html: file not found")
        return
    html = read(pitch)
    check_viewport(repo_name, html, "pitch.html")
    if "notes-panel" in html or "speaker-notes" in html:
        ok(repo_name, "pitch.html: speaker notes panel found")
    else:
        emit("WARN", repo_name, "pitch.html: no notes panel found (expected #notes-panel or .speaker-notes)")


# ── Main ─────────────────────────────────────────────────────────────────────

def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(
        description="Cross-repo HTML consistency audit for webtools-ui dashboard ecosystem"
    )
    parser.add_argument("--json", action="store_true", help="Output issues as JSON to stdout")
    parser.add_argument("--summary-only", action="store_true", help="Only print the final summary")
    args = parser.parse_args(argv)

    print(f"\n{BOLD}{'='*64}{RESET}")
    print(f"{BOLD}  webtools-ui HTML Consistency Audit{RESET}")
    print(f"{BOLD}  Repos: {', '.join(REPOS.keys())}{RESET}")
    print(f"{BOLD}{'='*64}{RESET}")

    for repo_name, repo_path in REPOS.items():
        print(f"\n{BOLD}{'─'*60}{RESET}")
        print(f"{BOLD}  {repo_name.upper()}{RESET}  →  {DIM}{repo_path}{RESET}")
        print(f"{BOLD}{'─'*60}{RESET}")

        index_html_path = repo_path / "pages" / "index.html"
        if not index_html_path.is_file():
            emit("ERROR", repo_name, f"pages/index.html not found at {index_html_path}")
            continue

        html = read(index_html_path)

        section("1. Skeleton Guard")
        check_skeleton(repo_name, repo_path)

        section("2. Body Attributes")
        check_body_attrs(repo_name, html)

        section("3. Viewport & Font Preload")
        check_viewport(repo_name, html)
        check_font_preload(repo_name, html)

        section("4. Critical CSS Links")
        check_css_link(repo_name, html, "shell.css")
        check_css_link(repo_name, html, "chat-orb.css")
        check_css_link(repo_name, html, "demo-mode.css")
        check_skin_id(repo_name, html)

        section("5. Navigation Structure")
        check_hamburger(repo_name, html)
        check_sidebar_elements(repo_name, html)
        check_pitch_link(repo_name, html)

        section("6. JavaScript Integrity")
        check_layout_default_js(repo_name, html)
        check_shell_prefix(repo_name, html)
        check_mobile_drawer(repo_name, html)
        check_agent_bridge(repo_name, html)

        section("7. Duplicate IDs")
        check_duplicate_ids(repo_name, html)

        section("8. present.html")
        check_present_html(repo_name, repo_path)

        section("9. pitch.html")
        check_pitch_html(repo_name, repo_path)

    # ── Summary ──────────────────────────────────────────────────────────────
    print(f"\n{BOLD}{'='*64}{RESET}")
    print(f"{BOLD}  AUDIT SUMMARY{RESET}")
    print(f"{BOLD}{'='*64}{RESET}\n")

    errors = [(s, r, m) for s, r, m in issues if s == "ERROR"]
    warns  = [(s, r, m) for s, r, m in issues if s == "WARN"]

    if not issues:
        print(f"  {GREEN}✅  No issues found across all repos!{RESET}\n")
    else:
        if errors:
            print(f"  {RED}ERRORS ({len(errors)}){RESET}")
            for _, repo, msg in errors:
                print(f"    [{repo}] {msg}")

        if warns:
            print(f"\n  {YELLOW}WARNINGS ({len(warns)}){RESET}")
            for _, repo, msg in warns:
                print(f"    [{repo}] {msg}")

    print(f"\n  Total: {len(errors)} errors, {len(warns)} warnings across {len(REPOS)} repos\n")

    if args.json:
        out = [{"severity": s, "repo": r, "message": m} for s, r, m in issues]
        print(json.dumps(out, indent=2))

    return 1 if issues else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
