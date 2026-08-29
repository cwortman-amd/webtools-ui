---
type: Reference
title: Contribution Points & Composable Modules
description: This document defines how webtools-ui achieves **VS Code Extension–style standardization** and **Obsidian-style lifecycle hooks** so product teams can **swap, disable, and mix-and-match** functionality without forking shell chrome.
aliases:
- Contributions
- VS Code Extension Model
- Module Swapping
status: active
updated: 2026-08-22
---
<!-- markdownlint-disable MD025 -->
# Contribution Points & Composable Modules

This document defines how webtools-ui achieves **VS Code Extension–style standardization** and
**Obsidian-style lifecycle hooks** so product teams can **swap, disable, and mix-and-match**
functionality without forking shell chrome.

Primary architecture: [`PLATFORM_MODEL.md`](PLATFORM_MODEL.md) · Module contract:
[`SHELL_MODULES.md`](SHELL_MODULES.md) · Settings chrome: [`SETTINGS.md`](SETTINGS.md)

---

## Objective

> Modularization for easy component/module swapping and mix-and-match functionality.

Three concrete outcomes:

1. **Swap** — replace a sidebar view or platform service with an alternate implementation by id
2. **Mix** — compose tabs from JSON + mount hooks; aggregate commands/views across sibling plugins
3. **Toggle** — enable/disable modules and services per product or user mode without HTML surgery

---

## Dual standard (what we borrow)

| Pattern | Source | webtools-ui equivalent |
| --- | --- | --- |
| `contributes.views` | VS Code | `contributes.views.sidebar` → `data/shell-modules.json` |
| `contributes.commands` | VS Code | `contributes.commands` + `SlashRouter` |
| `activationEvents` | VS Code | `onStartup`, `onTab:<id>`, `onUserMode:<mode>` |
| `extensionDependencies` | VS Code | `dependencies.plugins` + `dependencies.webtoolsModules` |
| `Plugin.onload(app)` | Obsidian | `WebtoolsPlatform.register({ onload })` |
| `registerView / addCommand` | Obsidian | `ShellModules.register` / `SlashRouter.register` |
| `onunload` + cleanup | Obsidian | `onDeactivate` / disposable unregister |

**Deployment difference:** VS Code and Obsidian load extensions at runtime from a marketplace.
Webtools-ui uses **static sibling repos** + declarative manifests — same *composition model*,
different *delivery* (symlink `shared/`, CI validates manifests).

---

## OKF v0.2 documentation headers

All platform and consumer project documentation (`docs/**/*.md`, repo `README.md`, and
`tests/BUTTON-VISUAL-CONTRACT.md`) uses [Open Knowledge Format v0.2](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md)
YAML frontmatter. OKF requires exactly one field on every concept document: **`type`**. This repo
adds **`title`** and **`description`** on every doc for search snippets and agent retrieval.

### Doc `type` values (repo profile)

| `type` | Use for |
| --- | --- |
| `Product Requirements` | PRDs (`PRD.md`, `CHAT.md`, `KNOWLEDGE_CHAT.md`, …) |
| `Reference` | Architecture, API, indexes, glossaries, SDK/platform contracts |
| `Playbook` | User guides, workflows, install/runbooks, SOPs |
| `Test Plan` | Testing strategy, test specs, visual/regression contracts |
| `Design System` | Design, style, tokens, pitch/deck specs |
| `Implementation Plan` | Harmonization plans, roadmaps, integration proposals |
| `Template` | `docs/templates/*.skeleton.md` authoring scaffolds |

Existing extension fields (`aliases`, `domain`, `tags`, `summary`, `status`, `related`, …) are
preserved. When both `summary` and `description` exist, they may carry the same text; agents may
read either.

### Authoring rules

1. Start every new doc with a frontmatter block; put `type` first.
2. Keep `<!-- markdownlint-disable MD025 -->` **after** the closing `---`, not inside frontmatter.
3. Do **not** put `okf_version` on individual docs — that key is reserved for OKF bundle-root
   `index.md` files (see Knowledge Exchange module FAQ bundles).
4. Re-run the header linter after bulk edits:

```bash
python3 scripts/okf_doc_headers.py --dry-run
python3 scripts/okf_doc_headers.py
```

---

## Contribution slots

Fixed **slots** in harmonized chrome — modules declare which slot they occupy:

| Slot | Layout | DOM anchor | Example contributions |
| --- | --- | --- | --- |
| `sidebar.nav` | dashboard | `.sidebar-nav` | Plan, Deploy, Monitor |
| `sidebar.bottom` | dashboard | `.sidebar-bottom` | Docs, external links |
| `hero.toolbar` | dashboard (optional) | `.hero-toolbar` | Save, export (dc-planner) |
| `catalog.topnav` | catalog | `.topnav` | Home, Tools, Admin |
| `catalog.filters` | catalog | `.catalog-sidebar` | Level, domain, tag filters |
| `catalog.cards` | catalog | `.catalog-grid` | Module card renderer |
| `services.chat` | all | body overlay | Chat orb |
| `services.demo` | all | body overlay | Demo walkthrough |
| `services.voice` | all | global | TTS/STT bridge |
| `services.mcp` | all | stdio + `POST /mcp` | External agents (Cursor / Claude). Transport is T4; tools come from `contributes.mcp` on sidebar extensions. |

**Rule:** slots are platform-owned DOM regions. Contributions **fill** slots; they do not redefine
slot layout ([`DESIGN.md`](DESIGN.md)).

---

## Manifest `contributes` block

Product plugins declare composable surfaces in `plugin.manifest.json`:

```json
{
  "id": "llm-benchmark",
  "type": "dashboard",
  "entry": { "html": "pages/index.html", "mount": "js/plugin-mount.js" },
  "contributes": {
    "views": {
      "sidebar": "data/shell-modules.json"
    },
    "commands": {
      "source": "data/slash-commands.json",
      "coverAll": true
    },
    "services": {
      "chat": { "enabled": true },
      "demo": { "enabled": true, "tracks": "data/demo-tracks/" },
      "voice": { "enabled": true, "config": "js/voice-config.js" }
    },
    "activationEvents": ["onStartup", "onTab:plan"]
  },
  "dependencies": {
    "webtoolsModules": ["shell", "shell-modules", "chat-orb", "demo-engine", "voice"]
  }
}
```

Schema: optional `contributes` object on [`plugin.manifest.schema.json`](../schemas/plugin.manifest.schema.json).

---

## Shell module swapping

### Declarative replace

In `data/shell-modules.json`, a module can supersede another:

```json
{
  "id": "plan-v2",
  "label": "Plan",
  "icon": "science",
  "replaces": "plan",
  "panel": { "type": "iframe", "src": "plan-v2.html", "lazy": true }
}
```

At load time, `ShellModules` unregisters `plan` and registers `plan-v2`.

### Imperative replace (runtime)

```javascript
ShellModules.replace("plan", {
  id: "plan",
  label: "Plan",
  icon: "science",
  panel: { type: "mount", mount: function (el, ctx) {
    el.innerHTML = "<p>Experimental planner</p>";
    return function () { el.innerHTML = ""; };
  }},
});
```

### Enable / disable

```json
{ "id": "report", "label": "Report", "enabled": false, "icon": "summarize", "panel": { "type": "iframe", "src": "report.html" } }
```

```javascript
ShellModules.setEnabled("report", true);
ShellModules.setEnabled("profile", false);
```

Disabled modules hide nav buttons and skip activation hooks.

---

## Service swapping (T4)

Platform services follow the same **enabled + replace** pattern in the mount adapter:

```javascript
WebtoolsPlatform.register({
  id: "llm-benchmark",
  onload: function (app) {
    // Mix: pick which services to mount
    if (app.contributes.isServiceEnabled("chat")) {
      app.chat.mount({ title: "LLM Benchmark Agent" });
    }
    if (app.contributes.isServiceEnabled("voice")) {
      app.voice.configure(voiceConfig);
    }
    // Swap: alternate demo engine
    if (window.DashboardTutor) {
      app.registerService("demo", window.DashboardTutor);
    }
  },
});
```

`WebtoolsPlatform.registerService(id, impl)` allows replacing the default facade for tests or
product-specific engines (e.g. llm-benchmark `DashboardTutor` vs canonical `DemoEngine`).

---

## Mix-and-match across plugins

### Within one product

Combine JSON-declared modules + imperative hooks:

```javascript
ShellModules.init({ source: "data/shell-modules.json", hooksOnly: true });
ShellModules.register({ id: "debug", /* expert-only hooks */ });
Shell.init();
```

### Across sibling plugins (hub)

`demo-portal` (`type: hub`) aggregates registry entries — mix **links** to whole products:

```json
{ "aggregates": ["cluster-manager", "llm-benchmark", "dc-planner"] }
```

Future **P9 host** may embed a dashboard iframe or merge read-only shell module manifests for a
unified ops console. Until then, cross-plugin mix happens at:

- **Slash commands** — `SlashRouter.coverAll()` advertises every command in every orb
- **Registry** — `plugins.registry.json` drives demo-portal Tools cards
- **Shared platform** — one skin/chat/voice stack across all siblings

### Cross-plugin module import (future)

```json
{
  "id": "monitor",
  "label": "Monitor",
  "provider": "cluster-manager",
  "import": "../cluster-manager/data/shell-modules.json#monitor"
}
```

Not implemented yet — documented as P10. Requires host page + path/security policy.

---

## Activation events

| Event | Fires when | Use |
| --- | --- | --- |
| `onStartup` | After `Shell.init()` + mount `onload` | Register commands, prewarm iframes |
| `onTab:<id>` | First activation of shell module | Lazy init expensive panel |
| `onUserMode:<mode>` | `shell:modeChanged` | Reveal expert modules |
| `onSkin:<skin>` | Skin stylesheet loaded | Sync orb accent |

Mount adapter pattern:

```javascript
document.addEventListener("shell:tabChanged", function (e) {
  if (e.detail.tabId === "queue") prewarmQueueWorkers();
});

WebtoolsPlatform.on("onUserMode:expert", function () {
  ShellModules.setEnabled("report", true);
});
```

---

## Composition recipes

### Recipe A — Standard dashboard (llm-benchmark)

```text
data/shell-modules.json (views)
  + js/plugin-mount.js (contributes + ShellModules.init hooksOnly)
  + Shell.init() for canonical tab switching
  + static index.html sidebar DOM
```

### Recipe B — iframe dashboard with custom controller (cluster-manager)

```text
data/shell-modules.json (7 modules, docs placement: bottom)
  + js/shell-tab-controller.js (extracted switchTab, prewarm, locked tabs)
  + js/plugin-mount.js (hooksOnly, skipModeVisibility)
  + NO Shell.init() — product chrome IDs stay local
```

### Recipe C — in-page SPA dashboard (dc-planner)

```text
data/shell-modules.json (12 modules, panel.type: html)
  + setActiveTab() dispatches shell:tabChanged
  + js/plugin-mount.js (hooksOnly, skipModeVisibility)
  + hero toolbar actions stay outside registry (Load/Save)
```

### Recipe D — catalog + future studio (knowledge-exchange)

```text
catalog-topnav (portal) — default entry
  + optional second entry with shell.css + shell-modules for Studio tabs
```

### Recipe E — service-light embed

```json
"contributes": {
  "services": { "chat": { "enabled": false }, "demo": { "enabled": false }, "voice": { "enabled": true } }
}
```

---

## Disposable cleanup (Obsidian parity)

Every imperative registration should return cleanup:

```javascript
var disp = ShellModules.register({
  id: "temp-inspect",
  label: "Inspect",
  icon: "search",
  panel: { type: "mount", mount: function (el) {
    var root = mountInspector(el);
    return function () { root.unmount(); };
  }},
});

// later
ShellModules.unregister("temp-inspect");
// or disp.dispose() when exposed
```

Panel `mount()` return function runs on `unregister` or module replace.

---

## CI validation

| Check | Tool | Ensures |
| --- | --- | --- |
| Registry + manifest wiring | `scripts/check_shell_modules.py` | `contributes`, `registrations.shellModules`, `entry.mount`, index script tags |
| Module ids unique | `check_shell_modules.py` | no duplicate tab ids in JSON |
| iframe panel src | `check_shell_modules.py` | `pages/*.html` exists (iframe dashboards) |
| Cross-repo gate | `enhanced_validation.sh` L1b | all three dashboards pass shell module checks |
| Plugin manifest | `check_plugin_manifests.py` | schema + `webtoolsModules` deps |

Run locally:

```bash
python3 scripts/check_shell_modules.py --repo ../cluster-manager
make enhanced-validation-quick   # from webtools-ui root
```

---

## Related

- [`PLATFORM_MODEL.md`](PLATFORM_MODEL.md) — four-tier architecture
- [`IMPLEMENTATION.md`](IMPLEMENTATION.md) — P11+ parallel workstreams (ExtensionHost, MCP, Agent Gateway)
- [`SHELL_MODULES.md`](SHELL_MODULES.md) — module fields + bootstrap
- [`PLUGIN_CONTRACT.md`](PLUGIN_CONTRACT.md) — manifest + validation
- [`data/shell-module.example.json`](../data/shell-module.example.json)

## Seed FAQ

**Q: VS Code extension or Obsidian plugin?**  
Both inform the **contribution + lifecycle** shape. Delivery is static siblings, not a marketplace.

**Q: How do I swap Plan tab implementation?**  
Use `replaces` in JSON or `ShellModules.replace("plan", newDef)` in mount script.

**Q: Can I run without chat orb?**  
Set `contributes.services.chat.enabled: false` and skip `app.chat.mount` in mount adapter.

**Q: Can two plugins share one sidebar?**  
Not in one page today. Hub links or future P9 host embed; slash `coverAll` already mixes commands.
