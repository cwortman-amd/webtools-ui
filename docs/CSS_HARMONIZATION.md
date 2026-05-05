# CSS Harmonization Audit — Phases 9.8c (2026-05-04) + 9.8d (2026-05-05)

**Status:** Phase A + B + partial C shipped 2026-05-04. Phase D.1 (Material Symbols self-host) + D.3 (dc-planner monolith dedup, partial) shipped 2026-05-05. D.2 + D.4 + remaining D.1/D.3 work tracked below.

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
| llm-benchmark | `css/pages.css` | ~14 KB / ~600 lines | Page-level chrome (toolbars, panels, status badges, page-color aliases) shared across `deploy.html` / `plan.html` / `present.html` / `profile.html` / `report.html` / `view.html` (6 pages) |
| cluster-manager | (mostly inline `<style>` in each page) | varies | Per-page chrome — no shared file. Each page redefines `.hero-toolbar` / `.hero-icon-btn` etc. inline. |
| dc-planner | `css/shared-chrome.css` | ~10 KB | Common toolbar / icon-button / Material Symbols overrides for `report.html` / `present.html` / `architecture.html` (uses `.chrome-*` selectors and `--chrome-*` variables) |

These overlap _conceptually_ (every dashboard wants a fixed top bar with icon buttons and a skin picker) but use _different selectors_ (`.hero-*` vs `.chrome-*`) and _different CSS variable namespaces_ (`--ui-*` vs `--chrome-*`). A real promotion requires renaming selectors across HTML and CSS, which can't be done safely without browser regression coverage.

**Concrete overlap candidates** (selectors present in ≥2 repos with similar bodies, surveyed during D.3 audit):

| Selector | llm-benchmark `pages.css` | dc-planner `shared-chrome.css` (under `.chrome-*` prefix) | cluster-manager (inline) |
|----------|---------------------------|----------------------------------------------------------|--------------------------|
| `.hero-toolbar` | yes — flex layout, gap, padding | as `.chrome-toolbar` — same flex layout | yes — same flex layout (with cm-overrides border on top) |
| `.hero-icon-btn` | yes — 28×28 flat button | as `.chrome-icon-btn` — same dimensions | yes — same dimensions |
| `.hero-icon-btn:hover` | yes — backdrop tint | as `.chrome-icon-btn:hover` — same tint | yes — same tint |
| `.hero-skin-wrap` | not present | as `.chrome-skin-wrap` | yes |
| `.hero-skin-menu` | not present | as `.chrome-skin-menu` | yes |
| `.hero-skin-option` | not present | as `.chrome-skin-option` | yes |
| `.hero` (top-bar height + bg) | yes — 40 px | as `.chrome` — 40 px | yes |
| `.hero-tabs` | yes — horizontal scroll | as `.chrome-tabs` | not used (no tabs in cluster-manager pages) |
| `.tab-btn` family | yes | as `.chrome-tab-btn` | not used |

These ~9 selector families are the realistic D.2 promotion target. Of these, `.hero-*` (already in canonical `base.css`) is the dominant convention and should be the canonical name. dc-planner's `.chrome-*` is the outlier.

**Plan for the deferred phase:**

1. Pick one selector convention. **Recommended: `.hero-*`** — already in canonical `base.css`, used by `pages/index.html` in all 3 repos, and Phase D.3 already harmonized 19 `.hero-skin-*` and `body[data-theme="light"] .hero-icon-btn` selectors via the canonical baseline.
2. Create `webtools-ui/css/page-chrome.css` with the 9 overlapping selector families above. Source content from canonical `base.css` (already present) plus the additive declarations from `pages.css` that aren't in canonical.
3. Update consumer pages:
   - **llm-benchmark**: `pages/{deploy,plan,present,profile,report,view}.html` — add `<link rel="stylesheet" href="../shared/css/page-chrome.css" />` before `<link rel="stylesheet" href="../css/pages.css" />`. Trim `pages.css` to only the truly per-repo deltas (page-color aliases, priority colors, status badges).
   - **cluster-manager**: `pages/{debug,fabric,index,install,monitor,network,present,status,test}.html` — add `<link rel="stylesheet" href="../shared/css/page-chrome.css" />`. Delete the inline `<style>` chrome blocks (toolbar, icon-btn, skin picker). Keep only the per-repo deltas in `cm-overrides.css`.
   - **dc-planner**: handled by D.4 (HTML rewrite from `.chrome-*` to `.hero-*` first, then drop `shared-chrome.css`).
4. Each repo retains a small per-repo overrides stylesheet for legitimate per-repo chrome (e.g., llm-benchmark's `--pri-high/med/low` priority colors, cluster-manager's `.hero-toolbar` border).
5. Canonical chrome stays loaded BEFORE per-repo overrides in the cascade.

**Risk notes:**

- llm-benchmark `pages.css` has page-color aliases (`--pages-bg`, `--pages-card`, `--pages-text`) defined under `:root`. These are llm-benchmark-only and should stay in `pages.css`.
- llm-benchmark `pages.css` has `.material-symbols-outlined { font-size: 20px }` which overrides the canonical 24 px default. This is per-repo and should stay (or move to `cm-overrides.css`-style overrides).
- Validate cascade order: canonical `page-chrome.css` BEFORE per-repo overrides BEFORE the active skin. Skins use `--ui-*` tokens, so they need to load AFTER `page-chrome.css` to compute the right colors.

**Estimated effort:** ~1 day. Roughly 9 selector families × 3 consumer repos = 27 selector-repo migrations. Lower-risk than D.4 because no HTML rewriting (cluster-manager and llm-benchmark already use `.hero-*` markup).

### D.3 — dc-planner monolith dedup ✅ partial (Tier 1 + Tier 2 shipped 2026-05-05)

**Why partial.** `dc-planner/css/dc-planner.css` (202 KB / ~8800 lines) originally duplicated 74 selectors that already exist in the canonical `shared/css/base.css`. Phase D.3 has now removed 19 of those 74 (~26%) where the canonical body is byte-equivalent (modulo whitespace) to the monolith body, so the cascade produces identical output. The remaining 55 duplicate selectors stay in the monolith for now because their bodies differ in ways that need per-rule judgment.

**What landed (Tier 1 — byte-identical bodies, 8 selectors):**

Originally shipped under commit `82fbde7 refactor(css): remove duplicate base/chrome rules from dc-planner stylesheet`.

| Selector | Canonical (`base.css`) | Monolith (`dc-planner.css`) |
|----------|------------------------|------------------------------|
| `.actions` | identical body | removed |
| `.stats` | identical body | removed |
| `.stat` | identical body | removed |
| `.stat .value` | identical body | removed |
| `tr:hover .bom-delete-btn` | identical body | removed |
| `.tab-panel` | identical body | removed |
| `.tab-panel.hidden` | identical body | removed |
| `.material-symbols-outlined` | identical body | removed (cascade order: local `material-symbols.css` → canonical `base.css` wins; same end state) |

**What landed (Tier 2 — whitespace-only differences in `rgba(...)` values, 11 selectors):**

| Selector | Difference vs canonical |
|----------|-------------------------|
| `.hero-skin-menu` | canonical: `rgba(0,0,0,0.22)`, monolith: `rgba(0, 0, 0, 0.22)` (CSS-equivalent) |
| `.hero-skin-menu[hidden]` | identical body |
| `.hero-skin-option` | identical body (4 `!important` declarations preserved) |
| `.hero-skin-option:hover` | whitespace-only diff in `rgba(255, 255, 255, 0.06)` |
| `.hero-skin-option.active` | whitespace-only diff |
| `.hero-skin-wrap` | identical body |
| `.hero-tabs::-webkit-scrollbar` | identical body |
| `body[data-theme="light"] .hero-icon-btn` | identical body |
| `body[data-theme="light"] .hero-skin-option` | identical body |
| `body[data-theme="light"] .hero-skin-option.active` | whitespace-only diff |
| `body[data-theme="light"] .hero-skin-option:hover` | whitespace-only diff |

**Test results post-dedup:**

`dc-planner/tests/self-check.sh`: 531/0 (full E2E + Playwright, ~7 min). The self-check assertion for `body[data-theme="light"] .hero-icon-btn` was relaxed to look in either `dc-planner.css` OR `shared/css/base.css`, since the canonical baseline now provides the rule uniformly across all three sibling consumer dashboards.

**Remaining work (Tier 3 — semantically different bodies, ~55 selectors):**

These need per-selector visual inspection because deletion would change pixels. They fall into a few buckets:

1. **`var(--muted)` vs `var(--ui-muted)`** (5 selectors): `.hint`, `.warning`, `.stat .label`, `.hero-skin-menu-title`, plus a couple of others. The monolith uses `var(--muted)` which is undefined in `dc-planner.css`'s scope, so it currently resolves to inherited color (a latent bug). The canonical uses `var(--ui-muted)` which resolves correctly. Deleting from the monolith would fix the bug but ALSO change the visible color. Decide intent before deleting.
2. **Different layout values** (~10 selectors): e.g. `.row` has `gap: 14px / margin-bottom: 14px` in canonical vs `gap: 10px / margin-bottom: 10px` in monolith. Deleting from monolith → canonical layout (visible spacing change).
3. **Per-repo additions on top of canonical** (~20 selectors): e.g. `.bom-delete-btn` in canonical sets size + transition, monolith adds `padding: 0 !important; border: none !important`. Need to merge the additive declarations into a smaller delta block before deleting the full duplicate.
4. **Global element selectors** (`*`, `body`, `h1`, `td`, `th`, table chrome, form controls, focus rings — ~20 selectors). These are higher-risk because every page touches them. Need careful before/after screenshot comparison.

**Plan for the remaining Tier 3 work:**

1. Group by the buckets above and ship one bucket per commit.
2. For each bucket, capture before/after screenshots of `pages/index.html` + `pages/report.html` at all 7 active skins (matte-dark, glass-dark, soft-neutral-light, minimal-monochrome, amd, amd-gold, amd-teal).
3. Land each bucket only after self-check + screenshot diff are clean.
4. Estimated savings if all 55 remaining selectors land: ~5–7 KB more from the monolith (on top of the ~2.5 KB already saved).

**Canonical-only selectors (still pending the original audit's "may need scoping" check):** `.hero-main > div:first-child`, `.hero-tabs .tab-btn`, `.hero-tabs .tab-icon`, `.icon-bold`, `.icon-filled`, `.tab-btn`, `.tab-btn.active`, `.tab-btn:hover:not(.active)`, `button`, `button:hover`. The `button` / `button:hover` global element selectors are the highest-risk inheritance because every unstyled `<button>` in `dc-planner` would suddenly pick up the canonical blue-gradient look. Audit which dc-planner buttons are scoped to a class first.

### D.4 — `dc-planner` secondary page unification

**Why deferred.** `pages/report.html`, `pages/present.html`, `pages/architecture.html` use `shared-chrome.css` (the `.chrome-*` system) instead of the `.hero-*` markup that `pages/index.html` uses. Unifying them means rewriting the chrome HTML on each page. See _D.2_ for the broader plan.

**Concrete file list (when this lands):**

- HTML rewrites:
  - `dc-planner/pages/report.html` — replace `<div class="chrome">` toolbar wrapper with `<header class="hero">` + `<div class="hero-toolbar">` + `<div class="hero-skin-wrap">` skin picker (mirroring `pages/index.html`).
  - `dc-planner/pages/present.html` — same swap; preserve presentation-mode-specific overrides.
  - `dc-planner/pages/architecture.html` — same swap.
- CSS:
  - Promote ~30 selectors from `dc-planner/css/shared-chrome.css` (the `.chrome-*` ones that mirror `.hero-*`) into `webtools-ui/css/page-chrome.css` under canonical `.hero-*` names.
  - Retire `dc-planner/css/shared-chrome.css` entirely once the secondary pages are migrated.
  - Update `dc-planner/pages/{report,present,architecture}.html` `<link>` order: drop `shared-chrome.css`, ensure `shared/css/base.css` is loaded first, then any page-specific chrome.
- Tests:
  - Add Playwright assertions in `dc-planner/tests/e2e/` that `report.html` / `present.html` / `architecture.html` render the same `.hero-*` skeleton as `index.html`.

**Risk notes:** The `.chrome-*` namespace is reportedly identical in spirit but uses a different CSS variable namespace (`--chrome-*` vs `--ui-*`). A naive find-and-replace will miss variable references and break skin theming on those secondary pages. Plan to do this in two passes: (1) HTML class swap with the legacy `.chrome-*` CSS still loaded, then (2) drop `shared-chrome.css` and verify each skin still themes correctly.

---

## How to read CSS link order in 2026-05-05+

Every page in the three repos should now load CSS in this order:

```html
<!-- 0. Material Symbols font preload (HEAD only — improves first paint) -->
<link rel="preload" href="../shared/css/fonts/material-symbols-outlined.woff2"
      as="font" type="font/woff2" crossorigin />

<!-- 1. Material Symbols (icon font @font-face + .material-symbols-outlined defaults) -->
<!--    NEW: canonical path as of Phase 9.8d-D.1.                                    -->
<link rel="stylesheet" href="../shared/css/material-symbols.css" />

<!-- 2. Canonical baseline -->
<link rel="stylesheet" href="../shared/css/base.css" />

<!-- 3. Per-repo overrides -->
<link rel="stylesheet" href="../css/cm-overrides.css" />     <!-- cluster-manager -->
<link rel="stylesheet" href="../css/pages.css" />            <!-- llm-benchmark   -->
<link rel="stylesheet" href="../css/dc-planner.css" />       <!-- dc-planner      -->

<!-- 4. Skin (swappable at runtime via data-skin attribute) -->
<link id="skinStylesheet" rel="stylesheet"
      href="../shared/css/skins/matte-dark.css" />

<!-- 5. Page-specific chrome -->
<link rel="stylesheet" href="../shared/css/notes-panel.css" />  <!-- pitch.html -->

<!-- 6. Page-specific demo / chat-orb / tutor / etc. -->
<link rel="stylesheet" href="../shared/css/chat-orb.css" />
<link rel="stylesheet" href="../shared/css/demo-mode.css" />
```

**Notes on the new ordering:**

- The canonical `material-symbols.css` MUST load before `base.css` so `base.css`'s `.material-symbols-outlined { font-size: 20px; ... }` rule can override the canonical 24 px default.
- dc-planner is the only consumer that hasn't migrated to canonical Material Symbols yet (D.1 deferred); it loads `../css/material-symbols.css` (its local copy) instead.
- If you find yourself wanting to add `<link href="../css/base.css">` or `<link href="../css/fonts/material-symbols-outlined.woff2">` — those local paths no longer exist in `llm-benchmark` or `cluster-manager`. Use the canonical `shared/` paths.

---

## Per-repo audit reports

The detailed audit findings (file inventories, link-order checks, diff stats) live in each repo's `docs/HARMONIZATION.md`. This top-level doc tracks cross-repo status; the per-repo docs track repo-specific implementation notes.

---

## Change log

- **2026-05-04** — Initial audit + Phase A + Phase B + partial Phase C shipped (`9.8c` series).
- **2026-05-05** — Phase D kickoff (`9.8d` series):
  - **D.1** Material Symbols self-host shipped to `llm-benchmark` + `cluster-manager`. New canonical assets: `webtools-ui/css/material-symbols.css` + `webtools-ui/css/fonts/material-symbols-outlined.woff2` (3.55 MB, md5 `998140309962b4c631d243c5baba487b`). dc-planner deferred pending Playwright icon-parity verification.
  - **D.3** Tier 1 (8 byte-identical selectors) and Tier 2 (11 whitespace-only-differing selectors) deduped from `dc-planner/css/dc-planner.css`. Self-check 531/0. Tier 3 (~55 selectors with semantic differences) deferred — categorized into 4 buckets (`var(--muted)` cleanup, layout-value differences, additive-delta merges, global element selectors).
  - **D.2** & **D.4** scope refined with concrete selector families, per-repo file lists, cascade-order risk notes. No code changes yet.
