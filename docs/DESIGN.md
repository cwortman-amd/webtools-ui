---
type: Design System
title: Dashboard shell & portal design
description: Part of the **webtools-ui SDK**. See [`SDK.md`](SDK.md) for the full component catalog; this doc covers **layout shell** visual rules (sidebar, hero, catalog topnav).
---
# Dashboard shell & portal design

Part of the **webtools-ui SDK**. See [`SDK.md`](SDK.md) for the full component catalog; this doc
covers **layout shell** visual rules (sidebar, hero, catalog topnav).

Use this spec when editing canonical CSS, building new dashboard pages, or reviewing UI PRs across
sibling consumers.

## Design sources

| Layer | Path | Role |
| --- | --- | --- |
| Tokens | `css/tokens.css` | Neutral `--ui-*` defaults (optional; skins override) |
| Base chrome | `css/base.css` | Typography, `.hero`, icon buttons, tabs, forms, tables |
| Shell layout | `css/shell.css` | Sidebar, nav buttons, collapse, mobile drawer, iframe shell |
| Skin | `css/skins/amd-gold.css` (dashboard default) | Color system, accent, surfaces |
| Icons | `css/material-symbols.css` | Outlined Material Symbols at 18–20 px |
| Top-bar tools | `css/chrome.css` | Settings/help/profile popovers (demo-portal, KE catalog) |
| Shell JS | `js/shell.js`, `js/mobile-drawer.js` | Collapse, theme/skin/mode persistence, mobile drawer |

Reference implementations (sibling repos):

- `llm-benchmark/pages/index.html` — sidebar + iframe tabs
- `dc-planner/pages/index.html` — sidebar + dense planner tabs (+ desktop hero override)
- `cluster-manager/pages/index.html` — same shell contract
- `knowledge-exchange/pages/index.html` — sidebar + in-page portal tabs
- `demo-portal/index.html` — catalog topnav variant

Consumers load assets via `../shared/css/...` (symlink to this repo).

---

## Workspace color policy (all projects)

**Scope:** every harmonized consumer that loads `shared/css/*` from this repo —
**cluster-manager**, **dc-planner**, **llm-benchmark**, **knowledge-exchange**, and **demo-portal**.
Product-specific design docs extend this policy; they do not replace it.

Intent: calm, documentation-grade surfaces with **minimal decorative color** — thin line icons,
flat grouped backgrounds, and accent reserved for actions and **meaningful state**.

### Three tiers

| Tier | When | Color treatment |
| --- | --- | --- |
| **1 — Neutral chrome** | Navigation, util icons, metadata, decorative previews, section eyebrows | Greyscale: `--ui-muted`, `--ui-header`, `--ui-line` only |
| **2 — Primary workflow CTAs** | Launch, continue, save/run, send, sidebar Agent, module open | Skin `--ui-accent` fill or strong stroke; `:focus-visible` rings |
| **3 — Status & progress** | Completion, health, queue state, pipeline stage, mastery, pass/warn/fail | **Accent or semantic color on the indicator** (fill, stroke, icon tint, badge) |

**Rule:** If a control or icon communicates **state the user should read or act on**, it is tier 3 —
use color on the status affordance itself. Do not greyscale tier 3 into tier 1.

**Inverse rule:** Decorative structure (collapsed milestone preview, nav icon, filter chip) is tier 1;
do not use solid accent fill.

### Semantic palette (dashboard siblings)

Cluster Manager uses a four-color health vocabulary; reuse the same meanings across operational
dashboards:

| Meaning | Typical use |
| --- | --- |
| OK / pass | Green tint on ring, bar, badge, check icon |
| Warn / degraded | Amber tint |
| Error / fail | Red tint |
| Unknown / empty | Muted slate |

### Per-project examples

| Project | Tier 3 — use color | Tier 1 — stay neutral |
| --- | --- | --- |
| **webtools-ui** | Shared status components; focus rings | Shell nav/util icons, help popover icons |
| **cluster-manager** | Stat rings, dial arcs, bar fills, health badges | Tab chrome, sidebar util icons |
| **dc-planner** | Validation/warning badges on workload/TCO | Nav, filter sidebar chrome |
| **llm-benchmark** | Sweep queue status, pass/fail badges | Dashboard grid chrome |
| **knowledge-exchange** | Progress ring, pathway step dots, recall/grade badges, pipeline stages | Collapsed pathway rail preview (`.flow-node__dot`) |
| **demo-portal** | Demo run status, launch readiness | Catalog card chrome, topnav icons |

### Greyscale chrome passes

Consumers may greyscale tier-1 surfaces in local CSS. Overrides **must not** flatten tier-2 CTAs or
tier-3 status selectors. See `knowledge-exchange/portal/portal.css` § Professional greyscale UI for
the reference implementation.

Primary CTAs that stay accent in greyscale shells: `.module-primary`, `.resume-hero-card__btn`,
`.dev-btn--primary`, `.doc-agent__send`, `.recall-open-btn`, `.ai-send`, `body.nav-side .util-btn-agent`.

---

## Workspace interaction preferences (all projects)

Shared rules for touch, feedback, icons, tokens, and motion. Canonical implementation lives in
`css/base.css`, `css/shell.css`, and [`docs/FRONTEND_PERFORMANCE.md`](FRONTEND_PERFORMANCE.md).

### Touch & pointer

| Context | Minimum target | Notes |
| --- | --- | --- |
| Desktop / fine pointer | **28×28 px** icon buttons (`.hero-icon-btn`, orb header icons) | Nav rows meet this via padding |
| Coarse pointer `(hover: none) and (pointer: coarse)` | **40×40 px** interactive controls | Enforced in `base.css` touch block; see `shared/tests/mobile-api-contract.mjs` |
| Focusable inputs on touch | **16 px** computed `font-size` | Prevents iOS zoom-on-focus (`!important` in touch block) |

Do not shrink primary affordances on smaller viewports (known gap: orb can render smaller on narrow
screens — track in harmonization backlog).

### Async & loading feedback

Use the shared **wait ladder** (see `FRONTEND_PERFORMANCE.md`):

| Threshold | Behavior |
| --- | --- |
| **D = 300 ms** | No indicator before this delay (avoid flicker) |
| **M = 500 ms** | Minimum visible duration once shown |
| **≥ 10 s jobs** | Determinate progress or honest phase text when known |

Never show a fake determinate bar. Empty panels during tab switches must show loading chrome, not a
blank shell (KE: `#create-loading`, browse tab guards in Playwright).

### Icons

- **Material Symbols Outlined** only in harmonized chrome (`material-symbols-outlined`).
- **18 px** in sidebar nav and hero toolbar; **20 px** in sidebar brand.
- Tier-1 chrome icons use `--ui-muted` / `--portal-chrome-icon`, not accent fill.
- Tier-3 status may tint the icon inside a badge or marker.

### Tokens & CSS discipline

- Consumer CSS references **`var(--ui-*)`** and product aliases (`--portal-*` mapped to `--ui-*`).
- No raw hex in consumer styles except documented **semantic status** colors and AMD brand constants.
- Product overrides belong in thin `*-overrides.css` or scoped blocks — do not fork `shell.css` rules.
- Re-declaring shared token names inside a subtree (e.g. glass chat scope) requires private aliases
  (`--gc-*`), not overwriting `--ui-text` globally.

### Motion & reduced motion

| Animation | Duration |
| --- | --- |
| Nav hover / active | 0.12–0.15 s |
| Sidebar collapse | 0.2 s ease |
| Mobile drawer | 0.22 s ease |
| Theme / skin swap | 0.3 s on body background |

Respect `@media (prefers-reduced-motion: reduce)` — disable decorative pulse/spin; keep instant state
changes for accessibility.

### Typography & label casing

Operational dashboards use **Segoe UI** stack (see Part 1 typography table). Marketing/catalog
surfaces (demo-portal pitch cards) may use brand headline/body stacks with the same fallbacks.

| Tier | Examples | Casing |
| --- | --- | --- |
| Navigation & utility chrome | `.nav-btn`, `.util-btn`, `.chip`, `.dev-btn` | Title case from HTML/JS — **no** `text-transform` |
| Primary accent CTAs | `.resume-hero-card__btn`, `.module-primary`, `.util-btn-agent` | Title case — **no** `text-transform` |
| Section metadata | `.path-group__eyebrow`, `.filter-label`, status badge labels | CSS `uppercase` allowed |

---

## Workspace status presentation (all projects)

Extends [Workspace color policy](#workspace-color-policy-all-projects) with layout rules:

1. **Color on the indicator, not the container** — rings, arcs, bar fills, dots, badges, pills; do
   not wash entire cards or panels with semantic background tints.
2. **Decorative vs informative markers** — collapsed previews (pathway rail `.flow-node__dot`) use
   tier-1 translucent haze; expanded steppers and progress markers use tier-3 fill.
3. **One semantic meaning per hue** — do not use green for both “pass” and “informational highlight”
   on the same screen without distinct geometry.

---

## Workspace layout defaults (all projects)

| Surface | Default skin | Scroll container | Nav pattern |
| --- | --- | --- | --- |
| Operational dashboards (CM, LB, DC planner) | `amd-gold` | `.tab-panel` / iframe body | Sidebar `body.nav-side` |
| Knowledge Exchange portal | `matte-dark` | `.tab-panel`, module main | Sidebar + in-page tabs |
| Demo catalog (legacy topnav) | `matte-dark` | Main grid column | Sticky topnav — **marketing exception** for layered gradients |

**Elevation:** border-led surfaces; avoid heavy drop shadows on nav items. **Body scroll:** disabled
for app shells — scroll inner panels only.

---

## Workspace agent chrome (all projects)

Harmonized products mount one **ChatOrb** per top-level window (`shared/js/chat-orb.js`):

| Rule | Detail |
| --- | --- |
| Storage | `storagePrefix` per product (`cluster-manager`, `dc-planner`, …) — no shared transcript across agents |
| Sidebar entry | `util-btn-agent` — tier-2 accent CTA |
| Handoffs | `.ke-orb-handoff` deep links only; not shared memory ([`knowledge-exchange/docs/meta/22-agent-boundaries.md`](../../knowledge-exchange/docs/meta/22-agent-boundaries.md)) |
| External links | Handoffs and docs open `target="_blank"` + `rel="noopener noreferrer"` |

---

## Product DESIGN.md template

Every harmonized repo may ship a **product-local** `docs/DESIGN.md`. It **extends** this file; it must
not contradict workspace policy.

```yaml
---
extends: webtools-ui/docs/DESIGN.md   # canonical workspace policy
workspace_policy: required            # tiers 1–3, interaction prefs
product: cluster-manager              # repo id
---
```

Recommended outline:

1. **Extends** — link to workspace sections (color, interaction, status, layout, agent).
2. **Product tokens / widgets** — geometry, grids, domain-specific components.
3. **Tier-3 examples** — which selectors carry status color in this product.
4. **Known deltas** — intentional exceptions (dc-planner desktop hero, demo-portal gradients).

| Repo | Product DESIGN path |
| --- | --- |
| webtools-ui | `docs/DESIGN.md` (this file — canonical) |
| knowledge-exchange | `docs/DESIGN.md` (mirror + portal Part 2) |
| cluster-manager | `docs/DESIGN.md` (stat tiles, dials, bars) |
| dc-planner | `docs/DESIGN.md` (planner tabs, validation badges) |
| llm-benchmark | `docs/DESIGN.md` (sweep queue, regression status) |
| demo-portal | `docs/DESIGN.md` (readiness badges, catalog cards) |

---

## Part 1 — Dashboard shell (sidebar + menus)

### Design intent

The dashboard shell should feel like a **single focused application**, not a website:

- Fixed viewport; content scrolls inside panels, not the whole page.
- **Navigation lives in a left sidebar** (desktop); primary work area is an iframe or tab panel.
- Chrome is **compact** (40 px header when visible), **dark**, and **border-led** — not shadow-heavy.
- One **skin accent** at a time (default `amd-gold` on all three dashboards).
- Icons + short labels; expert-only items hide via **user mode**, not separate apps.

Personality: technical, calm, dense, documentation-grade.

### Layout anatomy (desktop, `body.nav-side`)

```text
+-- sidebar (180px) ----------+-- shell-body (flex) -------------------+
| [icon] Product name        |                                       |
|----------------------------|  tab-panel (scroll)                   |
| > Plan          (active)   |  +--------------------------------+  |
|   Deploy                   |  | iframe / in-page content       |  |
|   View                     |  |                                |  |
|   ...                      |  +--------------------------------+  |
|                            |                                       |
|----------------------------|                                       |
| Agent                      |                                       |
| Collapse                   |                                       |
| Dark / Settings / Mode     |                                       |
+----------------------------+---------------------------------------+
```

CSS variables (from `css/shell.css`):

- `--side-nav-width: 180px`
- `--side-nav-collapsed-width: 46px`

Body classes:

- `nav-side` — sidebar layout (current standard for all three dashboards).
- `nav-collapsed` — icon-only sidebar; labels hidden.
- `nav-mobile-open` — drawer open on small screens.

### Sidebar structure

Markup contract (simplified from llm-benchmark):

```html
<nav class="sidebar" id="sideNavDrawer">
  <a class="sidebar-brand" href="pitch.html">
    <span class="material-symbols-outlined">speed</span>
    <h1>Product Name</h1>
  </a>
  <div class="sidebar-nav" role="tablist">
    <button class="nav-btn active" role="tab" data-tab="plan">
      <span class="material-symbols-outlined">science</span>
      <span class="nav-label">Plan</span>
    </button>
    <!-- more nav-btn ... -->
  </div>
  <div class="sidebar-bottom">
    <button class="util-btn" id="collapseToggle">...</button>
    <button class="util-btn" id="themeToggleSide">...</button>
    <button class="util-btn" id="skinToggleSide">...</button>
    <div class="side-nav-skin-list" hidden>...</div>
  </div>
</nav>
<div class="shell-body">
  <div id="panel-plan" class="tab-panel"><iframe class="tab-frame" src="plan.html"></iframe></div>
</div>
```

#### Sidebar brand (`.sidebar-brand`)

- Height **40 px**, bottom border `--ui-line`.
- Product icon in **`--ui-accent`**, 20 px Material Symbol.
- Title: **`h1`**, 0.95 rem, `--ui-header`, single line, ellipsis if needed.
- Entire row links to pitch deck (`pitch.html`) where applicable.

#### Primary navigation (`.nav-btn`)

| Property | Value |
| --- | --- |
| Layout | Flex row: 18 px icon + label |
| Padding | 8 px vertical, 8 px horizontal |
| Font | 0.78 rem, weight 500 |
| Default color | `--ui-muted` |
| Hover | Subtle fill (`rgba(255,255,255,0.06)` dark / `rgba(0,0,0,0.05)` light) → `--ui-text` |
| Active | `--skin-tab-active-bg`, `--skin-tab-active-color`, weight **600** |
| Radius | 6 px |
| Gap between items | 1 px (stacked list) |

Each `.nav-btn` maps to a `data-tab` value; JS toggles `.active` and shows the matching `.tab-panel`.

**User mode:** add `mode-advanced` or `mode-expert` on items hidden in lower modes (`body[data-user-mode="standard"]` hides both).

#### Utility rail (`.sidebar-bottom` + `.util-btn`)

Bottom stack separated by top border:

- **Agent** — opens chat orb / agent panel (`util-btn-agent`).
- **Collapse** — toggles `nav-collapsed` on `body`.
- **Theme** — light/dark (`data-theme` on `html`/`body`).
- **Settings** — expands inline `.side-nav-skin-list` (skin picker).
- **User mode** — expands `.side-nav-mode-list` (Standard / Advanced / Expert).

`.util-btn` matches `.nav-btn` density but **0.72 rem** type. Chevron (`expand_more`) indicates expandable lists.

Inline skin/mode lists use `.side-nav-skin-option` / `.side-nav-mode-option`: 0.72 rem, indented under parent, active option in **`--ui-accent`**.

### Hero bar (mobile + optional desktop)

On **`body.nav-side` desktop**, the fixed `.hero` is **hidden**; sidebar owns navigation.

On **≤640 px**, `.hero` returns:

- **Hamburger** (`.hero-mobile-menu`) — flat icon, no plate; opens drawer.
- **Brand link** (`.hero-title`) — icon + product name.
- Optional **toolbar** (`.hero-toolbar`) — 28×28 `.hero-icon-btn` actions (demo, theme, settings).

Hero bar spec (`css/base.css`):

- Fixed top, **40 px** tall, `z-index: 100`.
- Background: `color-mix(..., var(--skin-hero-bg) 82%, transparent)` + **12 px blur**.
- Bottom border: `1px solid var(--ui-line)`.
- Safe-area aware (`env(safe-area-inset-*)`).

#### Icon buttons (`.hero-icon-btn`)

- **28×28 px**, radius **6 px**.
- Toolbar variant: transparent background, no border (flat).
- Hover: slight lift on standalone buttons; toolbar stays flat.
- Icons: **18 px** Material Symbols inside.

#### Skin menu (`.hero-skin-menu`)

Pop-down anchored to settings gear in hero toolbar (when used):

- Section titles: 10 px uppercase, `--ui-muted`.
- Options: `.hero-skin-option`, `.hero-mode-option` — full-width row buttons.
- Active: weight 600 + subtle background wash.

### Content shell (`.shell-body` + `.tab-panel`)

- Fills viewport beside sidebar (`left: var(--side-nav-width)`).
- **No page scroll** on `body`; `.tab-panel` scrolls with `overscroll-behavior-y: contain`.
- Hidden panels: `.tab-panel.hidden { display: none }`.
- Iframe tabs: `.tab-frame` flex-grow, borderless, full width.

### Typography & density

| Element | Size | Weight | Color token |
| --- | --- | --- | --- |
| Body | 13 px | 400 | `--ui-text` |
| Sidebar nav | 0.78 rem | 500 / 600 active | `--ui-muted` → `--ui-header` |
| Sidebar util | 0.72 rem | 500 | `--ui-muted` |
| Brand title | 0.95 rem | normal title | `--ui-header` |
| Panel headings | 13 px+ | 600 | `--ui-header` |

Font stack: `"Segoe UI", Tahoma, Geneva, Verdana, sans-serif`.

### Color & skins

Default dashboard skin: **`amd-gold`** (`data-skin="amd-gold"` on `<html>`).

Rules:

- **One accent skin per screen** — do not mix amd / amd-teal / amd-gold as equal decorations.
- Surfaces: `--ui-bg` (canvas), `--ui-panel` (cards/panels), `--ui-line` (borders).
- Text: `--ui-header` (titles), `--ui-text` (body), `--ui-muted` (secondary).
- Accent: `--ui-accent` for tier **2** primary CTAs and tier **3** status/progress — not for tier **1** decorative chrome ([Workspace color policy](#workspace-color-policy-all-projects)).
- Light mode: `data-theme="light"` on root; hover washes invert to dark-on-light.

Available skins (`css/skins/`): `amd-gold`, `amd`, `amd-teal`, `matte-dark`, `glass-dark`, `minimal-monochrome`, `soft-neutral-light`.

See also [`docs/TOKENS.md`](TOKENS.md) for the neutral token layer.

### Motion

- Sidebar width / collapse: **0.2 s ease**.
- Mobile drawer slide: **0.22 s ease**.
- Nav hover/active: **0.12–0.15 s** background/color.
- Theme/skin changes: **0.3 s** on body background (`base.css`).

Keep motion subtle — no large parallax or bounce on navigation.

### Accessibility

- Sidebar tabs: `role="tablist"` / `role="tab"` / `aria-selected`.
- Mobile menu: `aria-controls`, `aria-expanded` on hamburger.
- Expandable util sections: `aria-controls` + `hidden` on lists.
- Focus: visible rings via `:focus-visible` and `--ui-accent` (`base.css`).
- Tap highlight suppressed on interactive chrome (`-webkit-tap-highlight-color: transparent`).
- Touch targets: **28×28 px** minimum on desktop icon buttons; **40×40 px** on coarse pointers
  ([Workspace interaction preferences](#workspace-interaction-preferences-all-projects)).

### CSS class quick reference

| Class | Purpose |
| --- | --- |
| `.sidebar` | Fixed left nav column |
| `.sidebar-brand` | Logo + product name |
| `.sidebar-nav` | Primary `.nav-btn` stack |
| `.nav-btn` / `.nav-btn.active` | Tab switcher |
| `.sidebar-bottom` | Utility button stack |
| `.util-btn` | Secondary chrome actions |
| `.side-nav-skin-list` | Inline skin picker |
| `.shell-body` | Main content offset |
| `.tab-panel` / `.tab-frame` | Tab content / iframe |
| `.hero` / `.hero-toolbar` | Top bar (mobile) |
| `.hero-icon-btn` | 28 px toolbar control |
| `.nav-backdrop` | Dim overlay when drawer open |

### Do (dashboard shell)

- Edit sidebar/nav rules in `css/shell.css` and hero/toolbar rules in `css/base.css`.
- Keep product-specific deltas in consumer `*-overrides.css` only.
- Keep sidebar labels short (one word when possible).
- Use Material Symbols outlined, 18 px in nav, 20 px in brand.
- Gate expert nav with `mode-advanced` / `mode-expert`, not separate builds.
- Preserve collapse + mobile drawer behavior from `js/mobile-drawer.js` / `js/shell.js`.

### Do not (dashboard shell)

- Do not fork `.nav-btn` / `.sidebar` rules into consumer CSS — extend via tokens or thin overrides.
- Do not use multi-column top tab strips on desktop (retired Phase 9.8e; sidebar is canonical).
- Do not use heavy box shadows on nav items; borders and subtle fills only.
- Do not use multiple accent colors as decoration on one view (tier 1).
- Do not greyscale tier-3 status/progress when applying a professional greyscale chrome pass.
- Do not scroll the entire `body` for main app content — scroll `.tab-panel`.

### Modular tabs (shell modules)

Product views should register as **shell modules** via `ShellModules` rather than forking
`Shell.switchTab`. See [`docs/SHELL_MODULES.md`](SHELL_MODULES.md).

```javascript
ShellModules.init({ source: "data/shell-modules.json", hooksOnly: true });
Shell.init();
```

Each module = one sidebar tab + one panel (iframe, HTML, or `mount()`).

---

## Part 2 — Catalog topnav variant

Knowledge Exchange and demo-portal use **`catalog-topnav`** instead of the dashboard sidebar shell:
sticky top navigation (`.topnav` from `chrome.css`) + filter sidebar or plugin grid.

### When to use which layout

| Pattern | Use for | Key CSS |
| --- | --- | --- |
| **Dashboard shell** | Multi-tab operational tools (plan, deploy, monitor) | `shell.css`, `body.nav-side` |
| **Catalog topnav** | Browse/search catalogs (modules, demos, resources) | `chrome.css`, `.topnav`, `.catalog-header` |

Catalog consumers adopt shared **chrome** (top bar tools, skin/mode) via `js/chrome.js` /
`WebtoolsChrome` while keeping catalog-specific layout in local CSS (`portal/portal.css` in KE).

### Catalog load order

```html
<link rel="stylesheet" href="../shared/css/material-symbols.css" />
<link rel="stylesheet" href="../shared/css/tokens.css" />
<link rel="stylesheet" href="../shared/css/base.css" />
<link id="skinStylesheet" rel="stylesheet" href="../shared/css/skins/matte-dark.css" />
<link rel="stylesheet" href="../shared/css/chrome.css" />
<link rel="stylesheet" href="../shared/css/components.css" />
<!-- consumer catalog CSS last -->
```

Default catalog skin: **`matte-dark`**.

### Harmonization path

If a catalog consumer adds multi-tab operational surfaces (e.g. a future KE Studio UI), adopt Part 1:

1. Add `shell.css` to the page head (after base + skin).
2. Set `body class="nav-side"`.
3. Use the sidebar markup contract above.
4. Keep product-specific rules in a thin overrides file (pattern: `css/shell-local.css` in llm-benchmark).

Until then, treat Part 1 as the **reference aesthetic** for menu density, colors, and interaction,
implemented in catalog form via `chrome.css` topnav links (`.topnav__link`, `.topnav__link.is-active`).

---

## Related documents

- [`docs/TOKENS.md`](TOKENS.md) — design token layer
- [`docs/INDEX_SKELETON.md`](INDEX_SKELETON.md) — HTML head skeleton
- [`docs/CSS_HARMONIZATION.md`](CSS_HARMONIZATION.md) — dedup tracking
- [`docs/PLUGIN_CONTRACT.md`](PLUGIN_CONTRACT.md) — plugin platform
- Consumer mirrors: `knowledge-exchange/docs/DESIGN.md`
- Product extensions: `cluster-manager/docs/DESIGN.md`, `dc-planner/docs/DESIGN.md`,
  `llm-benchmark/docs/DESIGN.md`, `demo-portal/docs/DESIGN.md`
- Sibling harmonization: `cluster-manager/docs/HARMONIZATION.md`, `dc-planner/docs/HARMONIZATION.md`, `llm-benchmark/docs/HARMONIZATION.md`

## FAQ

**Q: When is accent color allowed outside primary buttons?**  
Tier 3 — status and progress indicators (health rings, pass/fail badges, completion markers). Decorative
nav and preview chrome stays tier 1 greyscale. See [Workspace color policy](#workspace-color-policy-all-projects).

**Q: Which file owns the sidebar CSS?**  
`css/shell.css`. Consumers symlink `shared/` and must not fork nav component rules locally.

**Q: What is the default skin for dashboards?**  
`amd-gold` on cluster-manager, dc-planner, and llm-benchmark. Catalog consumers default to `matte-dark`.

**Q: Why does dc-planner still show a hero bar on desktop?**  
dc-planner overrides `body.nav-side .hero { display: flex }` to host save/load toolbar actions
beside the sidebar. That is an intentional product delta; sidebar nav rules still come from `shell.css`.

**Q: How do I add a new sidebar tab?**  
Add a `.nav-btn` with `data-tab`, a matching `#panel-*` + `.tab-panel`, and wire tab switch JS. Follow
existing icon + label spacing; add `mode-*` class if expert-only.

**Q: What touch target size should controls use?**  
28×28 px minimum on desktop chrome; 40×40 px on coarse-pointer devices. See
[Workspace interaction preferences](#workspace-interaction-preferences-all-projects).

**Q: Where do product-specific design rules live?**  
In each repo's `docs/DESIGN.md` using the [Product DESIGN.md template](#product-designmd-template).
Must extend workspace policy, not replace it.
