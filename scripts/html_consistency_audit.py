#!/usr/bin/env python3
"""
html_consistency_audit.py — Cross-repo HTML consistency checker for the
webtools-ui dashboard ecosystem (cluster-manager, dc-planner, llm-benchmark,
knowledge-exchange).

Checks performed:
  1. Skeleton guard       — runs check_index_skeleton.py for each repo
  2. Body class           — verifies `class="nav-side"` is set on <body>
  3. Skin default         — verifies `data-skin="amd-gold"` on <body>/<html>
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
  18. Present.html CSS    — checks base.css + skin CSS where present.html exists
                            (optional page; skipped in repos without one)
  19. Pitch.html meta     — verifies viewport + charset in pitch.html
  20. SHELL_PREFIX        — verifies window.SHELL_PREFIX is set before Shell.init()
  21. Mobile-drawer.js    — verifies mobile-drawer.js is loaded in index.html
  22. Agent-bridge.js     — verifies agent-bridge.js is loaded
  23. Duplicate IDs       — scans index.html markup for duplicate element IDs
                            (comments and script/style bodies are excluded)
  24. Safe-area insets    — edge-pinned fixed overlays that never receive an
                            env(safe-area-inset-*), counting handling supplied
                            by any sheet the page loads
  25. Viewport units      — dvh lengths with no vh fallback declared above them

Checks 24 and 25 are the static half of the iPhone validation. The live half
is tests/iphone-ui.mjs, which drives real iPhone device profiles; the two do
not overlap, because headless Chromium resolves every safe-area inset to 0
and so cannot see the notch at all.

Exit codes:
  0  no ERRORs found (WARNs may still be present)
  1  one or more ERRORs found, or any issue at all under --strict
  2  invocation error

WARNs are advisory — several checks are heuristics that flag "verify this"
rather than proven breakage. They do not fail the build unless --strict is
passed, so this can be wired into CI without pinning it to the current
warning count.
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
# Consumers are checked out as siblings of webtools-ui; override with
# --workspace when they live elsewhere.
DEFAULT_WORKSPACE = SCRIPT_DIR.parent.parent

CONSUMER_REPOS = ("cluster-manager", "llm-benchmark", "dc-planner", "knowledge-exchange")

# Skeleton / HTML profile per consumer. Catalog repos (knowledge-exchange) use
# chrome.css + matte-dark defaults instead of the dashboard shell bundle.
CONSUMER_PROFILES: dict[str, str] = {
    "cluster-manager": "dashboard",
    "llm-benchmark": "dashboard",
    "dc-planner": "dashboard",
    "knowledge-exchange": "catalog",
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

# Set by main(). Suppresses the per-check running commentary so that
# --summary-only and --json produce clean output.
QUIET = False


def emit(severity: str, repo: str, msg: str) -> None:
    """Record an issue and print it inline."""
    issues.append((severity, repo, msg))
    if QUIET:
        return
    colour = RED if severity == "ERROR" else YELLOW
    print(f"  {colour}[{severity}]{RESET} {msg}")


def ok(repo: str, msg: str) -> None:
    if QUIET:
        return
    print(f"  {GREEN}[OK]{RESET}    {msg}")


def skip(repo: str, msg: str) -> None:
    """Note a check that does not apply here. Not recorded as an issue."""
    if QUIET:
        return
    print(f"  {DIM}[SKIP]  {msg}{RESET}")


def section(title: str) -> None:
    if QUIET:
        return
    print(f"\n{BOLD}{CYAN}── {title} ──{RESET}")


def read(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except FileNotFoundError:
        return ""


# ── Check functions ───────────────────────────────────────────────────────────

def check_skeleton(repo_name: str, repo_path: Path, profile: str = "dashboard") -> None:
    """Run the existing skeleton check script."""
    checker = SCRIPT_DIR / "check_index_skeleton.py"
    if not checker.is_file():
        emit("ERROR", repo_name, f"check_index_skeleton.py not found at {checker}")
        return
    try:
        result = subprocess.run(
            [
                sys.executable,
                str(checker),
                "--repo",
                str(repo_path),
                "--profile",
                profile,
                "--quiet",
            ],
            capture_output=True, text=True,
            stdin=subprocess.DEVNULL,  # never prompt interactively
            timeout=30,
        )
    except subprocess.TimeoutExpired:
        emit("ERROR", repo_name, "Skeleton check timed out after 30s")
        return
    except OSError as e:
        emit("ERROR", repo_name, f"Could not run check_index_skeleton.py: {e}")
        return

    if result.returncode == 0:
        ok(repo_name, "index.html skeleton matches canonical template")
    elif result.returncode == 2:
        emit("ERROR", repo_name, f"Skeleton check invocation error: {result.stderr.strip()}")
    else:
        # Print the diff compactly
        emit("ERROR", repo_name, "index.html skeleton DIVERGES from canonical template:")
        if not QUIET:
            for line in result.stderr.strip().splitlines():
                print(f"      {DIM}{line}{RESET}")


def check_body_attrs(repo_name: str, index_html: str, profile: str = "dashboard") -> None:
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

    if profile == "catalog":
        if re.search(r'data-skin="[^"]+"', body_attrs):
            ok(repo_name, "<body> has data-skin (catalog profile)")
        else:
            emit("WARN", repo_name, "<body> is missing data-skin")
    elif 'data-skin="amd-gold"' in body_attrs:
        ok(repo_name, '<body> has data-skin="amd-gold"')
    else:
        emit("WARN", repo_name, '<body> is missing data-skin="amd-gold"')

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


def check_pitch_link(repo_name: str, html: str, profile: str = "dashboard") -> None:
    """Verify pitch.html is linked from the shell chrome."""
    if profile == "catalog":
        if re.search(r'class="sidebar-brand"[^>]*href="(?:\./)?pitch\.html"', html) or \
           re.search(r'href="(?:\./)?pitch\.html"[^>]*class="sidebar-brand"', html):
            ok(repo_name, "index.html: .sidebar-brand links to pitch.html")
        else:
            emit("WARN", repo_name, "index.html: .sidebar-brand may not link to pitch.html — verify deck link target")
        return

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


def strip_non_markup(html: str) -> str:
    """Drop comments and <script>/<style> bodies so attribute scans see only markup.

    Without this, any prose that merely *mentions* an attribute is scanned as
    if it were one. dc-planner/pages/index.html documents its tab wiring in an
    HTML comment and again in a JS comment, both spelling out the placeholder
    `id="tabXxxBtn"`, which a raw scan reported as a duplicate element ID.

    Ids assembled inside script bodies are dropped too. They were never
    reliably detectable statically (they are usually built by interpolation),
    so the trade is a check that stays silent on dynamic ids in exchange for
    one that does not cry wolf on static ones.
    """
    html = re.sub(r"<!--.*?-->", "", html, flags=re.DOTALL)
    html = re.sub(r"<script\b[^>]*>.*?</script\s*>", "", html, flags=re.DOTALL | re.IGNORECASE)
    html = re.sub(r"<style\b[^>]*>.*?</style\s*>", "", html, flags=re.DOTALL | re.IGNORECASE)
    return html


def check_duplicate_ids(repo_name: str, html: str) -> None:
    """Scan for duplicate id= values in HTML."""
    ids = re.findall(r'\bid=["\']([^"\']+)["\']', strip_non_markup(html))
    counts = Counter(ids)
    dups = {k: v for k, v in counts.items() if v > 1}
    if not dups:
        ok(repo_name, "index.html: no duplicate element IDs found")
    else:
        for id_val, count in sorted(dups.items()):
            emit("WARN", repo_name, f"index.html: duplicate id=\"{id_val}\" appears {count} times")


def check_ios_safe_area(repo_name: str, repo_path: Path) -> None:
    """Flag viewport-edge overlays in this repo's own CSS that ignore the notch.

    This is the static half of the iPhone checks. Headless Chromium resolves
    every env(safe-area-inset-*) to 0 no matter which device profile is in
    use, so tests/iphone-ui.mjs physically cannot observe whether the notch
    and home-indicator cutouts are respected. What can be observed is whether
    the rules ask for them at all, which is what this does.

    Scope is the repo's own stylesheets. The shared sheets are covered by
    their own review and are symlinked in identically everywhere, so auditing
    them once per consumer would report the same finding three times.

    An element pinned to a viewport edge is the case that matters: on a
    notched iPhone that edge is exactly where the cutout, the status bar or
    the home indicator sits, so content placed there is clipped or
    unreachable unless the inset is added back.
    """
    css_dir = repo_path / "css"
    if not css_dir.is_dir():
        skip(repo_name, "safe-area insets: no css/ directory in this repo")
        return

    def rules_in(path: Path):
        text = re.sub(r"/\*.*?\*/", "", path.read_text(encoding="utf-8", errors="replace"), flags=re.DOTALL)
        for match in re.finditer(r"([^{}]+)\{([^{}]*)\}", text):
            yield text, match

    def leaf_selectors(selector_text: str) -> set[str]:
        """The individual simple selectors a rule head targets."""
        out = set()
        for part in selector_text.split(","):
            part = " ".join(part.split())
            if part and not part.startswith("@"):
                out.add(part.split()[-1])   # the subject of the compound
        return out

    # Safe-area handling frequently lives in a different rule from the one
    # that pins the element — most often in a responsive block, and for the
    # shared components in shared/css/base.css rather than the consumer's own
    # sheet. dc-planner pins `.hero` to the top in dc-planner.css while
    # base.css supplies its notch padding, so judging a rule in isolation
    # reports a defect that is not there. Collect every selector that is
    # given inset handling anywhere the page will load, then flag only the
    # pinned selectors that appear nowhere in that set.
    covered: set[str] = set()
    search_dirs = [css_dir]
    shared_css = Path(__file__).resolve().parent.parent / "css"
    if shared_css.is_dir():
        search_dirs.append(shared_css)

    for directory in search_dirs:
        for path in sorted(directory.rglob("*.css")):
            for _text, match in rules_in(path):
                if "safe-area-inset" in match.group(2):
                    covered |= leaf_selectors(match.group(1))

    # A rule is interesting when it is fixed-position AND pinned to an edge.
    # `inset: 0` and the individual edge properties both count.
    edge = re.compile(r"(^|;|\{)\s*(top|bottom|left|right|inset)\s*:\s*0(px|%)?\s*(;|\})", re.M)
    offenders = []

    for path in sorted(css_dir.rglob("*.css")):
        for text, match in rules_in(path):
            body = match.group(2)
            if not re.search(r"position\s*:\s*fixed", body):
                continue
            if not edge.search(body):
                continue
            if "safe-area-inset" in body:
                continue
            if leaf_selectors(match.group(1)) & covered:
                continue
            selector = " ".join(match.group(1).split())[-60:]
            line = text[: match.start()].count("\n") + 1
            offenders.append(f"{path.relative_to(repo_path)}:{line} {selector}")

    if not offenders:
        pass_msg = "safe-area insets: no edge-pinned fixed overlays ignore env(safe-area-inset-*)"
        ok(repo_name, pass_msg)
        return

    for item in offenders[:6]:
        emit("WARN", repo_name, f"safe-area insets: edge-pinned fixed overlay without env(safe-area-inset-*) — {item}")
    if len(offenders) > 6:
        emit("WARN", repo_name, f"safe-area insets: {len(offenders) - 6} further overlay(s) not listed")


def check_ios_viewport_units(repo_name: str, repo_path: Path) -> None:
    """Flag dvh lengths with no vh fallback in this repo's own CSS.

    base.css states the convention directly — "100vh is kept as the fallback
    for browsers without dvh support" — and pairs each dvh length with a vh
    declaration immediately above it. A bare dvh leaves anything without dvh
    support with no value for that property at all, which for a max-height on
    a fixed overlay means no height constraint rather than a slightly wrong
    one.
    """
    css_dir = repo_path / "css"
    if not css_dir.is_dir():
        skip(repo_name, "viewport units: no css/ directory in this repo")
        return

    unpaired = []
    for path in sorted(css_dir.rglob("*.css")):
        lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
        for i, line in enumerate(lines):
            if "dvh" not in line or line.lstrip().startswith(("*", "/*", "//")):
                continue
            prop = re.match(r"\s*([a-z-]+)\s*:", line)
            if not prop:
                continue
            # The fallback convention is the same property declared with vh
            # on one of the preceding lines of the same rule.
            window = "\n".join(lines[max(0, i - 3):i])
            if re.search(rf"{re.escape(prop.group(1))}\s*:[^;]*\bvh\b", window):
                continue
            unpaired.append(f"{path.relative_to(repo_path)}:{i + 1} {line.strip()[:56]}")

    if not unpaired:
        ok(repo_name, "viewport units: every dvh length has a vh fallback")
        return
    for item in unpaired[:6]:
        emit("WARN", repo_name, f"viewport units: dvh without a vh fallback — {item}")
    if len(unpaired) > 6:
        emit("WARN", repo_name, f"viewport units: {len(unpaired) - 6} further dvh length(s) not listed")


def check_present_html(repo_name: str, repo_path: Path) -> None:
    """Check present.html for cross-repo consistency, where the page exists.

    present.html is an optional per-repo slide deck, not a canonical page:
    nothing in the index skeleton, the slash catalog or the harmonization plan
    requires one. cluster-manager deliberately has none, covering the same
    ground with pitch.html, so its absence is not an inconsistency to report.
    """
    present = repo_path / "pages" / "present.html"
    if not present.is_file():
        skip(repo_name, "present.html: not present in this repo (optional page)")
        return

    html = read(present)

    # All present.html pages should have base.css or at minimum skin CSS
    if "base.css" not in html:
        emit("WARN", repo_name, "present.html: base.css not loaded (skin variables may be missing)")
    else:
        ok(repo_name, "present.html: base.css loaded")

    check_skin_id(repo_name, html, "present.html")

    if "amd-gold.css" not in html:
        emit("WARN", repo_name, "present.html: default skin amd-gold.css not linked")
    else:
        ok(repo_name, "present.html: amd-gold skin linked")

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
    global QUIET

    parser = argparse.ArgumentParser(
        description="Cross-repo HTML consistency audit for webtools-ui dashboard ecosystem"
    )
    parser.add_argument("--json", action="store_true",
                        help="Output issues as JSON only (suppresses the human-readable report)")
    parser.add_argument("--summary-only", action="store_true",
                        help="Only print the final summary, not each individual check")
    parser.add_argument("--strict", action="store_true",
                        help="Exit non-zero on WARNs too, not just ERRORs")
    parser.add_argument("--workspace", type=Path, default=DEFAULT_WORKSPACE,
                        help=f"Directory holding the consumer repos (default: {DEFAULT_WORKSPACE})")
    parser.add_argument("--repo", action="append", metavar="NAME", choices=CONSUMER_REPOS,
                        help="Audit only this repo; repeatable (default: all four)")
    args = parser.parse_args(argv)

    QUIET = args.json or args.summary_only

    selected = args.repo or list(CONSUMER_REPOS)
    repos = {name: args.workspace.resolve() / name for name in selected}

    if not QUIET:
        print(f"\n{BOLD}{'='*64}{RESET}")
        print(f"{BOLD}  webtools-ui HTML Consistency Audit{RESET}")
        print(f"{BOLD}  Repos: {', '.join(repos.keys())}{RESET}")
        print(f"{BOLD}{'='*64}{RESET}")

    audited = 0
    skipped: list[str] = []

    for repo_name, repo_path in repos.items():
        if not QUIET:
            print(f"\n{BOLD}{'─'*60}{RESET}")
            print(f"{BOLD}  {repo_name.upper()}{RESET}  →  {DIM}{repo_path}{RESET}")
            print(f"{BOLD}{'─'*60}{RESET}")

        # A repo that simply isn't checked out here is not a consistency
        # failure — only a checked-out repo missing its index.html is.
        if not repo_path.is_dir():
            skipped.append(repo_name)
            if not QUIET:
                print(f"  {DIM}[SKIP]  not checked out at {repo_path}{RESET}")
            continue

        index_html_path = repo_path / "pages" / "index.html"
        if not index_html_path.is_file():
            emit("ERROR", repo_name, f"pages/index.html not found at {index_html_path}")
            continue

        audited += 1

        html = read(index_html_path)
        profile = CONSUMER_PROFILES.get(repo_name, "dashboard")

        section("1. Skeleton Guard")
        check_skeleton(repo_name, repo_path, profile)

        section("2. Body Attributes")
        check_body_attrs(repo_name, html, profile)

        section("3. Viewport & Font Preload")
        check_viewport(repo_name, html)
        check_font_preload(repo_name, html)

        section("4. Critical CSS Links")
        check_css_link(repo_name, html, "shell.css")
        check_css_link(repo_name, html, "chat-orb.css")
        if profile == "dashboard":
            check_css_link(repo_name, html, "demo-mode.css")
        else:
            skip(repo_name, "demo-mode.css: not required for catalog profile")
        check_skin_id(repo_name, html)

        section("5. Navigation Structure")
        check_hamburger(repo_name, html)
        check_sidebar_elements(repo_name, html)
        check_pitch_link(repo_name, html, profile)

        section("6. JavaScript Integrity")
        check_layout_default_js(repo_name, html)
        if profile == "dashboard":
            check_shell_prefix(repo_name, html)
        else:
            skip(repo_name, "SHELL_PREFIX: catalog profile uses chrome.js, not Shell.init()")
        check_mobile_drawer(repo_name, html)
        if profile == "dashboard":
            check_agent_bridge(repo_name, html)
        else:
            skip(repo_name, "agent-bridge.js: not required for catalog profile")

        section("7. Duplicate IDs")
        check_duplicate_ids(repo_name, html)

        section("7b. iPhone / iOS static checks")
        check_ios_safe_area(repo_name, repo_path)
        check_ios_viewport_units(repo_name, repo_path)

        section("8. present.html")
        check_present_html(repo_name, repo_path)

        section("9. pitch.html")
        check_pitch_html(repo_name, repo_path)

    # ── Summary ──────────────────────────────────────────────────────────────
    errors = [(s, r, m) for s, r, m in issues if s == "ERROR"]
    warns  = [(s, r, m) for s, r, m in issues if s == "WARN"]

    if args.json:
        print(json.dumps({
            "audited": audited,
            "skipped": skipped,
            "errors": len(errors),
            "warnings": len(warns),
            "issues": [{"severity": s, "repo": r, "message": m} for s, r, m in issues],
        }, indent=2))
    else:
        print(f"\n{BOLD}{'='*64}{RESET}")
        print(f"{BOLD}  AUDIT SUMMARY{RESET}")
        print(f"{BOLD}{'='*64}{RESET}\n")

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

        print(f"\n  Total: {len(errors)} errors, {len(warns)} warnings "
              f"across {audited} repo(s)")
        if skipped:
            print(f"  Skipped (not checked out): {', '.join(skipped)}")
        if warns and not args.strict:
            print(f"  {DIM}WARNs are advisory and do not fail the build; "
                  f"use --strict to gate on them.{RESET}")
        print()

    # Nothing was actually inspected, so a 0 here would be a vacuous pass.
    if audited == 0:
        sys.stderr.write("error: no consumer repos were found to audit\n")
        return 2

    if errors:
        return 1
    if warns and args.strict:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
