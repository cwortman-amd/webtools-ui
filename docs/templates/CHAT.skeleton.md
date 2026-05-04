---
title: "CHAT (canonical skeleton)"
description: "Shared H1–H3 outline for `docs/CHAT.md` across consumer repos. Captures the floating orb PRD format that all 3 consumers already converge on."
status: phase-7-canonical
applies_to:
  - llm-benchmark/docs/CHAT.md
  - dc-planner/docs/CHAT.md
  - cluster-manager/docs/CHAT.md
---

# `[[CHAT]]` AI Chat & Floating Orb — Product Requirements Document

> Authoring rules: see top of `DEMO.skeleton.md`.

## Status · [CONSUMER-SPECIFIC]

A short status block: shipping version, what landed in the latest
release. Ordered newest-first.

## Overview · [CANONICAL]

Single-paragraph statement of what the chat orb is in this product
and what role it plays. The canonical statement: *"The orb is the
single user-facing surface for every AI capability — chat, slash
commands, demo launcher, voice toggle, LLM settings — anchored to
the lower-right of every dashboard page."*

## Problem statement · [CANONICAL]

Why this surface exists at all (vs. a dedicated chat page or a
right-rail widget). Required points:

- One muscle memory across every page.
- Slash commands act as a CLI for power users.
- Same orb is the demo launcher and voice toggle, so users do not
  hunt for separate buttons.

## Goals · [CANONICAL]

Bulleted list of the 3–6 things the orb MUST do well.

## Non-goals · [CANONICAL]

Bulleted list of explicit anti-features (e.g. *"Not a multi-turn
chat history browser"*, *"Not a code-execution sandbox"*).

## The Floating Orb · [CANONICAL]

### Anchor & layout · [CANONICAL]

Bottom-right of the viewport, fixed positioning, stays put across
tabs, follows skin accent.

### Visual anatomy · [CANONICAL]

The four canonical elements: the orb itself, the status badge, the
notice dot, the hover preview. Source of truth for visuals:
`shared/css/chat-orb.css` (Phase 2).

### States · [CANONICAL]

Required states: `idle`, `typing`, `listening`, `speaking`,
`has-notice`, `disabled`.

### Interaction model · [CANONICAL]

Click → toggle panel. Drag → no-op. Right-click → context menu
(LLM settings, clear, etc.). Keyboard `cmd/ctrl + k` → focus input.

### Mobile behavior · [CANONICAL]

Below `768px` the orb collapses to a full-width sheet from the
bottom of the viewport.

### Accent color sync · [CANONICAL]

The orb reads `--ai-accent` (consumer-set in `chat-orb-mount.js`)
and re-themes to match the active skin.

## Focus categories & accent map · [CONSUMER-SPECIFIC]

Each consumer maps tabs / pages to focus categories which can
re-tint the orb. Required table: `tab → focus → accent token`.

## User preference model (`localStorage`) · [CANONICAL]

A single table listing every key the orb writes, scoped under a
consumer-prefixed namespace.

### Signal sources · [CANONICAL]

What user actions update the model (panel open, command run,
slash usage, voice toggle, LLM enable).

## Chat panel UI · [CANONICAL]

### Panel geometry · [CANONICAL]

The panel slides up from the orb to a fixed max-height, with
backdrop-blur, internal scroll, and a sticky input row.

### Panel structure · [CANONICAL]

Header (with title + close), message log, quick-menu chip row,
input row with send button + mic button + gear icon (LLM
settings).

## Intent library · [CANONICAL]

Required H3s:

### Slash commands · [CANONICAL]

Renders `shared/js/slash-catalog.js` (Phase 4) — full list with
which are native to this consumer.

### Free-text intents · [CONSUMER-SPECIFIC]

Each consumer's regex / keyword router to detect intents from
natural-language input.

### LLM fallback · [CANONICAL]

When freeform text doesn't match any local intent and the LLM is
enabled, the input is forwarded to the configured model
(`/llm`-managed settings).

## Visual mutations · [CONSUMER-SPECIFIC]

How the orb can mutate the host page (card reorder, theme accent
shift, hero tagline personalization, etc.). cluster-manager and
dc-planner have rich mutation systems; llm-benchmark is more
read-only.

## Feedback collection · [CANONICAL]

How the orb collects bug / enhancement reports. Required H3:

### Proactive regression-filing flow · [CANONICAL]

When the orb auto-prompts the user to file feedback (failed
actions, broken hooks, etc.).

## Voice layer integration · [CANONICAL]

How the orb hosts the voice mic button and routes finalized
transcripts back through `chatOrb.send()` so voice and typed
input share the same intent path. Source of truth: `docs/VOICE.md`.

## Demo layer integration · [CANONICAL]

How `/demo` launches the demo engine and how the orb gets
re-themed during a tour. Source of truth: `docs/DEMO.md`.

## LLM configuration (`/llm`) · [CANONICAL]

How users configure host, model, key, mode (primary vs fallback).
The settings card is rendered by `shared/js/chat-orb.js`.

## Accessibility · [CANONICAL]

Required: keyboard reachable, ARIA-labeled, screen-reader
friendly, respects `prefers-reduced-motion`.

## Performance targets · [CANONICAL]

Required SLOs: open-panel < 100ms, slash dispatch < 50ms, LLM
first-token < 1.5s with default config.

## Success metrics · [CONSUMER-SPECIFIC]

## Engine architecture · [CANONICAL]

The implementation: `shared/js/chat-orb.js` (canonical orb,
Phase 2), `shared/js/slash-router.js` (Phase 2 + 4),
`shared/js/slash-catalog.js` (Phase 4), and the per-consumer
`js/chat-orb-mount.js` that brands and registers commands.

## Future roadmap · [CONSUMER-SPECIFIC]

## Cross-references · [CANONICAL]

Required links:

- `docs/AGENT.md` — action surface the orb dispatches to
- `docs/VOICE.md` — voice integration
- `docs/DEMO.md` — demo launcher integration
- `docs/STYLE.md` — orb visual tokens
- `shared/js/chat-orb.js` — canonical orb implementation
- `shared/js/slash-catalog.js` — canonical command surface
- `shared/docs/PLAN.md` — harmonization status log
