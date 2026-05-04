# shared-ui

Canonical implementations of UI surfaces shared across:

- [`llm-benchmark`](https://github.com/cwortman-amd/llm-benchmark)
- [`dc-planner`](https://github.com/cwortman-amd/dc-planner)
- [`cluster-manager`](https://github.com/cwortman-amd/cluster-manager)

Each consumer mounts this repo at `shared/` via `git subtree`. See
[`docs/PLAN.md`](docs/PLAN.md) for the full harmonization plan and rationale.

---

## What lives here (canonical sources)

| Path | Purpose | Origin |
| :--- | :--- | :--- |
| `css/base.css` | Universal shell styles, font stack, hero/sidebar layout | Was identical in 2/3 consumers; promoted |
| `css/chat-orb.css` | Animated orb chrome + panel + LLM settings card | Extracted from `dc-planner/js/chat-feedback.js` |
| `css/notes-panel.css` | Right-drawer speaker-notes panel for pitch decks | Extracted from `dc-planner/pages/pitch.html` |
| `css/demo-engine.css` | Demo Mode chrome (overlay, captions, transcript) | From `dc-planner/css/demo-mode.css` |
| `css/skins/*.css` | 7 canonical skins, AMD triplet first then alphabetical (amd, amd-gold, amd-teal, glass-dark, matte-dark (default), minimal-monochrome, soft-neutral-light) — amber/blue/nebula-light retired 2026-05-04 | Already byte-identical across consumers |
| `js/agent-bridge.js` | `window.agentBridge` + `window.mcpBridge` MCP bridge | Already nearly identical across consumers |
| `js/chat-orb.js` | Animated orb + panel + slash router + LLM settings UI (no domain intents) | Extracted from `dc-planner/js/chat-feedback.js` |
| `js/slash-router.js` | Pluggable slash-command dispatcher | New; consumers register their own handlers |
| `js/notes-panel.js` | Right-drawer notes panel toggle behavior | Extracted from `dc-planner/pages/pitch.html` |
| `js/demo-engine.js` | Demo Mode scene loop, action dispatcher, snapshot/restore | From `dc-planner/js/demo-engine.js` |
| `js/demo-ui.js` | Demo Mode launcher, audience picker, transcript popup | From `dc-planner/js/demo-ui.js` |
| `js/demo-voice.js` | Web Speech TTS narration for Demo Mode | From `dc-planner/js/demo-voice.js` |
| `js/voice.js` | TTS + STT + wake-word + persona/phonetic registry | Merged from `cluster-manager/js/voice.js` (STT) + `llm-benchmark/data/demo-tours.json` (personas) |
| `scripts/export-pitch-pdf.mjs` | Playwright-based pitch deck PDF export (1440×810, US Letter landscape) | Already nearly identical across consumers |
| `docs/templates/*.skeleton.md` | Shared H1–H3 outline + schema tables for DEMO/AGENT/CHAT/VOICE/PITCH/STYLE | New |

---

## Consuming this repo

In each consumer (`llm-benchmark`, `dc-planner`, `cluster-manager`):

```bash
# One-time setup (per consumer)
git remote add shared-ui ~/workspace/shared-ui            # local for now
git subtree add --prefix=shared shared-ui main --squash

# Pull updates from upstream
make sync-shared          # alias for: git subtree pull --prefix=shared shared-ui main --squash

# Push fixes upstream from a consumer
make push-shared          # alias for: git subtree push --prefix=shared shared-ui main
```

In each consumer's HTML pages, reference the canonical assets via `shared/`:

```html
<link rel="stylesheet" href="../shared/css/base.css">
<link rel="stylesheet" href="../shared/css/chat-orb.css">
<script src="../shared/js/agent-bridge.js"></script>
<script src="../shared/js/chat-orb.js"></script>
```

Per-repo customization (data, personas, skins-not-in-the-canonical-set) lives
in the consumer's own `data/` and `css/` directories alongside `shared/`.

---

## Contributing back upstream

If you fix a bug in a canonical asset while working in a consumer, the fix
lives at `shared/...` in that consumer's working tree. Push it upstream with:

```bash
make push-shared
```

The change becomes immediately available to other consumers via `make sync-shared`.

---

## Status

This repo is in **Phase 0** of the harmonization plan (scaffold only — no
canonical assets have been promoted yet). See [`docs/PLAN.md`](docs/PLAN.md)
for the complete phased rollout.
