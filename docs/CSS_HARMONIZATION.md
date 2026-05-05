# CSS Harmonization Audit — Phase 9.8c

**Status:** Phase A + B shipped 2026-05-04. Phase C partially shipped; remaining items deferred (see _Deferred Work_ below).

This doc lives in `webtools-ui/docs/` so all three sibling consumer dashboards (`llm-benchmark`, `cluster-manager`, `dc-planner`) read the same source of truth via their `shared/` symlink.

---

## Goal

Audit and harmonize the CSS surface across the three sibling dashboards so that every page renders with a consistent baseline (typography, top bar, panels, tabs, form controls, focus rings, table chrome, …), with per-repo deltas isolated to small override stylesheets.

**Cross-repo invariants** (preserved by harmonization):

- Top-bar `.hero` is a 40px fixed header with a skin-aware backdrop.
- `.hero-icon-btn` is a 28×28 flat icon button with a Material Symbols glyph.
- All skin tokens (`--ui-*`, `--skin-*`) are sourced from `shared/css/skins/*.css`.
- Material Symbols Outlined is the only icon font; loaded via self-hosted woff2.

---

## What's done

### Phase A — Quick wins (≤30 min each, zero risk)

| ID | Repo | Change | Status |
|----|------|--------|--------|
| A.1 | dc-planner | Fix broken `<link href="../css/demo-mode.css">` (404) → `<link href="../shared/css/demo-mode.css">` | ✅ shipped |
| A.2 | dc-planner | (false positive — alleged duplicate `notes-panel.css` was a CSS doc-comment, not an active `<link>`) | N/A |
| A.3 | cluster-manager | Remove dead `<link href="../css/chat-orb.css">` from 9 pages; delete the unused 332-line local stylesheet | ✅ shipped |

### Phase B — Canonical `base.css` migration

| ID | Repo | Change | Status |
|----|------|--------|--------|
| B.1 | llm-benchmark | Re-point all 7 page `<link>`s from `../css/base.css` → `../shared/css/base.css`; delete the local copy; update contract test to verify the canonical path | ✅ shipped |
| B.2 | cluster-manager | Extract 3 functional deltas (`.hero-toolbar` borders, `.hero-icon-btn` color) to `css/cm-overrides.css`; re-point all 9 page `<link>`s; delete local base.css; update offline test | ✅ shipped |
| B.3 | dc-planner | Stack canonical `<link href="../shared/css/base.css">` BEFORE `dc-planner.css` in `pages/index.html` so the monolith continues to override via cascade order; document the deferred dedup plan in the monolith's header | ✅ shipped (529 → 531 self-check assertions passing) |

After Phase B, all three repos load the canonical baseline and any remaining differences are isolated:

- `llm-benchmark` — no local overrides, just the canonical baseline + `pages.css` page-chrome
- `cluster-manager` — canonical baseline + `cm-overrides.css` (3 rules)
- `dc-planner` — canonical baseline + 202KB monolith (overrides via cascade order)

### Phase C — Documentation alignment + tracking (this doc)

| ID | Repo | Change | Status |
|----|------|--------|--------|
| C.1 | llm-benchmark | Update `docs/DASHBOARD.md` + `docs/STYLE.md` to reference `shared/css/base.css` (no more `cp llm-benchmark/css/base.css …` snippets) | ✅ shipped |
| C.2 | cluster-manager | Update `docs/DASHBOARD.md` + `docs/STYLE.md` to reference `shared/css/base.css` + `css/cm-overrides.css` | ✅ shipped |
| C.3 | webtools-ui | This tracking doc | ✅ shipped |

---

## Phase D — Sustainable harmony (deeper polish)

### D.1 — Self-host Material Symbols woff2 in canonical `shared/css/fonts/` ✅ partial (2 of 3 repos shipped 2026-05-05)

**Decision.** Adopted the smaller, byte-identical font shared by `llm-benchmark` + `cluster-manager` (md5 `998140309962b4c631d243c5baba487b`, 3.55 MB) as canonical instead of dc-planner's newer variant. Rationale: zero glyph-parity risk for the two migrated repos, since they were already shipping this exact font.

**What landed.**

- Created `webtools-ui/css/fonts/material-symbols-outlined.woff2` (canonical font).
- Created `webtools-ui/css/material-symbols.css` (`@font-face` + `.material-symbols-outlined` defaults; promoted from `dc-planner/css/material-symbols.css` template).
- llm-benchmark — all 7 pages now load `<link rel="preload" href="../shared/css/fonts/...">` + `<link rel="stylesheet" href="../shared/css/material-symbols.css" />`. The duplicate `@font-face` was removed from `pages/index.html` inline style + `css/pages.css`. Local `css/fonts/` directory retired. `test_offline.sh` updated.
- cluster-manager — all 9 pages migrated (debug/fabric/index/install/monitor/network/present/status/test). Inline `@font-face` blocks removed (handled both multi-line and single-line shapes). `css/fonts/` retired. `tests/test_offline.py` updated to verify the canonical path.

**Test results post-migration:**

- `llm-benchmark/test_offline.sh`: 380/381 passed (the 1 failure is unrelated — pre-existing chat-orb.css vendor-manifest drift from Phase 9.7.5 polish).
- `cluster-manager/tests/test_offline.py`: 14 passed (font tests all green); 2 pre-existing skin-path failures unrelated to D.1.
- `llm-benchmark/tests/test_dashboard_webapp_contract.py::test_static_assets_are_served`: passed (canonical path served correctly).

**dc-planner deferral.** dc-planner remains on its larger newer variable variant (`css/fonts/material-symbols-outlined.woff2`, md5 `8f59b4d5e20d96ccbb7bd27af949e2f9`, 3.88 MB) until a Playwright "icon parity" test verifies the smaller canonical font has every glyph dc-planner uses. Adopting dc-planner's font as canonical (the original plan in this doc) is no longer the path forward — the smaller variant is the new canonical baseline because it shipped to two repos already and has wider real-world rendering coverage. Migrating dc-planner means swapping in a smaller font that may lack glyphs it relies on; that's the parity check the deferred work needs to do.

**Plan for the deferred dc-planner migration:**

1. Wire a Playwright test in `dc-planner/tests/e2e/` that screenshots every Material Symbol icon present in `pages/index.html` and `pages/{report,present,architecture}.html`.
2. Render once with the local `css/fonts/material-symbols-outlined.woff2` (current state). Save as the golden.
3. Render once with the canonical `shared/css/fonts/material-symbols-outlined.woff2`. Diff against the golden.
4. If the diff is clean (no missing glyphs, no significant rendering differences), migrate `pages/index.html` preload + `<link>` to canonical, retire `css/material-symbols.css` + `css/fonts/`.
5. If the diff is dirty (missing glyphs), either: (a) update the canonical font to a newer variant; or (b) keep dc-planner on its local font with a documented exception in this file.

### D.2 — Promote `pages.css` / `shared-chrome.css` commonalities to a canonical chrome stylesheet

**Why deferred.** Each repo has a "page-chrome" stylesheet on top of `base.css`:

| Repo | File | Size | Purpose |
|------|------|------|---------|
| llm-benchmark | `css/pages.css` | ~14 KB | Page-level chrome (toolbars, panels, status badges, …) |
| cluster-manager | (mostly inline `<style>` in each page) | varies | Per-page chrome |
| dc-planner | `css/shared-chrome.css` | ~10 KB | Common toolbar / icon-button / Material Symbols overrides for `report.html` / `present.html` / `architecture.html` (uses `.chrome-*` selectors and `--chrome-*` variables) |

These overlap _conceptually_ (every dashboard wants a fixed top bar with icon buttons and a skin picker) but use _different selectors_ (`.hero-*` vs `.chrome-*`) and _different CSS variable namespaces_ (`--ui-*` vs `--chrome-*`). A real promotion requires renaming selectors across HTML and CSS, which can't be done safely without browser regression coverage.

**Plan for the deferred phase:**

1. Pick one selector convention (`.hero-*` is dominant — used by `base.css` already).
2. Rewrite `dc-planner`'s `report.html` / `present.html` / `architecture.html` to use `.hero-*` markup.
3. Migrate `dc-planner/css/shared-chrome.css` rules into `webtools-ui/css/page-chrome.css` (canonical).
4. Migrate the `pages.css` rules from llm-benchmark that overlap into the same canonical file.
5. Each repo retains a small per-repo overrides stylesheet for legitimate per-repo chrome (e.g., llm-benchmark's `--pri-high/med/low` priority colors).

### D.3 — dc-planner monolith dedup

**Why deferred.** `dc-planner/css/dc-planner.css` is 202 KB / ~8800 lines and duplicates ~74 selectors that already exist in the canonical `shared/css/base.css`. After Phase B, both stylesheets are loaded and the monolith wins via cascade order — but the duplicated rules are still bytes shipped to every browser tab.

**Plan for the deferred phase:**

1. Run a structured selector-overlap audit (`shared/css/base.css` vs `css/dc-planner.css`).
2. For each duplicated selector, verify the canonical version is _strictly weaker_ than (or identical to) the dc-planner version. Anything stronger needs to stay.
3. Delete the duplicate selectors from `dc-planner.css` one block at a time, regression-testing after each block.
4. The 10 selectors in `shared/css/base.css` that DON'T yet exist in `dc-planner.css` are pre-listed in the monolith's header comment. Two of them (`button`, `button:hover`) are global element selectors that may need scoping before they're safe to inherit.

### D.4 — `dc-planner` secondary page unification

**Why deferred.** `pages/report.html`, `pages/present.html`, `pages/architecture.html` use `shared-chrome.css` (the `.chrome-*` system) instead of the `.hero-*` markup that `pages/index.html` uses. Unifying them means rewriting the chrome HTML on each page. See _D.2_ for the broader plan.

---

## How to read CSS link order in 2026-05-04+

Every page in the three repos should now load CSS in this order:

```html
<!-- 1. Material Symbols (icon font) -->
<link rel="stylesheet" href="../css/material-symbols.css" />

<!-- 2. Per-repo monolith (dc-planner only) — must come before base.css until D.3 lands -->
<!-- <link rel="stylesheet" href="../css/dc-planner.css">  -->

<!-- 3. Canonical baseline -->
<link rel="stylesheet" href="../shared/css/base.css" />

<!-- 4. Per-repo overrides (cluster-manager only) -->
<link rel="stylesheet" href="../css/cm-overrides.css" />

<!-- 5. Skin (swappable at runtime via data-skin attribute) -->
<link id="skinStylesheet" rel="stylesheet" href="../shared/css/skins/matte-dark.css" />

<!-- 6. Page-specific chrome -->
<link rel="stylesheet" href="../css/pages.css" />          <!-- llm-benchmark -->
<link rel="stylesheet" href="../shared/css/notes-panel.css" />  <!-- pitch.html -->
<!-- ... -->

<!-- 7. Page-specific demo / chat-orb / tutor / etc. -->
<link rel="stylesheet" href="../shared/css/chat-orb.css" />
<link rel="stylesheet" href="../shared/css/demo-mode.css" />
```

If you find yourself wanting to add a `<link href="../css/base.css">` to a page — that file no longer exists. Use the canonical `<link href="../shared/css/base.css">` instead.

---

## Per-repo audit reports

The detailed audit findings (file inventories, link-order checks, diff stats) live in each repo's `docs/HARMONIZATION.md`. This top-level doc tracks cross-repo status; the per-repo docs track repo-specific implementation notes.

---

## Change log

- **2026-05-04** — Initial audit + Phase A + Phase B + partial Phase C shipped (`9.8c` series).
