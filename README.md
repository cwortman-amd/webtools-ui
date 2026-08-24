---
type: Reference
title: webtools-ui
description: '**UI SDK** for AMD Instinct web tools — canonical **look and feel** (tokens, skins, typography) and **common components** (sidebar shell, catalog topnav, buttons, chips, forms, chat orb, demo chrome). Sibling products mount this repo at `shared/` and compose domain UI from SDK primitives.'
---
# webtools-ui

**UI SDK** for AMD Instinct web tools — canonical **look and feel** (tokens, skins, typography)
and **common components** (sidebar shell, catalog topnav, buttons, chips, forms, chat orb, demo
chrome). Sibling products mount this repo at `shared/` and compose domain UI from SDK primitives.

Start here: [`docs/SDK.md`](docs/SDK.md) · Design spec: [`docs/DESIGN.md`](docs/DESIGN.md) ·
Platform: [`docs/PLATFORM_MODEL.md`](docs/PLATFORM_MODEL.md) · Implementation: [`docs/IMPLEMENTATION.md`](docs/IMPLEMENTATION.md)

Six registered **consumer plugins**:

- [`cluster-manager`](https://github.com/cwortman-amd/cluster-manager) — dashboard
- [`dc-planner`](https://github.com/cwortman-amd/dc-planner) — dashboard
- [`llm-benchmark`](https://github.com/cwortman-amd/llm-benchmark) — dashboard
- [`demo-portal`](https://github.com/cwortman-amd/demo-portal) — hub (demo catalog)
- [`knowledge-exchange`](https://github.com/cwortman-amd/knowledge-exchange) — catalog (learning portal)
- [`slide-presenter`](https://github.com/cwortman-amd/slide-presenter) — dashboard (draft)

Each consumer mounts this repo at `shared/` (Phase 9, 2026-05-03 onward this is a relative symlink to `~/workspace/webtools-ui/`; the original `git subtree` workflow is retained as a fallback for fresh clones / CI). Each consumer ships `plugin.manifest.json` at its repo root and a consumer checklist at `docs/IMPLEMENTATION.md`. See [`docs/PLAN.md`](docs/PLAN.md) for harmonization history (Phase 0 through Phase 9.8e P9) and [`docs/IMPLEMENTATION.md`](docs/IMPLEMENTATION.md) for active P11+ work.

> **Note**: this repo was renamed from `shared-ui` to `webtools-ui` on 2026-05-04 (Phase 9.8c). Historical phase narratives in `docs/PLAN.md` retain the original "shared-ui" name for traceability; the canonical path going forward is `~/workspace/webtools-ui/`.

---

## What lives here (canonical sources)

### CSS

| Path | Purpose |
| :--- | :--- |
| `css/base.css` | Universal shell styles, font stack, `.hero` top bar, panels, tabs, form controls, focus rings, tables, mobile defaults (Phase 9.8a + 9.8d-mobile) |
| `css/chat-orb.css` | Animated orb chrome + chat panel + LLM settings card (resizable panel + multiline composer updates in Phase 9.8e P9) |
| `css/notes-panel.css` | Right-drawer / bottom-sheet speaker-notes panel for pitch decks (mobile orientation aware as of Phase 9.8e P6) |
| `css/demo-mode.css` | Demo Mode tutor-bar + launcher chip + transcript + audience-picker chrome (Phase 9.7 promotion + Phase 9.8e P5 picker rules + P9 picker theming refresh) |
| `css/material-symbols.css` | `@font-face` + `.material-symbols-outlined` defaults for the canonical icon font (Phase 9.8d-D.1) |
| `css/fonts/material-symbols-outlined.woff2` | Self-hosted icon font (3.55 MB) |
| `css/skins/*.css` | 7 canonical skins: `amd`, `amd-gold` (default), `amd-teal`, `glass-dark`, `matte-dark`, `minimal-monochrome`, `soft-neutral-light` |
| `css/shell.css` | Sidebar / top-nav shell chrome, nav + utility buttons, skin & mode pickers |
| `css/tokens.css` | Neutral `--ui-*` defaults before skin overrides (see [`docs/TOKENS.md`](docs/TOKENS.md)) |
| `css/chrome.css` | Top-nav action bar, tool popovers, segmented controls, tool action buttons |
| `css/components.css` | Shared filter chips, active-filter chips, code blocks + copy button |

### JavaScript

| Path | Purpose |
| :--- | :--- |
| `js/chat-orb.js` | Animated orb mount + slash router + LLM settings UI + message log; optional voiceBridge push-to-talk composer |
| `js/slash-router.js` | Pluggable slash-command dispatcher + cross-repo `coverAll()` no-op coverage |
| `js/slash-catalog.js` | Catalog of every slash command shipped by any sibling consumer (drives `coverAll()`) |
| `js/voice.js` | TTS + STT + wake-word + persona/phonetic registry; iOS/iPadOS-aware voice routing in `cloudTTS.mode="auto"` (Phase 9.8e P6) |
| `js/demo-engine.js` | Demo Mode scene loop, action dispatcher, snapshot/restore (P9 control actions resume cleanly from pause) |
| `js/demo-ui.js` | Demo Mode tutor-bar player chrome, launcher chip, transcript popup (P9 compact close affordance) |
| `js/demo-voice.js` | Web Speech TTS narration for Demo Mode |
| `js/voice-local.js` | `window.LocalVoice` — on-device (CPU) TTS/STT client for the same-origin `/api/voice/*` contract (Piper + whisper.cpp); degrades to Web Speech when a consumer backend doesn't implement it |
| `js/demo-interactive.js` | `window.InteractiveNarration` — push-to-talk controller for interactive narrated walkthroughs (pause demo → capture question → context-grounded `chatLLM` answer → speak → auto-resume); backend-agnostic |
| `js/demo-audiences.js` | `window.DemoAudiences` — shared audience catalog (Standard / Advanced / Expert) (Phase 9.8e) |
| `js/demo-picker.js` | `window.DemoPicker.open(...)` — cross-repo audience-picker modal (Phase 9.8e P5) |
| `js/mobile-drawer.js` | Off-canvas drawer wiring for mobile (`MobileDrawer.install({...})` or declarative script attributes) |
| `js/error-popup.js` | Dependency-free persistent error modal + global `onerror`/rejection/`alert()` handlers. `window.ErrorPopup`/`showError` (neutral) with `CMErrorPopup`/`showErrorPopup` back-compat aliases. Uses `--ui-*` theme tokens (Phase 10.1) |
| `js/shell.js` | `window.Shell` — sidebar/top-nav layout, skin + theme + user-mode persistence. Reads its `localStorage` namespace from `window.SHELL_PREFIX`, which must be set before `Shell.init()` |
| `js/shell-modules.js` | `window.ShellModules` — declarative sidebar tab registry; lifecycle hooks snap product views onto `Shell` |
| `js/chrome.js` | `window.Chrome` — configurable top-bar tools: skin/mode switchers, info link, optional browser-local secret/profile panel |
| `js/platform.js` | `window.WebtoolsPlatform` — formal App object for community plugins; wraps Shell, ChatOrb, SlashRouter, demo, voice (see [`docs/PLUGIN_CONTRACT.md`](docs/PLUGIN_CONTRACT.md)) |

### Docs + tooling

| Path | Purpose |
| :--- | :--- |
| `docs/PLAN.md` | The harmonization plan + status log (single source of truth for cross-repo work) |
| `docs/SDK.md` | **UI SDK** — look & feel, component catalog, mount contract, extension rules |
| `docs/CONTRIBUTIONS.md` | VS Code/Obsidian-style contribution points — swap, mix, toggle modules & services |
| `docs/PLATFORM_MODEL.md` | Four-tier platform architecture |
| `docs/DESIGN.md` | Dashboard shell look & style — sidebar, hero toolbar, menus, skins (canonical spec) |
| `docs/SHELL_MODULES.md` | Modular sidebar tab infrastructure — registry, JSON schema, migration path |
| `docs/INDEX_SKELETON.md` | `pages/index.html` canonical-prefix template + strict-diff CI guard contract (Phase 9.8e P4) |
| `docs/CSS_HARMONIZATION.md` | Phase 9.8c/9.8d CSS audit + per-bucket dedup tracking |
| `docs/TESTING_STRATEGY.md` | **Canonical** testing framework for every consumer: runtime/seam model, Tier 0–6 vocabulary, cross-runtime boundary testing, anti-false-positive protocol, UI coverage + combinatorial strategy. Read via `shared/`, never copied; each consumer keeps a short local instance |
| `docs/FRONTEND_PERFORMANCE.md` | **Canonical** frontend performance + responsiveness framework: metric model (Core Web Vitals at p75, task timings at p50/p95), asset-weight budgets, the wait ladder with delay-threshold/minimum-duration constants, the long-job model, FE/NFR requirement matrices, and the instrumentation contract. Verified through Tier 6 of the testing framework. Read via `shared/`, never copied |
| `docs/KNOWLEDGE_CHAT.md` | **Canonical** Universal Knowledge Chat PRD: vault registration, Markdown/PDF/Obsidian/OKF ingestion, trust-aware retrieval, citations, optional web research, human-approved writes. Read via `shared/`, never copied; each consumer's `docs/CHAT.md` covers orb UX and backend routing |
| `docs/PLUGIN_CONTRACT.md` | Community plugin contract: manifest schema, lifecycle, platform API, registered consumers |
| `plugins.registry.json` | Catalog of known community plugins (sibling repos) |
| `pages/index.html` | **Tools suite landing** — screenshot banner carousel + translucent tool cards (Open / Overview pills) |
| `css/suite.css` | Suite layout: fixed 16:9 stage, banner carousel, card grid |
| `js/suite.js` | Banner + card grid controller; loads `plugins.registry.json` |
| `assets/suite/screenshots/*-{tab}.png` | Three 16:9 tab captures per tool (`node scripts/capture-suite-screenshots.mjs`) |
| `assets/suite/*.svg` | Fallback preview art when a PNG is missing |
| `scripts/capture-suite-screenshots.mjs` | Playwright capture of each consumer dashboard at 1440×810 |
| `schemas/shell-module.schema.json` | JSON Schema for `data/shell-modules.json` dashboard tab registry |
| `data/shell-module.example.json` | Example shell module registry (llm-benchmark tabs) |
| `docs/templates/*.skeleton.md` | Shared H1–H3 outlines for `DEMO`, `AGENT`, `CHAT`, `VOICE`, `PITCH`, `STYLE` (Phase 7) + `TESTING_STRATEGY` and `FRONTEND_PERFORMANCE` (the local-instance outlines for the two frameworks above) |
| `docs/templates/{demo-track,voice-config}.schema.json` | JSON Schemas for `data/demo-tracks/*.json` and `voiceBridge.configure({...})` |
| `templates/index.skeleton.html` | The canonical `pages/index.html` head template (rendered with per-consumer `pages/index.skeleton.values.json`) |
| `scripts/check_index_skeleton.py` | Strict-diff CI guard for the head template |
| `scripts/html_consistency_audit.py` | Cross-repo HTML consistency audit over four dashboard consumers including knowledge-exchange (skeleton, body attrs, critical CSS/JS links, nav structure, duplicate IDs, iOS safe-area + viewport units). Exits non-zero on ERRORs; `--strict` also gates on WARNs. Supports `--json`, `--summary-only`, `--repo`, `--workspace` |
| `docs/CROSS_CONSUMER_TESTING.md` | Cross-consumer Playwright matrix, shared test lib layout, tier wiring, and consumer adoption roadmap |
| `tests/cross-consumer-shell.mjs` | Generic Playwright shell regression — tab panels, button visual contract, tab-switch recovery. See [`docs/CROSS_CONSUMER_TESTING.md`](docs/CROSS_CONSUMER_TESTING.md) |
| `tests/iphone-ui.mjs` | Live iPhone UI validation across device profiles × all dashboard consumers. CDP safe-area insets + coarse-pointer probes via `tests/lib/iphone-helpers.mjs`. See [iPhone validation](#iphone-validation) |
| `tests/playwright/cross-consumer-shell.spec.js` | Importable `@playwright/test` spec — run from any consumer via `shared/tests/playwright.config.mjs` |
| `scripts/run_cross_consumer_smoke.sh` | One-command L0 node + L2 Playwright smoke (`make cross-consumer-smoke`) |
| `scripts/build-vendor-manifest.sh` + `verify-vendor-manifest.sh` | Cross-repo vendor manifest tooling (Phase 8 CI gate) |
| `scripts/vendor-manifest.json` | SHA256 + size manifest used to detect drift between consumer `shared/` mounts and canonical |
| `scripts/export-pitch-pdf.mjs` | **Canonical** Playwright pitch-deck PDF exporter (1440×810, US Letter landscape). Consumers run `node shared/scripts/export-pitch-pdf.mjs` from their repo root (`--repo`/`--deck`/`--out` optional); Playwright is resolved from the consumer's `node_modules`. Replaces the three former per-repo copies |
| `scripts/voice_service.py` | Generic on-device (CPU) **TTS (Piper) + STT (whisper.cpp)** engine + framework-agnostic `http_dispatch()` implementing the same-origin `/api/voice/*` contract. Zero-egress / air-gap friendly; degrades to Web Speech when unconfigured. Paired with `js/voice-local.js`. Consumer backends import it and forward requests — no per-project engine code |

---

## Tools suite landing page

A platform-owned showcase at `pages/index.html` — one fixed **16:9** viewport with a **three-up tab screenshot banner** (3 × 16:9 captures per tool) and **9:16 portrait cards** underneath (title top, description middle, Tool / Overview pills bottom).

Refresh screenshots after UI changes:

```bash
node scripts/capture-suite-screenshots.mjs
```

```bash
cd ~/workspace/webtools-ui
source ./setup.sh
# → http://127.0.0.1:8090/pages/index.html
```

Sibling repos must live alongside webtools-ui (`../../cluster-manager/`, etc.) so registry `localUrl` paths resolve. Each tool card exposes **Tool**, **Overview**, and **Install** icon pills; **Install** opens a modal with the curl one-liner and a link to download the source archive (`.zip`). Keyboard: ←/→, Home, End. Deep link a slide with `#cluster-manager` (plugin id hash).

---

## Consuming this repo (live dev mode — Phase 9, 2026-05-03+)

Each consumer's `shared/` is a relative symlink to `~/workspace/webtools-ui/`. Canonical edits become visible in every consumer at the next file read — no sync step needed.

```bash
# Initial setup in a fresh consumer clone (only if the symlink is missing
# because the consumer was cloned without a sibling webtools-ui repo):
make shared-restore       # re-materializes shared/ as a git subtree of webtools-ui

# Probe which mode you're in:
make shared-status        # reports symlink target + webtools-ui HEAD + dirty count

# Pull updates from upstream:
#   - symlink mode: no-op (changes are already visible)
#   - subtree mode: git subtree pull --prefix=shared webtools-ui main --squash
make sync-shared

# Push fixes upstream from a consumer:
#   - symlink mode: commit directly in webtools-ui/
#   - subtree mode: git subtree push --prefix=shared webtools-ui main
make push-shared
```

In each consumer's HTML pages, reference canonical assets via `shared/`:

```html
<link rel="preload" href="../shared/css/fonts/material-symbols-outlined.woff2"
      as="font" type="font/woff2" crossorigin />
<link rel="stylesheet" href="../shared/css/material-symbols.css" />
<link rel="stylesheet" href="../shared/css/base.css" />
<link rel="stylesheet" id="skinStylesheet" href="../shared/css/skins/amd-gold.css" />
<link rel="stylesheet" href="../shared/css/chat-orb.css" />
<link rel="stylesheet" href="../shared/css/demo-mode.css" />
<script src="../shared/js/chat-orb.js"></script>
```

Mobile features are opt-in. A drawer can be installed without a consumer
adapter by configuring the shared script itself:

```html
<script src="../shared/js/mobile-drawer.js" defer
        data-mobile-drawer="#sideNavDrawer"
        data-mobile-drawer-menu="#navMobileMenuBtn"
        data-mobile-drawer-backdrop="#navBackdrop"
        data-mobile-drawer-close=".nav-btn,.util-btn,.sidebar-brand"></script>
```

The installer accepts ID shorthands, CSS selectors, or elements, synchronizes
responsive ARIA state, and pins/restores the body scroll position on iOS. A
second install for the same menu button returns the existing handle, keeping
legacy `Shell.init()` consumers compatible without duplicate listeners.

To add push-to-talk to the canonical composer, load `voice.js` before
`chat-orb.js`, then opt in at mount time:

```js
ChatOrb.mount({
  voiceComposer: { bridge: window.voiceBridge, registerSlash: true }
});
```

This does not request microphone permission or begin recognition on load.
Permission is requested only after the user activates the mic. Final
transcripts follow `voiceBridge.routeTranscript()` through the normal
`ChatOrb.run()` send path. Web Speech recognition still requires a secure
context (or localhost), browser support, and user-granted permission; iOS may
use a network speech service and cannot be guaranteed offline.

Set `data-skin` on **`<html>`**, not just `<body>`. Each skin scopes its dark
palette to `:root[data-skin="…"]`, so a `data-skin` that appears only on
`<body>` leaves `--ui-accent` and its siblings undefined — which silently
voids every declaration that references them, including the shared focus
ring. The canonical template sets it on both.

The first ~18 lines of every consumer's `pages/index.html` head are locked down by [`docs/INDEX_SKELETON.md`](docs/INDEX_SKELETON.md)'s strict-diff guard. Per-repo customization (data, personas, repo-specific stylesheets) lives alongside `shared/` in each consumer's own `data/` and `css/` directories.

---

## iPhone validation

Phones are the case a desktop browser never shows you, so it is checked in two
halves that deliberately do not overlap.

**Live** — `node tests/iphone-ui.mjs` loads each consumer's real `pages/index.html`
under Playwright iPhone device profiles and asserts what only a running page can
answer: no horizontal overflow, tap targets at or above the shared 40px touch
floor, the viewport meta opting into `viewport-fit=cover` without disabling
pinch-zoom, `text-size-adjust` pinned so iOS does not inflate text on rotation,
`--ai-kb-inset` publishing a parseable length, and the chat orb panel fitting
inside the viewport. The device set is a spread rather than a catalogue —
iPhone SE for the narrowest viewport, iPhone 13 for the common notched case,
iPhone 15 Pro Max for the widest, and one landscape profile, which is where the
notch moves to the side and vertical space is tightest.

```bash
node tests/iphone-ui.mjs                      # full matrix
node tests/iphone-ui.mjs --repo dc-planner    # one consumer
node tests/iphone-ui.mjs --device "iPhone SE" # one profile
node tests/iphone-ui.mjs --json               # machine-readable
```

Exit codes: `0` all passed, `1` at least one failure, `2` could not run (for
example Playwright is not installed in any sibling consumer). Playwright is not
vendored here — it is resolved from whichever consumer has it.

**Static** — checks 24 and 25 of `scripts/html_consistency_audit.py` cover what
the live half physically cannot. Headless Chromium resolves every
`env(safe-area-inset-*)` to `0` regardless of the device profile, so the notch
and home-indicator cutouts are invisible to a browser test. The audit instead
reads the stylesheets and reports edge-pinned fixed overlays that never receive
an inset from any sheet the page loads, plus `dvh` lengths declared with no `vh`
fallback. Both report at WARN, so they surface in the default run without
failing it; `--strict` gates on them.

Two failure modes worth knowing about, because each was a real bug caught here:

- **Width breakpoints do not catch landscape phones.** Every current iPhone in
  landscape is wider than 720px, so a `max-width: 720px` block steps straight
  over them. `.ai-panel` carried both `min-height: 360px` and a `max-height`
  derived from `100dvh`; on a 343px-tall landscape viewport those conflict, CSS
  resolves in favour of `min-height`, and the panel overflowed off the top with
  its close button out of reach. Gate ergonomics on `pointer`/`height`, not width.
- **`all: unset` silently erases shared floors.** It resets `min-height` and
  `min-width` to their initial values, so any later sheet using it defeats the
  shared touch-ergonomics rule at equal specificity. This is why that rule now
  carries `!important`.

---

## Contributing back upstream

In **symlink mode** (the default since Phase 9): edit files directly under `~/workspace/webtools-ui/` and commit there. The change is visible in every consumer's `shared/` immediately. Push when ready.

In **subtree mode** (CI / fresh-clone fallback): if you fix a bug in a canonical asset while working in a consumer, the fix lives at `shared/...` in that consumer's working tree. Push it upstream with:

```bash
make push-shared
```

After landing changes, regenerate the vendor manifest so consumer CI gates stay aligned:

```bash
bash scripts/build-vendor-manifest.sh
```

---

## Sibling Repositories (Community Plugins)

This toolkit is the **platform base** for the following consumer repositories. Each repo ships
`plugin.manifest.json` and extends shared primitives via mount adapters (typically
`js/chat-orb-mount.js` or `portal/chat-orb-mount.js`).

| Plugin id | Repo | Type |
| --- | --- | --- |
| `cluster-manager` | [Cluster Manager](../cluster-manager/README.md) | dashboard |
| `dc-planner` | [DC Planner](../dc-planner/README.md) | dashboard |
| `llm-benchmark` | [LLM Benchmark](../llm-benchmark/README.md) | dashboard |
| `demo-portal` | [Demo Portal](../demo-portal/README.md) | hub |
| `knowledge-exchange` | [Knowledge Exchange](../knowledge-exchange/README.md) | catalog |

Validate manifests: `python3 scripts/check_plugin_manifests.py --strict`

---

## Installation & Setup

**Quick start:** [`docs/INSTALL.md`](docs/INSTALL.md) — one-line curl installers for each consumer on a local node.

```bash
curl -fsSL https://curt.wortman.ai/tools/install-dc-planner.sh | bash
# → http://127.0.0.1:8080/pages/index.html
```

Install scripts live in [`tools/`](tools/) (`install-lib.sh` + `install-<tool>.sh`). Host that directory at `https://curt.wortman.ai/tools/` for the curl URLs above.

**Agent skill (full suite):** [`docs/AGENT_SKILLS.md`](docs/AGENT_SKILLS.md) · `.cursor/skills/webtools-suite-install/SKILL.md`

### Local Installation (Laptop/Dev Environment)

For local development, it is recommended to clone all repositories into a common workspace directory (e.g., `~/workspace`) so the relative symlinks can resolve correctly.

1. **Create a workspace and clone repositories**:
   ```bash
   mkdir -p ~/workspace && cd ~/workspace
   git clone https://github.com/cwortman-amd/webtools-ui.git
   git clone https://github.com/cwortman-amd/llm-benchmark.git
   git clone https://github.com/cwortman-amd/cluster-manager.git
   git clone https://github.com/cwortman-amd/dc-planner.git
   git clone https://github.com/cwortman-amd/demo-portal.git
   git clone https://github.com/cwortman-amd/knowledge-exchange.git
   ```

2. **Initialize shared symlinks**:
   In each consumer repo, the `shared/` directory should point back to `webtools-ui`. Most repositories include a `Makefile` to handle this.
   ```bash
   cd ~/workspace/llm-benchmark
   make shared-restore
   ```

3. **Launch a local server**:
   Since these are static web applications, any static file server will work. Python's built-in server is a quick option:
   ```bash
   cd ~/workspace/llm-benchmark
   python3 -m http.server 8080
   ```
   Then open `http://localhost:8080/pages/index.html` in your browser.

### Server Deployment

When deploying to a production server (e.g., Nginx or Apache), ensure that the relative paths between the consumer repo and the `webtools-ui` repo are preserved.

**Example Nginx Configuration**:
```nginx
server {
    listen 80;
    server_name dashboards.example.com;
    root /var/www/html/workspace;

    location / {
        autoindex on;
    }
}
```

In this setup, your directory structure on the server would mirror your local workspace:
```text
/var/www/html/workspace/
├── webtools-ui/
├── llm-benchmark/
├── cluster-manager/
└── dc-planner/
```

---

## Validation (plugin platform)

```bash
make ci                         # strict manifests + shared node tests (lib/*.test.mjs + mobile-api)
make test-shared                # node unit tests + mobile-api contract only
make test-playwright            # cross-consumer shell + iPhone matrix
make cross-consumer-smoke       # L0 + L2 Playwright smoke (all consumers)
make enhanced-validation        # L0–L3 cross-repo gate (L2c Playwright required)
make enhanced-validation-quick  # L0–L1 + syntax; skips L2c Playwright
make check-plugins-strict
make sync-plugin-registry       # refresh demo-portal hub snapshot
```

Cross-consumer testing blueprint: [`docs/CROSS_CONSUMER_TESTING.md`](docs/CROSS_CONSUMER_TESTING.md)

Nightly: `.github/workflows/nightly-cross-consumer.yml` runs `make cross-consumer-smoke` at 06:00 UTC.

Contract: [`docs/PLUGIN_CONTRACT.md`](docs/PLUGIN_CONTRACT.md) · Registry:
[`plugins.registry.json`](plugins.registry.json)

---

## Status

The harmonization initiative is **complete** — Phases 0 through 9.8e P9 are landed, plus the
**community plugin platform** (manifest schema, registry, `platform.js`, enhanced validation).
See [`docs/PLAN.md`](docs/PLAN.md) §"Initiative status" and the chronological status log for the
full rollout. Live cross-repo gates: `make enhanced-validation`, vendor manifest in all consumers,
`test_offline.sh §25` in `llm-benchmark`, `scripts/self-check.sh` in `cluster-manager`,
`tests/self-check.sh` in `dc-planner`.
