---
title: "DEMO (canonical skeleton)"
description: "Shared H1–H3 outline for `docs/DEMO.md` across consumer repos. Each consumer's own DEMO.md keeps its product-specific H4+ content, but the H1–H3 spine is identical so a reader can move between sibling docs without re-orienting. See shared-ui/docs/PLAN.md Phase 7."
status: phase-7-canonical
applies_to:
  - llm-benchmark/docs/DEMO.md
  - dc-planner/docs/DEMO.md
  - cluster-manager/docs/DEMO.md
---

# `[[DEMO]]` Demo Mode — Narrated Dashboard Walkthrough

> **Authoring rule:** Sections marked **[CANONICAL]** must be present
> verbatim across all 3 consumer DEMO.md files (heading text, ordering,
> H3 sub-headings). Sections marked **[CONSUMER-SPECIFIC]** are
> required-but-content-varies. Optional sections may be omitted.

## 1) Purpose · [CANONICAL]

Single-paragraph statement of *what Demo Mode is* in this product:
self-running, in-product narrated walkthrough — not a pre-recorded
video — that doubles as a manual presentation aid.

### 1.1) Audiences · [CANONICAL]

The same three audiences in every consumer:

1. **New-user onboarding** — guided first-experience tour.
2. **Customer presales** — opinionated end-to-end demo for sales
   conversations.
3. **Engineering / training** — the deep tour with workshop hooks.

### 1.2) What Demo Mode is *not* · [CANONICAL]

A single bulleted list (4 items) explicitly clarifying scope:
*not a video*, *not a click-recorder*, *not a separate site*, *not a
replacement for the docs*. Wording can vary; intent must match.

### 1.3) Relationship to existing infrastructure · [CONSUMER-SPECIFIC]

How Demo Mode reuses each consumer's pieces:

- llm-benchmark: `pages/index.html` + `js/dashboard-tutor.js`
  (planning to migrate to `shared/js/demo-engine.js`).
- dc-planner: `pages/plan.html` + `shared/js/demo-{engine,ui,voice}.js`
  (live as of Phase 5.1).
- cluster-manager: `pages/index.html` (no engine yet — voice + manual
  presenter only).

## 2) Design Principles · [CANONICAL]

5–8 numbered design principles. Required principles in every consumer:

- **In-product, not pre-rendered.**
- **Same surface as a real LLM agent.** Every step exercises
  `window.agentBridge`, never private DOM.
- **Snapshot / restore.** Demo never strands the user mid-scenario.
- **Browser-native voice (offline).** No remote TTS dependency by
  default.
- **Manual presenter = autoplay paused with full transcript.**
  Presenters get the same artifact, paused.

## 3) Audience Tracks · [CONSUMER-SPECIFIC]

A table (or three sub-sections) listing the consumer's shipping demo
tracks. Required columns: track id, audience, est. minutes, status
(`shipped` / `planned`).

## 4) Architecture · [CANONICAL]

### 4.1) File map · [CANONICAL]

A table of files with one-line responsibility. Required entries:
`shared/js/demo-engine.js`, `shared/js/demo-ui.js`,
`shared/js/demo-voice.js`, `data/demo-tracks/<track>.json`,
`data/demo-scenarios/<scenario>.json`, plus consumer-specific glue.

Each entry should annotate `[shared]` vs `[per-consumer]`.

### 4.2) Sequence — User launches a tour · [CANONICAL]

Numbered prose or ASCII sequence diagram covering: orb `/demo` →
launcher modal → audience pick → snapshot → engine starts →
narration + actions → exit dialog → restore.

### 4.3) Domain coupling notes · [CONSUMER-SPECIFIC]

Document each consumer's `agentBridge` action surface, snapshot
keys, and any `DemoEngine.create({})` overrides.

## 5) Track schema · [CANONICAL]

The single source of truth for the JSON track schema is
`shared/docs/templates/demo-track.schema.json` (Phase 5.2). This
section MUST link to it. Each consumer's H3 sub-sections may add a
short worked example pulled from `data/demo-tracks/`.

### 5.1) Top-level track shape · [CANONICAL]

### 5.2) Scene shape · [CANONICAL]

### 5.3) Step shape · [CANONICAL]

### 5.4) Action verbs · [CANONICAL]

The 11 canonical action verbs documented in
`demo-track.schema.json#/definitions/action.type`. Consumers MAY add
domain-specific verbs but MUST flag them as such.

### 5.5) Schema validation · [CONSUMER-SPECIFIC]

How the consumer's offline test rig validates each track JSON
against the canonical schema (Phase 8).

## 6) Player UI · [CANONICAL]

### 6.1) Floating control bar · [CANONICAL]

Bottom-center (or bottom-right) player. Required controls: play /
pause, prev / next step, transcript toggle, mute toggle, exit.

### 6.2) Spotlight overlay · [CANONICAL]

The AMD-red highlight ring + click-shield, anchored to the active
`data-agent-hook` element via the engine's eased-scroll helper.

### 6.3) Transcript / speaker-notes panel · [CANONICAL]

Right-side drawer. Doubles as the manual-presenter view. Source of
truth for styling: `shared/css/notes-panel.css` (Phase 1.2).

### 6.4) Audience picker / launcher modal · [CANONICAL]

Modal that lists the consumer's tracks (one per audience) with
estimated minutes and a single launch button.

### 6.5) Page scroll during narration · [CANONICAL]

Slow, smooth, eased scroll choreographed against narration boundary
events. Honors `prefers-reduced-motion`. Source: `engine.scroll.*`
helpers in `shared/js/demo-engine.js`.

## 7) Voice synthesis & persona · [CANONICAL]

How the engine selects a voice (preferred-voice fallback chain),
applies phonetic replacements, and routes through
`shared/js/demo-voice.js`. Phase 6 will fold cluster-manager's STT +
wake-word and llm-benchmark's persona/phonetics layer into a shared
`shared/js/voice.js`; this section will then link to that.

### 7.1) Phonetic overrides · [CONSUMER-SPECIFIC]

Each consumer ships a phonetic dictionary appropriate to its domain
(e.g. llm-benchmark: `MI300X`, `vLLM`, `TTFT`).

### 7.2) Persona modes · [CONSUMER-SPECIFIC]

Audience-aware narration tweaks (decimals, dollar signs, etc.).

## 8) Snapshot & restore · [CANONICAL]

How user state is captured at demo start and restored on exit.

### 8.1) Snapshot keys · [CONSUMER-SPECIFIC]

Each consumer documents its `localStorage` key list.

### 8.2) Per-step reversibility · [CANONICAL]

### 8.3) Exit dialog · [CANONICAL]

## 9) Slash commands · [CANONICAL]

The orb command surface for Demo Mode. Every consumer registers:

- `/demo` — open the launcher modal.
- `/demo <track>` — start a specific track.
- `/demo manual` — start in manual presenter mode.

This list comes from `shared/js/slash-catalog.js` (Phase 4).

## 10) Authoring a new track · [CANONICAL]

Numbered checklist (5–8 steps) for adding a new track. Required
steps: write the track JSON, validate against the canonical schema,
add to launcher modal, add to SW pre-cache (if applicable), add an
offline regression assertion (Phase 8).

## 11) Privacy, security, and operating constraints · [CANONICAL]

What runs locally vs. remotely, what is logged, what crosses the
network. Required statement: *"Demo Mode is fully offline-capable;
no data leaves the browser."*

## 12) Frequently asked questions · [OPTIONAL]

## 13) Cross-references · [CANONICAL]

Required links:

- `docs/CHAT.md` — orb host
- `docs/VOICE.md` — TTS / STT layer
- `docs/AGENT.md` — `agentBridge` action surface
- `docs/PITCH.md` — pitch deck (also navigated via `/pitch`)
- `docs/STYLE.md` — color tokens, skin system
- `shared/docs/PLAN.md` — harmonization status log

## 14) Changelog · [CONSUMER-SPECIFIC]
