---
title: Webtools Platform Model
aliases: [Platform Model, Plugin Architecture, Beyond Obsidian Analogy]
updated: 2026-08-09
status: active
---

<!-- markdownlint-disable MD025 -->

# Webtools Platform Model

The **webtools-ui SDK** ([`SDK.md`](SDK.md)) supplies look, feel, and common components.
This document defines how **product plugins** compose SDK primitives into full applications —
standardized like VS Code Extensions and Obsidian plugins, adapted for static sibling deployment.

**Objective:** modularization for easy component/module swapping and mixing functionality across
harmonized sidebar infrastructure.

Related:

- **UI SDK (look, components, mount):** [`SDK.md`](SDK.md)
- **Contribution points & swapping:** [`CONTRIBUTIONS.md`](CONTRIBUTIONS.md)
- Contract & validation: [`PLUGIN_CONTRACT.md`](PLUGIN_CONTRACT.md)
- Sidebar visual spec: [`DESIGN.md`](DESIGN.md)
- Modular tabs: [`SHELL_MODULES.md`](SHELL_MODULES.md)

---

## What the early Obsidian analogy got right

| Obsidian concept | webtools-ui (Phase 1–3) | Still valid? |
| --- | --- | --- |
| App shell | `webtools-ui` canonical CSS/JS | Yes — platform layer |
| Community plugin | Sibling repo (`cluster-manager`, …) | Yes — **product plugin** |
| `manifest.json` | `plugin.manifest.json` | Yes — identity + entry |
| `Plugin.onload(app)` | `chat-orb-mount.js`, `WebtoolsPlatform.register` | Partial — mount is broader now |
| Plugin directory | `plugins.registry.json` | Yes — hub/catalog discovery |

---

## What the analogy hid (and what we add)

| Gap in Obsidian framing | Refined model |
| --- | --- |
| One plugin shape | **Three product types:** `dashboard`, `catalog`, `hub` |
| Plugins extend editor UI | Products extend **harmonized shell layouts** (sidebar vs topnav) |
| Feature = plugin | Feature = **shell module** inside a product plugin |
| Runtime plugin load | **Static deploy:** symlink `shared/` + declared head skeleton |
| Commands/settings only | **Platform services:** chat, demo, voice, slash — orthogonal to tabs |
| Single host app | **Sibling repos** + optional hub aggregator (`demo-portal`) |
| KE = “another plugin” | KE = **three layers:** portal plugin, build pipeline, Obsidian vault |

The refined model is **Platform → Product Plugin → Shell Module → Platform Service**, composed
through declarative **`contributes`** blocks ([`CONTRIBUTIONS.md`](CONTRIBUTIONS.md)).

---

## Composability objective

| Goal | Mechanism |
| --- | --- |
| **Swap** a tab or service | `replaces` in shell-modules JSON; `ShellModules.replace()`; `registerService()` |
| **Mix** features in one product | JSON modules + imperative `register()` hooks in mount adapter |
| **Mix** across products | `plugins.registry.json`, hub aggregates, `SlashRouter.coverAll()` |
| **Toggle** features | `enabled: false` on modules/services; `setEnabled()` at runtime |
| **Standardize** extension points | Fixed contribution slots (`sidebar.nav`, `services.chat`, …) |

Delivery is **static** (sibling repos + symlink), not a runtime marketplace — but the **composition
model** matches VS Code/Obsidian discipline: manifest declares contributions; platform owns slots;
products fill slots; CI catches drift.

---

## Four-tier architecture

```text
┌──────────────────────────────────────────────────────────────────────────┐
│ T1  PLATFORM (webtools-ui)                                               │
│     shell.css · shell.js · shell-modules.js · platform.js                │
│     chat-orb · demo-engine · voice · slash-router · chrome · skins       │
└────────────────────────────────┬─────────────────────────────────────────┘
                                 │ shared/ symlink mount
┌────────────────────────────────▼─────────────────────────────────────────┐
│ T2  PRODUCT PLUGIN (sibling repo)                                        │
│     plugin.manifest.json · pages/index.html · mount adapter              │
│     types: dashboard | catalog | hub                                     │
└────────────────────────────────┬─────────────────────────────────────────┘
                                 │ registers
          ┌──────────────────────┼──────────────────────┐
          ▼                      ▼                      ▼
┌─────────────────┐   ┌─────────────────┐   ┌─────────────────────────────┐
│ T3 SHELL MODULE │   │ T3 SHELL MODULE │   │ T3 CATALOG SURFACE          │
│ tab: plan       │   │ tab: monitor    │   │ filters · cards · paths     │
│ panel: iframe   │   │ panel: iframe   │   │ (no sidebar — topnav)       │
└────────┬────────┘   └────────┬────────┘   └─────────────────────────────┘
         │                     │
         └──────────┬──────────┘
                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ T4  PLATFORM SERVICES (cross-cutting, not tabs)                          │
│     ChatOrb · SlashRouter · DemoEngine · voiceBridge · MobileDrawer      │
│     Optional corpus backend contract: KNOWLEDGE_CHAT.md (consumer impl)  │
│     Registered once per product in mount adapter                         │
└──────────────────────────────────────────────────────────────────────────┘
```

### Tier definitions

| Tier | Unit | Example | Declared in |
| --- | --- | --- | --- |
| **T1 Platform** | Canonical module | `Shell.switchTab`, `amd-gold` skin | `webtools-ui/css`, `js/` |
| **T2 Product plugin** | Whole repo / deployable app | `llm-benchmark` | `plugin.manifest.json` |
| **T3 Shell module** | One nav item + one panel | Plan, Deploy, Monitor | `data/shell-modules.json` |
| **T4 Platform service** | Global capability | Chat orb, `/demo`, TTS | mount adapter + `slash-catalog.js` |

**Rule:** T3 modules navigate; T4 services assist across modules. Do not implement a product feature
as a platform service unless it is genuinely global (agent, demo narrator, error modal).

---

## Product plugin types

| `type` | `shellLayout` | Shell CSS | Navigation | Consumers |
| --- | --- | --- | --- | --- |
| `dashboard` | `sidebar-iframe` | `shell.css` | Left sidebar + iframe panels | cluster-manager, dc-planner, llm-benchmark |
| `catalog` | `catalog-topnav` | `chrome.css` (not `shell.css`) | Sticky topnav + filter sidebar + cards | knowledge-exchange, demo-portal views |
| `hub` | `catalog-topnav` | `chrome.css` | Aggregates links to sibling plugins | demo-portal Tools hub |

Each type shares **T1 platform services** (skins, chat, voice) but uses a **different layout
contract**. Harmonization means visual and behavioral alignment ([`DESIGN.md`](DESIGN.md)), not
identical DOM.

---

## Registration surfaces

A product plugin declares capabilities in four places (converging toward manifest-driven CI):

| Surface | Purpose | Example |
| --- | --- | --- |
| `plugin.manifest.json` | Identity, type, entry, webtools modules consumed | `"type": "dashboard"` |
| `data/shell-modules.json` | T3 tab registry (dashboard only) | Plan / Deploy / View |
| Mount adapter | T4 service wiring + dynamic hooks | `js/chat-orb-mount.js` |
| `slash-catalog.js` | Cross-repo slash command index | consumer id + command list |

### Enhanced manifest (target shape)

```json
{
  "id": "llm-benchmark",
  "type": "dashboard",
  "entry": {
    "html": "pages/index.html",
    "mount": "js/plugin-mount.js"
  },
  "webtools": {
    "shellLayout": "sidebar-iframe",
    "defaultSkin": "amd-gold",
    "js": ["js/shell.js", "js/shell-modules.js", "js/platform.js"]
  },
  "registrations": {
    "shellModules": "data/shell-modules.json",
    "slashCommands": "js/plugin-mount.js",
    "demoTracks": "data/demo-tracks/"
  }
}
```

CI validates: manifest ↔ registry ↔ skeleton head ↔ shell-modules schema.

---

## Lifecycle (refined)

### 1. Platform boot

Browser loads canonical head skeleton ([`INDEX_SKELETON.md`](INDEX_SKELETON.md)):

```text
material-symbols → tokens → base → skin → shell.css (dashboard) | chrome.css (catalog)
→ shell.js → shell-modules.js → platform.js
```

### 2. Module registration

```javascript
window.SHELL_PREFIX = "im";
ShellModules.init({ source: "data/shell-modules.json", hooksOnly: true });
```

Registers T3 modules (declarative JSON + optional imperative hooks).

### 3. Shell activation

```javascript
Shell.init();
```

Applies persisted skin/theme/mode, wires sidebar, deep links (`?tab=`), mobile drawer.

### 4. Product mount

```javascript
WebtoolsPlatform.register({
  id: "llm-benchmark",
  onload: function (app) {
    app.commands.registerAll(nativeCommands);
    app.chat.mount({ title: "LLM Benchmark Agent", /* … */ });
    app.voice.configure(voiceConfig);
  },
});
```

Registers T4 services. This is the evolved **`Plugin.onload(app)`** — not chat-orb only.

### 5. Module activation (runtime)

User clicks sidebar tab → `Shell.switchTab` → `shell:tabChanged` → `ShellModules` hooks
(`onActivate`, lazy iframe load).

```text
User click → Shell.switchTab → shell:tabChanged → module.onActivate
                                      ↑
                         ShellModules.onBeforeActivate (redirect/gate)
```

---

## Obsidian vs webtools-ui (honest comparison)

| Dimension | Obsidian | webtools-ui ecosystem |
| --- | --- | --- |
| **Deployment** | Desktop app; plugins downloaded at runtime | Static HTML; sibling repos beside platform |
| **Plugin granularity** | One plugin per extension | Product plugin + many shell modules |
| **UI extension point** | Ribbon, settings, commands, views | Sidebar tabs, catalog cards, slash commands, orb |
| **Layout** | Single app chrome | Two harmonized layouts (sidebar / catalog-topnav) |
| **Discovery** | Community marketplace | `plugins.registry.json` + demo-portal hub |
| **Isolation** | Plugin sandbox APIs | iframe panels + strict CSS/JS boundaries |
| **Offline / air-gap** | Varies | First-class (static assets, local voice API) |
| **Cross-plugin commands** | Limited | `SlashRouter.coverAll()` — every command advertised everywhere |
| **Knowledge Exchange** | Separate vault product | Vault content is **not** a webtools plugin; portal is |

**Takeaway:** Borrow Obsidian's *discipline* (manifest, lifecycle, don't fork the shell). Do not
borrow its *shape* (runtime marketplace, single host, one extension granularity).

---

## Knowledge Exchange (three layers — not in Obsidian model)

KE exposes why the simple analogy breaks:

```text
┌─────────────────────────────────────────┐
│ Obsidian vault (projects/, wiki/)       │  ← markdown graph; NOT webtools-ui
├─────────────────────────────────────────┤
│ Build pipeline (ke/, scripts/)          │  ← Python factory; NOT webtools-ui
├─────────────────────────────────────────┤
│ Portal product plugin (pages/, portal/) │  ← webtools-ui catalog plugin
└─────────────────────────────────────────┘
```

Future KE **Studio** surfaces can add T3 shell modules under a dashboard layout without merging
vault content into the platform. See [`SHELL_MODULES.md`](SHELL_MODULES.md) § Catalog plugins.

---

## Platform API (`WebtoolsPlatform`) — enhanced map

| Facade | Tier | Responsibility |
| --- | --- | --- |
| `platform.shell` | T1 | Layout, theme, tab switching |
| `platform.shellModules` | T1/T3 | Module registry + lifecycle |
| `platform.chrome` | T1 | Topnav tools (catalog/hub) |
| `platform.commands` | T4 | Slash router |
| `platform.chat` | T4 | Chat orb |
| `platform.demo` | T4 | Demo walkthrough |
| `platform.voice` | T4 | TTS/STT |
| `platform.mobile` | T1 | Drawer installer |
| `platform.errors` | T4 | Error modal |

Product code accesses platform through **`WebtoolsPlatform`**, not by reaching for globals — globals
remain for backward compatibility during migration.

---

## Harmonization principles

1. **Shell is infrastructure** — sidebars, collapse, skins, deep links live in T1; never fork in
   product repos.
2. **Features are modules** — each tab/view is T3; declare in JSON, hook in mount adapter.
3. **Services are global** — agent, demo, voice register once at T4. Chat orb **transcript**
   storage is **per product** via `ChatOrb.mount({ storagePrefix })` — see
   [`knowledge-exchange/docs/meta/22-agent-boundaries.md`](../../knowledge-exchange/docs/meta/22-agent-boundaries.md).
4. **Manifest is truth** — identity, layout type, registrations; CI enforces drift.
5. **Visual parity** — all dashboards match [`DESIGN.md`](DESIGN.md); catalogs match chrome density.
6. **Push upstream** — reusable fixes land in `webtools-ui`, not copied across siblings.

---

## Migration state (dashboard plugins)

| Consumer | T2 manifest | T3 modules | Tab controller | Notes |
| --- | --- | --- | --- | --- |
| llm-benchmark | yes | **yes (P5)** | **`Shell.init()`** | Reference consumer — canonical `Shell.switchTab` + `plugin-mount.js` |
| cluster-manager | yes | **yes (P6)** | **`shell-tab-controller.js`** | Extracted shell logic; `hooksOnly` registry; custom iframe prewarm + locked-tab UX |
| dc-planner | yes | **yes (P6b)** | **`setActiveTab()`** | In-page panels; `hooksOnly` registry; desktop hero toolbar stays local |
| knowledge-exchange | yes | N/A (catalog) | **`plugin-mount.js`** | Catalog-topnav UI; advanced agent in `portal/chat-orb-mount.js` |
| demo-portal | yes | **yes (P8)** | **`Shell.init()`** | Hub + dashboard sidebar (Catalog / Tools / Info) |

All dashboard-style plugins declare `data/shell-modules.json`, `contributes.views.sidebar`, and
mount via `plugin-mount.js`. Catalog plugins (KE) use `contributes.views.catalog` and keep their
layout while sharing the platform bootstrap pattern.

---

## Roadmap (platform model phases)

| Phase | Deliverable | Status |
| --- | --- | --- |
| **P1** | Manifest + registry + `WebtoolsPlatform` | Landed |
| **P2** | CI gates, enhanced validation, KE chrome adapter | Landed |
| **P3** | Design spec (`DESIGN.md`), tokens, skeleton profiles | Landed |
| **P4** | Platform model doc (this file) + `shell-modules.js` | Landed |
| **P5** | llm-benchmark: `data/shell-modules.json` + `Shell.init()` | Landed |
| **P6** | cluster-manager: extract shell → `shell-tab-controller.js` + hooks | Landed |
| **P6b** | dc-planner: JSON registry + `setActiveTab` platform events | Landed |
| **P7** | `check_shell_modules.py` + L1b in `enhanced_validation.sh` | Landed |
| **P8** | `contributes` + `plugin-mount.js` on all plugins; demo-portal sidebar shell | Landed |
| **P9** | Optional dynamic host (hub embeds dashboard iframe) | Future |
| **P10** | Cross-plugin module import (`provider` + `import`) | Future |

See [`CONTRIBUTIONS.md`](CONTRIBUTIONS.md) for swap/mix recipes and activation events.

---

## Seed FAQ

**Q: Is this still “Obsidian for web dashboards”?**  
Only metaphorically. The refined model is **harmonized shell infrastructure + declarative modules +
static sibling plugins**. Obsidian is one row in the comparison table, not the architecture title.

**Q: What's the difference between a product plugin and a shell module?**  
Product plugin = entire app (repo). Shell module = one sidebar tab inside that app.

**Q: Can shell modules live in webtools-ui?**  
No. T3 modules are product-owned (`data/shell-modules.json`). T1 provides the registry runtime.

**Q: Where do slash commands fit?**  
T4 platform service. Commands may *target* a tab (`switchTab('monitor')`) but are not tabs themselves.

**Q: Should KE become a dashboard plugin?**  
The catalog stays `catalog-topnav`. Optional operational surfaces (Studio, ops console) can add T3
modules under `sidebar-iframe` as a second entry or feature-flagged layout.

## Related documents

- [`CONTRIBUTIONS.md`](CONTRIBUTIONS.md) — VS Code/Obsidian-style contribution points & swapping
- [`PLUGIN_CONTRACT.md`](PLUGIN_CONTRACT.md) — schema, validation, boundaries
- [`SHELL_MODULES.md`](SHELL_MODULES.md) — T3 module contract
- [`DESIGN.md`](DESIGN.md) — visual harmonization
- Knowledge Exchange: `knowledge-exchange/docs/meta/21-webtools-ui-plugin.md`
