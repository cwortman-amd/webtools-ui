---
type: Reference
title: Shell modules — modular sidebar infrastructure
description: This document defines how **product functionality snaps onto** the harmonized dashboard shell shared by `cluster-manager`, `dc-planner`, and `llm-benchmark`.
---
# Shell modules — modular sidebar infrastructure

This document defines how **product functionality snaps onto** the harmonized dashboard
shell shared by `cluster-manager`, `dc-planner`, and `llm-benchmark`.

Related:

- Platform model: [`PLATFORM_MODEL.md`](PLATFORM_MODEL.md)
- Visual spec: [`DESIGN.md`](DESIGN.md)
- Plugin contract: [`PLUGIN_CONTRACT.md`](PLUGIN_CONTRACT.md)
- Runtime: [`js/shell.js`](../js/shell.js), [`js/shell-modules.js`](../js/shell-modules.js)
- Schema: [`schemas/shell-module.schema.json`](../schemas/shell-module.schema.json)

---

## Problem (historical)

Each dashboard used to ship **hand-authored sidebar HTML** and **inline tab-switch logic**.
That diverged across siblings and made platform activation (`onTab:*`, `shell:tabChanged`) hard to
wire consistently.

**Status (2026-08):** all three dashboards now register tabs in `data/shell-modules.json` and
mount via `js/plugin-mount.js`. Tab switching still uses three patterns (see below) — the registry
and manifest contract are unified; only the controller layer differs.

| Consumer | Shell bootstrap | Tab logic |
| --- | --- | --- |
| llm-benchmark | `Shell.init()` (canonical) | Shared `Shell.switchTab` |
| cluster-manager | `shell-tab-controller.js` | Custom `switchTab()` + iframe prewarm; dispatches platform events |
| dc-planner | Inline `setActiveTab()` | In-page panels; dispatches platform events |

Product features (Plan, Deploy, Monitor, …) are now expressed as **shell modules** in JSON.
Chat orb, demo, and slash commands use the same mount-adapter pattern as sidebar tabs.

Goal (achieved for dashboards): **one harmonized sidebar infrastructure** where each feature is a
declarative or registered **shell module** that plugs into shared chrome without reimplementing
layout, collapse, mobile drawer, skin/mode pickers, or deep linking.

---

## Architecture

```text
┌─────────────────────────────────────────────────────────────────┐
│  webtools-ui (platform)                                         │
│  css/shell.css · css/base.css · js/shell.js · js/mobile-drawer  │
└───────────────────────────────┬─────────────────────────────────┘
                                │ owns chrome + tab switching
┌───────────────────────────────▼─────────────────────────────────┐
│  ShellModules (js/shell-modules.js)                             │
│  register · render · lifecycle hooks · mode visibility          │
└───────────────────────────────┬─────────────────────────────────┘
                                │ snaps on
        ┌───────────────────────┼───────────────────────┐
        ▼                       ▼                       ▼
   shell module              shell module            shell module
   { id: plan }              { id: queue }           { id: monitor }
   iframe: plan.html         iframe: queue.html     mount: fn(el)
        │                       │                       │
        └───────────────────────┴───────────────────────┘
                                │
┌───────────────────────────────▼─────────────────────────────────┐
│  Consumer plugin (cluster-manager | dc-planner | llm-benchmark) │
│  plugin.manifest.json + data/shell-modules.json + mount script  │
└─────────────────────────────────────────────────────────────────┘
```

### Layers

| Layer | Owns | Does not own |
| --- | --- | --- |
| **Shell** (`shell.js`) | Skin/theme/mode persistence, collapse, `switchTab`, URL `?tab=`, mobile drawer wiring | Product tab definitions, iframe prewarm policy |
| **ShellModules** (`shell-modules.js`) | Module registry, optional DOM render, lifecycle hooks, mode gating helpers | Product business logic inside panels |
| **Plugin mount** (`js/plugin-mount.js`) | Register modules, wire product APIs, call `ShellModules.init()` | Sidebar CSS, nav button styling |
| **Module** (feature) | One user-facing view: HTML page, iframe target, or `mount()` function | Global shell layout |

---

## Shell module swapping

Modules support **composition** without forking shell chrome:

| API / field | Action |
| --- | --- |
| `"replaces": "plan"` (JSON) | Unregister `plan`, register this module |
| `ShellModules.replace(id, def)` | Imperative swap at runtime |
| `ShellModules.setEnabled(id, false)` | Hide module; redirect if active |
| `ShellModules.unregister(id)` | Remove module + run panel cleanup |
| `"enabled": false` (JSON) | Register disabled; enable later |

See [`CONTRIBUTIONS.md`](CONTRIBUTIONS.md) for service swapping (`WebtoolsPlatform.registerService`)
and activation events.

---

## Shell module contract

A shell module is the smallest unit of sidebar navigation — one tab + one panel.

### Declarative (JSON)

File: `data/shell-modules.json` (or `registrations.shellModules` in manifest).

```json
{
  "modules": [
    {
      "id": "plan",
      "label": "Plan",
      "icon": "science",
      "mode": "standard",
      "order": 10,
      "panel": { "type": "iframe", "src": "plan.html", "lazy": true }
    },
    {
      "id": "queue",
      "label": "Deploy",
      "icon": "rocket_launch",
      "mode": "standard",
      "order": 20,
      "panel": { "type": "iframe", "src": "queue.html", "lazy": true }
    },
    {
      "id": "profile",
      "label": "Profile",
      "icon": "tune",
      "mode": "advanced",
      "order": 30,
      "panel": { "type": "iframe", "src": "profile.html", "lazy": true }
    }
  ],
  "defaultTab": "plan"
}
```

Schema: [`schemas/shell-module.schema.json`](../schemas/shell-module.schema.json).

### Imperative (JS)

For dynamic visibility, redirects, or in-page mounts:

```javascript
ShellModules.register({
  id: "monitor",
  label: "Monitor",
  icon: "monitoring",
  mode: "advanced",
  order: 40,
  panel: { type: "iframe", src: "monitor.html", lazy: true },
  visible: function (ctx) {
    return ctx.userMode !== "standard";
  },
  onBeforeActivate: function (ctx) {
    if (!ctx.features.networkReady) return "install"; // redirect tab id
    return ctx.tabId;
  },
  onActivate: function (panel, ctx) {
    // optional: custom lazy-load beyond Shell.switchTab data-src
  },
});
```

### Module fields

| Field | Required | Description |
| --- | --- | --- |
| `id` | yes | Stable tab id; matches `data-tab`, `panel-{id}`, URL `?tab=` |
| `label` | yes | Sidebar label (keep short — one word when possible) |
| `icon` | yes | Material Symbols ligature name |
| `mode` | no | `standard` (default), `advanced`, or `expert` — maps to `mode-advanced` / `mode-expert` CSS |
| `order` | no | Sort key for render (lower first) |
| `title` | no | Tooltip / `title` attribute |
| `placement` | no | `nav` (default) or `bottom` — cluster-manager Docs tab pattern |
| `panel.type` | yes | `iframe`, `html`, or `mount` |
| `panel.src` | iframe | Relative URL under `pages/` |
| `panel.lazy` | no | When true, use `data-src` defer (Shell.switchTab loads on first visit) |
| `panel.html` | html | Static HTML string inserted into panel |
| `panel.mount` | mount | Function `(panelEl, ctx) => cleanup \| void` |
| `visible` | no | `(ctx) => boolean` — runtime gate beyond user mode |
| `onBeforeActivate` | no | `(ctx) => tabId` — redirect before switch |
| `onActivate` / `onDeactivate` | no | Panel lifecycle |

### Context object (`ctx`)

Passed to hooks:

```javascript
{
  tabId: "monitor",
  userMode: "advanced",       // from body[data-user-mode]
  skin: "amd-gold",
  theme: "dark",
  collapsed: false,
  platform: WebtoolsPlatform, // when loaded
  features: {}                // consumer mount script may attach flags
}
```

---

## Bootstrap sequence

Recommended load order for `type: dashboard` plugins:

```html
<!-- head: material-symbols, base, skin, shell.css (unchanged skeleton) -->

<body class="nav-side">
  <!-- Option A: static HTML (legacy) — modules register hooks only -->
  <nav class="sidebar" id="sideNavDrawer">...</nav>
  <div class="shell-body">...</div>

  <script src="../shared/js/mobile-drawer.js" defer></script>
  <script src="../shared/js/shell.js"></script>
  <script src="../shared/js/shell-modules.js"></script>
  <script src="../shared/js/platform.js"></script>
  <script src="../js/plugin-mount.js"></script>
  <script>
    window.SHELL_PREFIX = "cm"; // per-product localStorage namespace
    ShellModules.init({ source: "data/shell-modules.json" /* or modules: [...] */ });
    Shell.init();
  </script>
</body>
```

```javascript
// js/plugin-mount.js (consumer)
(function () {
  "use strict";

  // 1. Register dynamic modules / hooks
  ShellModules.register({ id: "debug", /* ... */ visible: isDebugAllowed });

  // 2. Optional: generate DOM from registry (greenfield or codegen)
  // ShellModules.render({ nav: ".sidebar-nav", panels: ".shell-body" });

  // 3. Product integrations
  WebtoolsPlatform.register({
    id: "cluster-manager",
    onload: function (app) {
      app.features = { networkReady: false /* ... */ };
      // chat orb, slash, demo — existing mount adapter
    },
  });
})();
```

**Init order matters:** `ShellModules.init()` before `Shell.init()` so tab buttons exist (when using
`render()`) and hook listeners are registered before first `switchTab`.

---

## Integration modes

### Mode 1 — Static HTML + hooks (migration-friendly)

Keep existing `index.html` sidebar markup. Register modules only for lifecycle and gating:

```javascript
ShellModules.register({ id: "plan", label: "Plan", icon: "science", panel: { type: "iframe", src: "plan.html" } });
ShellModules.init({ hooksOnly: true });
Shell.init();
```

`hooksOnly: true` skips DOM generation; registry drives `onActivate`, `visible`, redirects.

**Best for:** cluster-manager, dc-planner (minimal HTML churn).

### Mode 2 — Declarative render (greenfield)

Omit hand-written `.nav-btn` rows; load JSON and call `ShellModules.render()`:

```javascript
ShellModules.init({ source: "data/shell-modules.json", render: true });
Shell.init();
```

**Best for:** new dashboards, generated index pages.

### Mode 3 — Hybrid manifest

Extend `plugin.manifest.json`:

```json
{
  "registrations": {
    "shellModules": "data/shell-modules.json",
    "slashCommands": "js/chat-orb-mount.js"
  }
}
```

CI can validate JSON against schema and cross-check ids against `pages/*.html`.

---

## Harmonization with existing consumers

### Three controller patterns (all landed)

| Pattern | Consumer | `ShellModules.init` | Tab switch | Panel type |
| --- | --- | --- | --- | --- |
| **A — canonical** | llm-benchmark | `hooksOnly: true` + `Shell.init()` | `Shell.switchTab` | iframe (`pages/*.html`) |
| **B — extracted controller** | cluster-manager | `hooksOnly: true`, `skipModeVisibility: true` | `js/shell-tab-controller.js` | iframe + lazy prewarm |
| **C — in-page SPA** | dc-planner | `hooksOnly: true`, `skipModeVisibility: true` | `setActiveTab()` in `index.html` | in-page `#tab*` sections |

Patterns B and C keep existing sidebar DOM (no `ShellModules.render()`). They integrate via:

- `ShellModules.resolveTabId()` for mode-gated redirects
- `document.dispatchEvent(new CustomEvent("shell:tabChanged", …))` on every tab switch
- `shell:modeChanged` from the product user-mode picker (`DCShared.setUserMode`, cluster-manager `setUserMode`)

Use **`skipModeVisibility: true`** when the product owns mode UX (cluster-manager locked tabs,
dc-planner CSS `mode-advanced` / `mode-expert` hiding).

### llm-benchmark (reference — Pattern A)

- `body.nav-side`, shared `Shell.init()`, static sidebar + iframe panels
- `data/shell-modules.json` — 5 iframe modules
- `js/plugin-mount.js` — `contributes` + queue-tab prewarm hook

### cluster-manager (Pattern B — P6)

Extracted ~900 lines from inline `pages/index.html` into `js/shell-tab-controller.js`:

- Mode/feature visibility redirects (`network`, `report`, `debug`) with **locked-tab discovery UX**
- Lazy iframe + background prewarm + loading overlay
- Docs tab in `.sidebar-bottom` (`placement: "bottom"` in JSON)
- 7 modules in `data/shell-modules.json`

Does **not** call `Shell.init()` — custom chrome IDs (`collapseToggleSide`, `userModeBtnSide`) remain product-local.

### dc-planner (Pattern C — P6b)

- 12 in-page tab panels (`panel.type: "html"` markers in JSON; real DOM is `#tabWorkload`, …)
- `#generateReportBtn` is **not** a shell module — action button at end of nav strip
- Desktop hero toolbar (Load/Save) stays product-local (`css/dc-planner.css`)
- `setActiveTab()` + `window.switchTab` alias for orb navigation

---

## Events

| Event | Source | Use |
| --- | --- | --- |
| `shell:tabChanged` | `shell.js`, `shell-tab-controller.js`, dc-planner `setActiveTab()` | `{ tabId }` — panel shown; drives `onTab:*` activation |
| `shell:modeChanged` | `shell.js`, `shared-ui.js`, cluster-manager `setUserMode()` | `{ mode }` — hide advanced/expert modules |
| `shellModule:registered` | `shell-modules.js` | `{ module }` — introspection, tests |
| `shellModule:beforeActivate` | `shell-modules.js` | cancellable redirect |

Modules should prefer hooks over monkey-patching `Shell.switchTab`.

---

## Catalog plugins (knowledge-exchange, demo-portal)

`type: catalog` plugins use `catalog-topnav` — they do **not** load `shell.css` by default.

When a catalog consumer adds operational multi-tab surfaces (e.g. KE Studio):

1. Adopt dashboard head skeleton + `shell.css`
2. Set `webtools.shellLayout` to `sidebar-iframe`
3. Register shell modules for each studio view
4. Keep catalog home as a separate entry or first module (`id: "catalog"`)

See [`DESIGN.md`](DESIGN.md) Part 2.

---

## Validation

```bash
# Per-dashboard registry + manifest wiring
python3 scripts/check_shell_modules.py --repo llm-benchmark
python3 scripts/check_shell_modules.py --repo cluster-manager
python3 scripts/check_shell_modules.py --repo dc-planner

# Cross-repo (includes L1b shell modules)
cd webtools-ui && make enhanced-validation-quick
```

`check_shell_modules.py` verifies: `contributes.views.sidebar`, `registrations.shellModules`,
`entry.mount` → `plugin-mount.js`, `dependencies.webtoolsModules` includes `shell-modules`, index
script tags, and iframe `panel.src` files (iframe dashboards only).

---

## Implementation roadmap

| Phase | Deliverable | Consumers |
| --- | --- | --- |
| **S1** (landed) | `shell-modules.js`, schema, this doc, `platform.shellModules` | webtools-ui |
| **S2** (landed) | llm-benchmark `data/shell-modules.json` + `Shell.init()` | llm-benchmark |
| **S3** (landed) | cluster-manager extract + bottom-nav `docs` module | cluster-manager |
| **S4** (landed) | dc-planner JSON registry + platform events | dc-planner |
| **S5** (landed) | `check_shell_modules.py` in `enhanced_validation.sh` L1b | all dashboards |
| **S6** | Optional KE studio shell behind feature flag | knowledge-exchange |
| **S7** | `ShellModules.render()` adoption (optional DOM generation) | future |

---

## Seed FAQ

**Q: Is a shell module the same as a community plugin?**  
No. A **community plugin** is a whole repo (cluster-manager). A **shell module** is one tab/view
inside that repo's dashboard shell.

**Q: Where does chat orb / demo / voice fit?**  
They remain global platform services registered in the mount script. Shell modules are **navigation
units**; orb/demo attach to the shell, not to a single tab (though demo tracks may target tab ids).

**Q: Can modules load CSS/JS per tab?**  
Prefer each iframe page to own its assets. For `panel.type: "mount"`, the mount function may inject
link/script tags — keep that rare; iframe isolation is the default.

**Q: Why not embed React/Vue routes in the shell?**  
The harmonized stack is static HTML + iframe panels for offline/air-gap friendliness and consistent
Phase 9 testing. In-page `mount()` is the escape hatch for small widgets, not full SPAs.
