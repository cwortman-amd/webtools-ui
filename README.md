# webtools-ui

Canonical implementations of UI surfaces shared across three sibling consumer dashboards:

- [`llm-benchmark`](https://github.com/cwortman-amd/llm-benchmark)
- [`dc-planner`](https://github.com/cwortman-amd/dc-planner)
- [`cluster-manager`](https://github.com/cwortman-amd/cluster-manager)

Each consumer mounts this repo at `shared/` (Phase 9, 2026-05-03 onward this is a relative symlink to `~/workspace/webtools-ui/`; the original `git subtree` workflow is retained as a fallback for fresh clones / CI). See [`docs/PLAN.md`](docs/PLAN.md) for the full harmonization history (Phase 0 through Phase 9.8e P9) and rationale.

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
| `css/skins/*.css` | 7 canonical skins: `amd`, `amd-gold`, `amd-teal`, `glass-dark`, `matte-dark` (default), `minimal-monochrome`, `soft-neutral-light` |

### JavaScript

| Path | Purpose |
| :--- | :--- |
| `js/chat-orb.js` | Animated orb mount + slash router + LLM settings UI + message log (no domain intents) |
| `js/slash-router.js` | Pluggable slash-command dispatcher + cross-repo `coverAll()` no-op coverage |
| `js/slash-catalog.js` | Catalog of every slash command shipped by any sibling consumer (drives `coverAll()`) |
| `js/voice.js` | TTS + STT + wake-word + persona/phonetic registry; iOS/iPadOS-aware voice routing in `cloudTTS.mode="auto"` (Phase 9.8e P6) |
| `js/demo-engine.js` | Demo Mode scene loop, action dispatcher, snapshot/restore (P9 control actions resume cleanly from pause) |
| `js/demo-ui.js` | Demo Mode tutor-bar player chrome, launcher chip, transcript popup (P9 compact close affordance) |
| `js/demo-voice.js` | Web Speech TTS narration for Demo Mode |
| `js/demo-audiences.js` | `window.DemoAudiences` — shared audience catalog (Standard / Advanced / Expert) (Phase 9.8e) |
| `js/demo-picker.js` | `window.DemoPicker.open(...)` — cross-repo audience-picker modal (Phase 9.8e P5) |
| `js/mobile-drawer.js` | Off-canvas drawer wiring for mobile (`MobileDrawer.install({...})`) (Phase 9.8e P2) |

### Docs + tooling

| Path | Purpose |
| :--- | :--- |
| `docs/PLAN.md` | The harmonization plan + status log (single source of truth for cross-repo work) |
| `docs/INDEX_SKELETON.md` | `pages/index.html` canonical-prefix template + strict-diff CI guard contract (Phase 9.8e P4) |
| `docs/CSS_HARMONIZATION.md` | Phase 9.8c/9.8d CSS audit + per-bucket dedup tracking |
| `docs/templates/*.skeleton.md` | Shared H1–H3 outlines for `DEMO`, `AGENT`, `CHAT`, `VOICE`, `PITCH`, `STYLE` (Phase 7) |
| `docs/templates/{demo-track,voice-config}.schema.json` | JSON Schemas for `data/demo-tracks/*.json` and `voiceBridge.configure({...})` |
| `templates/index.skeleton.html` | The canonical `pages/index.html` head template (rendered with per-consumer `pages/index.skeleton.values.json`) |
| `scripts/check_index_skeleton.py` | Strict-diff CI guard for the head template |
| `scripts/build-vendor-manifest.sh` + `verify-vendor-manifest.sh` | Cross-repo vendor manifest tooling (Phase 8 CI gate) |
| `scripts/vendor-manifest.json` | SHA256 + size manifest used to detect drift between consumer `shared/` mounts and canonical |
| `scripts/export-pitch-pdf.mjs` | Playwright-based pitch-deck PDF export (1440×810, US Letter landscape) |

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
<link rel="stylesheet" id="skinStylesheet" href="../shared/css/skins/matte-dark.css" />
<link rel="stylesheet" href="../shared/css/chat-orb.css" />
<link rel="stylesheet" href="../shared/css/demo-mode.css" />
<script src="../shared/js/chat-orb.js"></script>
```

The first ~18 lines of every consumer's `pages/index.html` head are locked down by [`docs/INDEX_SKELETON.md`](docs/INDEX_SKELETON.md)'s strict-diff guard. Per-repo customization (data, personas, repo-specific stylesheets) lives alongside `shared/` in each consumer's own `data/` and `css/` directories.

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

## Sibling Repositories

This toolkit is designed to work in concert with the following consumer repositories. Each repo provides a specific dashboard or service that consumes the canonical assets in this repository.

- **[LLM Benchmarking Toolkit (llm-benchmark)](../llm-benchmark/README.md)**: Local benchmarking, sweep optimization, and queue orchestration for AMD Instinct GPUs.
- **[Cluster Manager (cluster-manager)](../cluster-manager/README.md)**: Automation toolkit for installing, configuring, and validating AMD ROCm and AI-NIC (Pollara) clusters.
- **[DC Planner (dc-planner)](../dc-planner/README.md)**: Browser-based planning tool for GPU infrastructure scenarios (BOM, TCO, Rack, Power).

---

## Installation & Setup

### Local Installation (Laptop/Dev Environment)

For local development, it is recommended to clone all repositories into a common workspace directory (e.g., `~/workspace`) so the relative symlinks can resolve correctly.

1. **Create a workspace and clone repositories**:
   ```bash
   mkdir -p ~/workspace && cd ~/workspace
   git clone https://github.com/cwortman-amd/webtools-ui.git
   git clone https://github.com/cwortman-amd/llm-benchmark.git
   git clone https://github.com/cwortman-amd/cluster-manager.git
   git clone https://github.com/cwortman-amd/dc-planner.git
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

## Status

The harmonization initiative is **complete** — Phases 0 through 9.8e P9 are landed. See [`docs/PLAN.md`](docs/PLAN.md) §"Initiative status" and the chronological status log for the full rollout. Live cross-repo gates: vendor manifest in all 3 consumers, `test_offline.sh §25` in `llm-benchmark`, `scripts/self-check.sh` in `cluster-manager`, `tests/self-check.sh` in `dc-planner`.
