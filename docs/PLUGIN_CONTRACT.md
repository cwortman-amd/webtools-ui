---
title: Webtools UI Community Plugin Contract
aliases: [Plugin Contract, Community Plugin Spec, Webtools Plugin API]
updated: 2026-08-09
status: active
---

<!-- markdownlint-disable MD025 -->

# Webtools UI Community Plugin Contract

## Purpose

This document formalizes how **sibling consumer repositories** extend `webtools-ui` — the shared
UI base for AMD web dashboards. The model mirrors Obsidian's platform + community plugin pattern:

| Obsidian | webtools-ui ecosystem |
| --- | --- |
| Obsidian App | `webtools-ui` (canonical CSS/JS/docs) |
| Community plugin | Sibling repo (`cluster-manager`, `dc-planner`, …) |
| `manifest.json` | `plugin.manifest.json` at consumer repo root |
| `Plugin.onload(app)` | `chat-orb-mount.js` (+ optional `WebtoolsPlatform.register`) |
| Community plugin list | `plugins.registry.json` |

**This is not an Obsidian plugin contract.** Consumer repos are static web applications deployed
beside `webtools-ui`, not extensions loaded inside Obsidian.

---

## Architecture

```text
~/workspace/
├── webtools-ui/                 ← platform (base)
│   ├── js/platform.js           ← WebtoolsPlatform App object
│   ├── plugins.registry.json    ← known community plugins
│   └── schemas/plugin.manifest.schema.json
│
├── cluster-manager/             ← community plugin
│   ├── plugin.manifest.json
│   ├── shared → ../webtools-ui
│   └── js/chat-orb-mount.js     ← onload equivalent
│
├── dc-planner/                  ← community plugin
├── llm-benchmark/               ← community plugin
├── demo-portal/                 ← hub plugin (aggregates others)
└── knowledge-exchange/          ← community plugin (harmonization in progress)
```

Each consumer mounts the base at `shared -> ../webtools-ui` and owns **product-specific** HTML,
CSS, JS, and data. The base owns shell chrome, chat orb, demo engine, voice, skins, and mobile
drawer primitives.

---

## Plugin Manifest

Every consumer repo MUST ship `plugin.manifest.json` at its root. Schema:
[`schemas/plugin.manifest.schema.json`](../schemas/plugin.manifest.schema.json).

Registry of known plugins: [`plugins.registry.json`](../plugins.registry.json).

### Required fields

| Field | Description |
| --- | --- |
| `id` | Stable id; must match `js/slash-catalog.js` consumer id when slash commands are registered |
| `name` | Human-readable product name |
| `version` | Semver for the consumer plugin surface |
| `minWebtoolsVersion` | Minimum compatible base version |
| `type` | `dashboard` (sidebar shell), `catalog` (topnav+cards), or `hub` (aggregator) |
| `entry.html` | Primary page (usually `pages/index.html`) |

### Optional fields

| Field | Description |
| --- | --- |
| `entry.mount` | Chat orb / slash command registration script |
| `entry.voice` | Voice persona configuration |
| `entry.styles` | Product CSS loaded after shared styles |
| `webtools.css` / `webtools.js` | Canonical modules consumed |
| `dependencies.webtoolsModules` | Logical modules: `shell`, `chat-orb`, `demo-engine`, `voice`, … |
| `aggregates` | Hub plugins: ids of sibling plugins linked from this catalog |

---

## Lifecycle

### Mount (onload)

Today, mount adapters (`js/chat-orb-mount.js`, `portal/chat-orb-mount.js`) perform setup:

1. Register native slash commands via `SlashRouter.registerAll()`
2. Call `SlashRouter.coverAll()` for cross-repo command surface
3. Mount chat orb via `ChatOrb.mount({...})`
4. Configure voice via `voiceBridge.configure()` or `voice-config.js`

Optional formalization with `WebtoolsPlatform`:

```html
<script src="../shared/js/platform.js"></script>
<script src="js/chat-orb-mount.js"></script>
<script>
  WebtoolsPlatform.register({
    id: "cluster-manager",
    onload: function (app) {
      // mount adapter may also self-register; this is additive
    },
  });
</script>
```

Load order: shared primitives → `platform.js` → product mount script.

### Unload (onunload)

Not required for static deployments. Implement `onunload` when a host dynamically swaps plugins
(for example a unified launcher page).

---

## Platform API (`WebtoolsPlatform`)

Defined in [`js/platform.js`](../js/platform.js). Exposes canonical modules:

| Property | Canonical module | Purpose |
| --- | --- | --- |
| `platform.shell` | `window.Shell` | Sidebar/top-nav layout, skin persistence |
| `platform.chrome` | `window.WebtoolsChrome` | Top-bar tools |
| `platform.commands` | `window.SlashRouter` | Slash command registry |
| `platform.chat` | `window.ChatOrb` | Chat orb UI |
| `platform.demo` | `window.DcDemo` | Demo walkthrough engine |
| `platform.voice` | `window.voiceBridge` | TTS/STT |
| `platform.mobile` | `window.MobileDrawer` | Off-canvas mobile nav |
| `platform.errors` | `window.ErrorPopup` | Error modal |

Methods:

- `WebtoolsPlatform.register(plugin)` — call `onload(platform)`
- `WebtoolsPlatform.unregister(id)` — call `onunload()`
- `WebtoolsPlatform.refresh()` — re-bind facades after late script loads

Plugins MUST NOT modify files under `webtools-ui/` from product code. Push reusable fixes
upstream.

---

## Boundaries

### Base owns (never in consumer repos)

- `css/base.css`, skins, Material Symbols
- Chat orb shell, slash router, demo engine
- Voice bridge contract (`/api/voice/*`)
- Mobile drawer, error popup, shell chrome
- Cross-repo audit scripts and index skeleton

### Plugin owns (never in webtools-ui)

- Product metadata, domain solvers, API backends
- Catalog card layout, filters, domain-specific views
- Agent slash command handlers for this product
- Pitch decks, demo tracks, voice personas for this product

### knowledge-exchange special case

Knowledge Exchange has **two asset trees**:

| Path | Role |
| --- | --- |
| `shared/` → `webtools-ui` | Portal shell (this contract) |
| `common/` | Training decks, video pipeline (NOT webtools-ui) |

The Python build pipeline (`ke/`, `scripts/`) is a separate layer — not a webtools-ui plugin.

---

## Validation

```bash
# From webtools-ui repo root (sibling repos must exist):
python3 scripts/check_plugin_manifests.py

# Strict: fail on registry/manifest drift
python3 scripts/check_plugin_manifests.py --strict
```

Checks:

- `plugins.registry.json` parses and lists known plugins
- Each `manifestPath` resolves to a valid `plugin.manifest.json`
- Registry `id` matches manifest `id`
- Required schema fields present

---

## Registered Community Plugins

| id | type | status |
| --- | --- | --- |
| `cluster-manager` | dashboard | active |
| `dc-planner` | dashboard | active |
| `llm-benchmark` | dashboard | active |
| `demo-portal` | hub | active |
| `knowledge-exchange` | catalog | active |

---

## Validation

Cross-repo enhanced validation (L0–L3):

```bash
cd webtools-ui
make enhanced-validation          # plugin gates + consumer self-checks + syntax probes
make enhanced-validation-quick    # L0–L1 + syntax only
make ci                           # L0 platform gate only
```

---

## Roadmap

| Phase | Work |
| --- | --- |
| **1 (landed)** | Manifest schema, registry, platform.js, consumer manifests |
| **2 (landed)** | `check_plugin_manifests.py`, KE `shared-check`, demo-portal Tools hub |
| **3 (landed)** | KE WebtoolsChrome adapter; CI plugin gates; enhanced validation; llm-benchmark offline green |
| **4** | Hub launcher reads registry for cross-links (demo-portal `?view=tools`) — landed |
| **5 (landed)** | CI: `check_plugin_manifests.py --strict` + `enhanced_validation.sh` in webtools-ui workflow |

---

## Related Documents

- [`README.md`](../README.md) — asset inventory and symlink mount
- [`docs/PLAN.md`](PLAN.md) — harmonization history
- [`docs/INDEX_SKELETON.md`](INDEX_SKELETON.md) — head template contract
- [`js/slash-catalog.js`](../js/slash-catalog.js) — cross-repo slash command registry
- Knowledge Exchange: `knowledge-exchange/docs/meta/21-webtools-ui-plugin.md`
