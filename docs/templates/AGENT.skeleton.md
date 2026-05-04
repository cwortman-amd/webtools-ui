---
title: "AGENT (canonical skeleton)"
description: "Shared H1–H3 outline for `docs/AGENT.md` across consumer repos. Each consumer documents its own action verbs and skill registry, but the H1–H3 spine is identical."
status: phase-7-canonical
applies_to:
  - llm-benchmark/docs/AGENT.md
  - dc-planner/docs/AGENT.md
  - cluster-manager/docs/AGENT.md
---

# `[[AGENT]]` Agent and LLM Architecture

> Authoring rules: see top of `DEMO.skeleton.md`. **[CANONICAL]** sections
> are required verbatim; **[CONSUMER-SPECIFIC]** are required-but-content-varies.

## 1) Purpose · [CANONICAL]

What an "agent" means in this product, and how it differs from the
plain LLM chat surface (CHAT.md). The canonical statement: *"The
agent is the deterministic action surface the LLM and the demo
engine both call. It never targets private DOM directly."*

## 2) Design Principles · [CANONICAL]

5–8 principles. Required:

- **Single source of truth.** Every action verb is implemented once
  in `js/agent-bridge.js` and reused by chat, voice, and demo.
- **Deterministic targeting.** Actions resolve via stable
  `data-agent-hook` / `data-agent-context` attributes, never CSS
  selectors that drift.
- **Capability map = discovery.** The agent's full surface is
  introspectable at runtime via `agentBridge.list()`.
- **Privacy by default.** Inputs flagged
  `data-agent-redact="true"` are never echoed back to remote LLMs.
- **No UI without a hook.** New interactive elements get a
  `data-agent-hook` *before* shipping.

## 3) Architecture overview · [CANONICAL]

A 1-paragraph + 1-diagram overview showing the four layers:

1. UI (the dashboard pages)
2. **Agent Bridge** (`js/agent-bridge.js`)
3. Consumers — Chat orb, Voice bridge, Demo engine, MCP server,
   external LLMs.
4. State store — `localStorage` + per-page module state.

### 3.1) Layer responsibilities · [CANONICAL]

### 3.2) Trust boundaries · [CANONICAL]

What crosses the bridge in/out, what is logged, what stays local.

## 4) Agent Bridge module · [CANONICAL]

### 4.1) How it works · [CANONICAL]

`js/agent-bridge.js` walks the DOM at boot, decorates every hook,
and exposes `window.agentBridge.{call, list, schema}` for external
callers and `agentBridge.dispatch(intent, params)` for in-page
callers.

### 4.2) Hook naming convention · [CANONICAL]

Required attributes:

- `data-agent-hook="<scope>.<surface>.<element>"` — e.g.
  `planner.workload.wl-concurrent-reqs`.
- `data-agent-context="<scope>.<surface>.<output>"` — for read
  contexts.
- `data-agent-tab="<tab-slug>"` — for top-level navigation.
- `data-agent-redact="true"` — for sensitive inputs.

### 4.3) Action verbs · [CONSUMER-SPECIFIC]

A table of every action verb the consumer's bridge implements
(navigate, set_field, click, get_state, set_state, plus any
domain-specific verbs).

### 4.4) Schema.org / structured data · [OPTIONAL]

If the consumer auto-injects schema.org annotations for accessibility
and external agents.

## 5) MCP / external integration · [CANONICAL]

### 5.1) JSON-RPC bridge · [CANONICAL]

How the bridge speaks to external orchestrators (`postMessage` for
in-browser, an MCP server for out-of-browser).

### 5.2) Capability discovery · [CANONICAL]

`agentBridge.list()` and the auto-generated agent map.

### 5.3) Server-side endpoint · [CONSUMER-SPECIFIC]

If the consumer ships a Python MCP/HTTP server.

## 6) Agent consumption patterns · [CANONICAL]

### 6.1) Pattern 1 — Direct DOM (browser agents) · [CANONICAL]

### 6.2) Pattern 2 — MCP bridge (external agents) · [CANONICAL]

### 6.3) Pattern 3 — Capability-map discovery · [CANONICAL]

### 6.4) Pattern 4 — Composite workflows / skills · [CANONICAL]

A compound flow that chains multiple verbs (e.g. "find the
recommended config and open it"). This is the seam where the
**Skills layer** (next section) plugs in.

### 6.5) Secret redaction rules · [CANONICAL]

### 6.6) Deterministic action targeting rules · [CANONICAL]

## 7) Skills registry · [CONSUMER-SPECIFIC]

If the consumer ships skills, list them in a table here. Each row:
skill id, trigger phrases, action chain summary, file location.
This sits on top of the action-verb layer documented in §4 + §6.

## 8) Slash commands · [CANONICAL]

Lists every slash command from `shared/js/slash-catalog.js` (Phase 4)
in a table, marking each as **native** or **out-of-domain no-op** for
this consumer. The exhaustive list is auto-derivable from the
catalog file; this section just renders it for human review.

## 9) Skin / theme awareness · [OPTIONAL]

How agent UI surfaces (chat orb, demo overlay, voice transcript)
honor the active skin from `shared/css/skins/`. Defers to STYLE.md
for the design tokens themselves.

## 10) Privacy, security, and trust · [CANONICAL]

### 10.1) What stays local · [CANONICAL]

### 10.2) What crosses the network · [CANONICAL]

### 10.3) Audit trail · [CANONICAL]

How the agent journal records every action (`/journal`,
`/undo`, `/redo`).

## 11) Rollout / phasing · [CONSUMER-SPECIFIC]

Each consumer's own staged rollout — e.g. `Phase A: read-only,
Phase B: suggested edits, Phase C: full agent`.

## 12) Cross-references · [CANONICAL]

Required links:

- `docs/CHAT.md` — orb host & user-facing chat surface
- `docs/VOICE.md` — STT / TTS routing into the bridge
- `docs/DEMO.md` — demo engine consumer of the bridge
- `docs/SKILLS.md` (if present) — skill authoring guide
- `shared/js/slash-catalog.js` — canonical command surface
- `shared/docs/PLAN.md` — harmonization status log

## 13) Changelog · [CONSUMER-SPECIFIC]
