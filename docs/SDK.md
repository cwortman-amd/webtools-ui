---
type: Reference
title: webtools-ui SDK
description: '**webtools-ui is the UI SDK** for AMD Instinct web tools. It defines **look and feel** (tokens, skins, typography, motion) and ships **common components** (sidebar, topnav, buttons, chips, forms, tables, chat orb, demo chrome) that sibling products consume through a stable mount contract.'
aliases:
- UI SDK
- Design System SDK
- Webtools SDK
status: active
updated: 2026-08-09
---
<!-- markdownlint-disable MD025 -->
# webtools-ui SDK

**webtools-ui is the UI SDK** for AMD Instinct web tools. It defines **look and feel** (tokens,
skins, typography, motion) and ships **common components** (sidebar, topnav, buttons, chips, forms,
tables, chat orb, demo chrome) that sibling products consume through a stable mount contract.

Products (`cluster-manager`, `llm-benchmark`, `knowledge-exchange`, …) bring **domain logic and
data**. The SDK brings **visual language and reusable UI**.

Related:

- Visual spec: [`DESIGN.md`](DESIGN.md)
- Tokens: [`TOKENS.md`](TOKENS.md)
- Platform / plugins: [`PLATFORM_MODEL.md`](PLATFORM_MODEL.md)
- Contribution points: [`CONTRIBUTIONS.md`](CONTRIBUTIONS.md)

---

## SDK mental model

```text
┌─────────────────────────────────────────────────────────────┐
│  CONSUMER PRODUCT (sibling repo)                            │
│  domain pages · APIs · data · shell-modules.json            │
└────────────────────────────┬────────────────────────────────┘
                             │ mounts shared/ → webtools-ui
┌────────────────────────────▼────────────────────────────────┐
│  webtools-ui SDK                                              │
│  ┌─────────────┐ ┌──────────────┐ ┌────────────────────────┐ │
│  │ Design      │ │ Layout       │ │ Components + services  │ │
│  │ tokens·skins│ │ shell·chrome │ │ chips·forms·orb·demo   │ │
│  └─────────────┘ └──────────────┘ └────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

| You need | SDK layer | Do not rebuild in product CSS |
| --- | --- | --- |
| Colors, spacing, radius | `tokens.css` + skins | Hex literals for chrome |
| Sidebar, tabs, hero | `shell.css` + `base.css` | `.nav-btn`, `.sidebar` forks |
| Catalog top bar | `chrome.css` | `.topnav` forks |
| Filter chips, stat cards | `components.css` | One-off chip styles |
| Agent, demo, voice | `js/*` services | Copy-paste orb CSS |

---

## Install (consumer mount)

Local dev: symlink the SDK beside your repo.

```bash
cd ~/workspace/my-product
ln -s ../webtools-ui shared
```

Declare consumption in `plugin.manifest.json` (`webtools.css`, `webtools.js`, `contributes`).

### Dashboard load order

```html
<link rel="stylesheet" href="../shared/css/material-symbols.css" />
<link rel="stylesheet" href="../shared/css/tokens.css" />
<link rel="stylesheet" href="../shared/css/base.css" />
<link id="skinStylesheet" rel="stylesheet" href="../shared/css/skins/amd-gold.css" />
<link rel="stylesheet" href="../shared/css/shell.css" />
<link rel="stylesheet" href="../shared/css/components.css" />
<!-- product overrides last -->
<link rel="stylesheet" href="../css/product-overrides.css" />
```

```html
<script src="../shared/js/mobile-drawer.js" defer></script>
<script src="../shared/js/shell.js"></script>
<script src="../shared/js/shell-modules.js"></script>
<script src="../shared/js/platform.js"></script>
<script src="../js/plugin-mount.js"></script>
```

### Catalog load order

Same through `base.css` + skin, then **`chrome.css`** instead of `shell.css`, then
`components.css`, then product portal CSS.

See [`INDEX_SKELETON.md`](INDEX_SKELETON.md) for CI-locked head prefixes.

---

## Design system (look & feel)

### Tokens (`css/tokens.css`)

Neutral defaults for `--ui-*` custom properties. Skins override for brand accent.

| Token family | Examples | Use |
| --- | --- | --- |
| Surfaces | `--ui-bg`, `--ui-panel`, `--ui-line` | Page canvas, cards, borders |
| Text | `--ui-header`, `--ui-text`, `--ui-muted` | Titles, body, secondary |
| Accent | `--ui-accent`, `--ui-accent-soft` | Active nav, links, focus |
| Component | `--component-radius-sm`, `--component-accent` | Chips, stat cards |

Full reference: [`TOKENS.md`](TOKENS.md).

### Skins (`css/skins/*.css`)

| Skin | Default for |
| --- | --- |
| `amd-gold` | Dashboards (cluster-manager, dc-planner, llm-benchmark) |
| `matte-dark` | Catalogs (knowledge-exchange, demo-portal) |
| `amd`, `amd-teal`, `glass-dark`, … | User-selectable alternates |

Set `data-skin` on **`<html>`** and `<body>`.

### Typography & density

- Body: **13px**, `"Segoe UI", …`
- Sidebar nav: **0.78rem**, weight 500/600 active
- Icons: Material Symbols outlined, **18px** nav / **20px** brand
- Chrome: **border-led**, subtle fills — not shadow-heavy ([`DESIGN.md`](DESIGN.md))

---

## Layout shells (SDK regions)

Two harmonized app shells — pick one per product entry:

| Shell | CSS | Primary regions |
| --- | --- | --- |
| **Dashboard** | `shell.css` | `.sidebar`, `.sidebar-nav`, `.shell-body`, `.tab-panel` |
| **Catalog** | `chrome.css` | `.topnav`, `.logo`, filter sidebar, card grid |

Shell components are **infrastructure**. Product features snap on via
[`ShellModules`](SHELL_MODULES.md) (dashboard) or catalog-specific JS (cards, filters).

---

## Component catalog

Use these class names as-is. Extend with BEM modifiers (`--accent`, `.is-active`), not parallel
component systems.

### Navigation (dashboard — `shell.css`)

| Component | Classes | Notes |
| --- | --- | --- |
| Sidebar | `.sidebar`, `#sideNavDrawer` | Fixed left column |
| Brand row | `.sidebar-brand` | 40px, icon + `h1` |
| Tab button | `.nav-btn`, `.nav-label` | `data-tab`, `role="tab"` |
| Utility button | `.util-btn`, `.sidebar-bottom` | Agent, collapse, theme |
| Content area | `.shell-body`, `.tab-panel`, `.tab-frame` | iframe panels |
| Mobile backdrop | `.nav-backdrop` | Drawer dim |

### Top chrome (`base.css` + `shell.css`)

| Component | Classes | Notes |
| --- | --- | --- |
| Hero bar | `.hero`, `.hero-main` | 40px; mobile hamburger |
| Toolbar | `.hero-toolbar`, `.hero-icon-btn` | 28×28 flat icons |
| Skin menu | `.hero-skin-menu`, `.hero-skin-option` | Pop-down picker |
| Mobile menu | `.hero-mobile-menu` | Opens drawer ≤640px |

### Catalog chrome (`chrome.css`)

| Component | Classes | Notes |
| --- | --- | --- |
| Top nav | `.topnav`, `.topnav__inner` | Sticky 44px |
| Logo | `.logo`, `.logo__mark`, `.logo__name` | Brand + product name |
| Nav link | `.topnav__link`, `.is-active` | Catalog sections |
| Tool action | `.topnav__action`, `.tool-popover` | Settings, help |
| Segmented control | `.segmented`, `.segmented__btn` | Mode toggles |

### Content & forms (`base.css`)

| Component | Classes | Notes |
| --- | --- | --- |
| Page wrapper | `.page`, `.panel`, `.row` | In-iframe layouts |
| Tab pill | `.tab-btn`, `.tab-icon` | In-page tabs (not sidebar) |
| Button | `button`, `button.secondary` | Primary/secondary |
| Pill | `.pill`, `.pill.accent` | Tags, compact actions |
| Form controls | `input`, `select`, `input[type=range]` | Themed inputs |
| Table | `table`, `th`, `td` | Dense data tables |
| Hint / warning | `.hint`, `.warning` | Secondary copy |
| Action row | `.actions` | Button groups |
| Focus ring | `:focus-visible` | Uses `--ui-accent` |

### Shared widgets (`components.css`)

| Component | Classes | Notes |
| --- | --- | --- |
| Stat card grid | `.statcard-grid`, `.statcard` | KPI strip (opt-in name) |
| Stat label/value | `.statcard__label`, `.statcard__num` | Uppercase label |
| Filter chip | `.chip-row`, `.chip`, `.is-active` | Toggle filters |
| Active filter | `.active-filters`, `.active-chip` | Removable tags |
| Code block | `.code-wrapper`, `.code-block` | Monospace + scroll |
| Copy button | `.copy-btn`, `.is-copied` | Overlay on code |

### Agent & demo (feature CSS + JS)

| Component | CSS | JS API |
| --- | --- | --- |
| Chat orb | `chat-orb.css` | `ChatOrb.mount({…})` |
| Demo player | `demo-mode.css` | `DemoEngine`, `DashboardTutor` |
| Notes drawer | `notes-panel.css` | Pitch deck speaker notes |
| Error modal | — | `ErrorPopup.show()` |

---

## JavaScript SDK surface

| Module | Global | Role |
| --- | --- | --- |
| Layout | `Shell` | Theme, tabs, collapse |
| Modules | `ShellModules` | Declarative sidebar tabs |
| Platform | `WebtoolsPlatform` | Plugin registry + facades |
| Chrome | `WebtoolsChrome` | Catalog top-bar tools |
| Commands | `SlashRouter` | Slash command bus |
| Chat | `ChatOrb` | Agent panel |
| Demo | `DemoEngine` | Walkthrough scenes |
| Voice | `voiceBridge` | TTS/STT |
| Mobile | `MobileDrawer` | Off-canvas nav |

Configure via `plugin.manifest.json` → `contributes.services` and mount adapters.
See [`CONTRIBUTIONS.md`](CONTRIBUTIONS.md).

---

## Markup examples

### Sidebar tab (dashboard)

```html
<button class="nav-btn active" role="tab" aria-selected="true" data-tab="plan"
        title="Configure test parameters">
  <span class="material-symbols-outlined">science</span>
  <span class="nav-label">Plan</span>
</button>
```

### Filter chips (catalog)

```html
<div class="chip-row" role="group" aria-label="Level">
  <button class="chip is-active" aria-checked="true">L1</button>
  <button class="chip" aria-checked="false">L2</button>
</div>
```

### Stat card

```html
<div class="statcard-grid">
  <div class="statcard statcard--accent">
    <span class="statcard__label">GPUs</span>
    <span class="statcard__num">8</span>
  </div>
</div>
```

### Code block + copy

```html
<div class="code-wrapper">
  <pre class="code-block"><code>rocm-smi</code></pre>
  <button class="copy-btn" type="button" aria-label="Copy">
    <span class="material-symbols-outlined">content_copy</span>
  </button>
</div>
```

---

## Extension rules (SDK contract)

### Do

- Load SDK layers in documented order; put product CSS **last**.
- Use `--ui-*` / `--component-*` tokens in product overrides.
- Register features through `ShellModules`, `contributes`, and mount adapters.
- Push reusable widgets upstream into `components.css` or `chrome.css`.

### Do not

- Fork `.nav-btn`, `.topnav`, `.chip`, or orb styles into product repos.
- Introduce parallel design systems (Bootstrap, Tailwind) on SDK pages.
- Hardcode brand colors when a skin token exists.
- Patch SDK files from consumer repos — symlink and commit upstream.

---

## Product override pattern

Thin product layer only:

```text
my-product/
  shared → ../webtools-ui          # SDK (read-only mount)
  css/product-overrides.css        # domain-specific deltas
  pages/*.html                     # compose SDK components
  data/shell-modules.json          # dashboard tab registry
  js/plugin-mount.js               # contributes + services
```

Overrides should **compose** SDK classes, not replace them:

```css
/* good — domain layout on SDK panel */
.my-solver-grid { display: grid; gap: 12px; }

/* bad — reimplements nav button */
.my-sidebar-btn { padding: 8px; border-radius: 6px; … }
```

---

## Validation

SDK drift is gated in CI:

```bash
cd webtools-ui
make ci                         # plugin manifests + shared mounts
make enhanced-validation        # cross-repo self-checks
bash scripts/verify-vendor-manifest.sh   # per consumer
python3 scripts/check_index_skeleton.py --repo llm-benchmark
```

---

## Roadmap (SDK)

| Phase | Work |
| --- | --- |
| **SDK-1 (landed)** | Tokens, skins, base, shell, chrome, components |
| **SDK-2 (landed)** | Platform model, shell modules, contributes — all three dashboards migrated (P5–P6b) |
| **SDK-3** | `docs/SDK.md` component gallery HTML (visual reference) |
| **SDK-4** | `components.registry.json` for CI + agent discovery |
| **SDK-5** | Consolidate remaining consumer CSS duplicates into SDK |

---

## Seed FAQ

**Q: Is webtools-ui a npm package?**  
No. It is a **git-mounted SDK** (`shared/` symlink). Versioning is via `minWebtoolsVersion` in
`plugin.manifest.json` and vendor manifest hashes.

**Q: Where is the Storybook?**  
Not yet. This doc + [`DESIGN.md`](DESIGN.md) are the contract; SDK-3 adds a static gallery page.

**Q: Can I use only components.css without shell.css?**  
Yes for embedded iframe pages inside a product. Full apps should use the shell profile matching
their `type` (`dashboard` vs `catalog`).

**Q: Who owns look and feel changes?**  
`webtools-ui` maintainers. Consumers file upstream PRs; harmonization CI prevents silent drift.

## Related documents

- [`DESIGN.md`](DESIGN.md) — sidebar & catalog visual spec
- [`TOKENS.md`](TOKENS.md) — token layer
- [`PLATFORM_MODEL.md`](PLATFORM_MODEL.md) — plugin architecture
- [`CONTRIBUTIONS.md`](CONTRIBUTIONS.md) — swap/mix modules
- [`PLUGIN_CONTRACT.md`](PLUGIN_CONTRACT.md) — manifest schema
